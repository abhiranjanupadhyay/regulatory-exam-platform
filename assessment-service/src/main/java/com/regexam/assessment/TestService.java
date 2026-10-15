package com.regexam.assessment;

import com.regexam.common.web.ApiException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class TestService {

    public record StartRequest(String mode, String examId, String paperId, String topicId, Integer tier) {
    }

    /** The exam paper as sent to the student: no answers, no explanations. */
    public record TestPaper(String attemptId, String mode, String scopeLabel, Instant endsAt, int durationMinutes,
                            List<PracticeService.SafeQuestion> questions) {
    }

    public record ReviewItem(int number, String question, String optionA, String optionB, String optionC,
                             String optionD, String selected, String correct, String explanation, String citation) {
    }

    public record Result(String attemptId, String mode, String scopeLabel, double score, int correct, int wrong,
                         int unanswered, double negativeMarksDeducted, double percentage, boolean passed,
                         Instant submittedAt, List<ReviewItem> review) {
    }

    public record Summary(String attemptId, String mode, String scopeLabel, String status, Instant startedAt,
                          Double percentage, Boolean passed) {
    }

    private final TestAttemptRepository attempts;
    private final TierService tiers;
    private final ContentClient content;

    @Value("${exam.negative-mark:0.25}")
    private double negativeMark;
    @Value("${exam.pass-percentage:40}")
    private double passPercentage;
    @Value("${exam.full.questions:100}")
    private int fullQuestions;
    @Value("${exam.full.minutes:120}")
    private int fullMinutes;
    @Value("${exam.topic.questions:20}")
    private int topicQuestions;
    @Value("${exam.topic.minutes:30}")
    private int topicMinutes;
    @Value("${exam.qualifying.questions:50}")
    private int qualifyingQuestions;
    @Value("${exam.qualifying.minutes:60}")
    private int qualifyingMinutes;

    public TestPaper start(String userId, StartRequest req) {
        String mode = req.mode() == null ? "" : req.mode().toUpperCase();
        TestAttempt attempt = new TestAttempt();
        attempt.setUserId(userId);
        attempt.setMode(mode);
        attempt.setExamId(req.examId());

        List<ContentClient.McqFull> questions;
        switch (mode) {
            case "FULL" -> {
                require(req.examId(), "examId");
                attempt.setScopeLabel("Full Syllabus Mock");
                attempt.setDurationMinutes(fullMinutes);
                questions = content.select(req.examId(), null, null, null, fullQuestions);
            }
            case "TOPIC" -> {
                if (req.topicId() == null && req.paperId() == null) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, "topicId or paperId is required");
                }
                attempt.setScopeLabel("Topic / Chapter Test");
                attempt.setDurationMinutes(topicMinutes);
                questions = content.select(req.examId(), req.paperId(), req.topicId(), null, topicQuestions);
            }
            case "QUALIFYING" -> {
                require(req.examId(), "examId");
                questions = startQualifying(userId, req, attempt);
            }
            default -> throw new ApiException(HttpStatus.BAD_REQUEST, "mode must be FULL, TOPIC or QUALIFYING");
        }
        if (questions.isEmpty()) {
            throw new ApiException(HttpStatus.CONFLICT, "No questions are available for this test yet");
        }

        for (ContentClient.McqFull q : questions) {
            attempt.getQuestionIds().add(q.id());
            attempt.getTopicIds().add(q.topicId());
            attempt.getAnswerKey().add(q.correct());
            attempt.getResponses().add("");
        }
        attempt.setEndsAt(attempt.getStartedAt().plus(attempt.getDurationMinutes(), ChronoUnit.MINUTES));
        attempts.save(attempt);
        return new TestPaper(attempt.getId(), mode, attempt.getScopeLabel(), attempt.getEndsAt(),
                attempt.getDurationMinutes(), questions.stream().map(PracticeService.SafeQuestion::of).toList());
    }

    /** Gates: tier not already open, previous tier practised enough, and the retry cooldown has passed. */
    private List<ContentClient.McqFull> startQualifying(String userId, StartRequest req, TestAttempt attempt) {
        Integer tier = req.tier();
        if (tier == null || tier < 2 || tier > 3) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "tier must be 2 or 3 for a qualifying exam");
        }
        TierPolicy policy = tiers.policy();
        if (tiers.unlockReason(userId, tier, policy) != null) {
            throw new ApiException(HttpStatus.CONFLICT, "Tier " + tier + " is already unlocked");
        }
        if (tier == 3 && !tiers.isUnlocked(userId, 2)) {
            throw new ApiException(HttpStatus.CONFLICT, "Unlock Tier 2 first");
        }
        int coverage = tiers.coveragePct(userId, req.examId(), tier - 1);
        if (coverage < policy.getCoverageRequiredPct()) {
            throw new ApiException(HttpStatus.CONFLICT, "Practise at least " + policy.getCoverageRequiredPct()
                    + "% of Tier " + (tier - 1) + " questions first (you are at " + coverage + "%)");
        }
        Instant retry = tiers.retryAvailableAt(userId, tier, policy);
        if (retry != null) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "RETRY_COOLDOWN",
                    "You can retry the qualifying exam after " + retry);
        }
        attempt.setTargetTier(tier);
        attempt.setScopeLabel("Tier " + tier + " Qualifying Exam");
        attempt.setDurationMinutes(qualifyingMinutes);
        return content.select(req.examId(), null, null, tier - 1, qualifyingQuestions);
    }

    /** Responses are saved as the student goes so a refresh does not lose the answers. */
    public void saveResponses(String userId, String attemptId, Map<Integer, String> answers) {
        TestAttempt a = owned(userId, attemptId);
        if ("SUBMITTED".equals(a.getStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "Test already submitted");
        }
        applyAnswers(a, answers);
        attempts.save(a);
    }

    public Result submit(String userId, String attemptId, Map<Integer, String> answers) {
        TestAttempt a = owned(userId, attemptId);
        if ("SUBMITTED".equals(a.getStatus())) {
            return result(userId, attemptId);
        }
        if (answers != null) {
            applyAnswers(a, answers);
        }
        int correct = 0;
        int wrong = 0;
        int unanswered = 0;
        for (int i = 0; i < a.getQuestionIds().size(); i++) {
            String given = a.getResponses().get(i);
            if (given.isEmpty()) {
                unanswered++;
            } else if (given.equals(a.getAnswerKey().get(i))) {
                correct++;
            } else {
                wrong++;
            }
        }
        int total = a.getQuestionIds().size();
        double negative = wrong * negativeMark;
        double score = correct - negative;
        double percentage = Math.max(0, score) * 100.0 / total;
        double passMark = "QUALIFYING".equals(a.getMode()) ? tiers.policy().getQualifyingScorePct() : passPercentage;

        a.setCorrectCount(correct);
        a.setWrongCount(wrong);
        a.setUnansweredCount(unanswered);
        a.setNegativeMarks(negative);
        a.setScore(score);
        a.setPercentage(round2(percentage));
        a.setPassed(percentage >= passMark);
        a.setStatus("SUBMITTED");
        a.setSubmittedAt(Instant.now());
        attempts.save(a);

        if ("QUALIFYING".equals(a.getMode()) && a.isPassed()) {
            tiers.unlockManually(userId, a.getTargetTier(), "QUALIFIED");
        }
        return result(userId, attemptId);
    }

    public Result result(String userId, String attemptId) {
        TestAttempt a = owned(userId, attemptId);
        if (!"SUBMITTED".equals(a.getStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "Results are available after you submit the test");
        }
        Map<String, ContentClient.McqFull> byId = content.lookup(a.getQuestionIds()).stream()
                .collect(Collectors.toMap(ContentClient.McqFull::id, Function.identity()));
        List<ReviewItem> review = new ArrayList<>();
        for (int i = 0; i < a.getQuestionIds().size(); i++) {
            ContentClient.McqFull q = byId.get(a.getQuestionIds().get(i));
            if (q == null) {
                continue;
            }
            review.add(new ReviewItem(i + 1, q.question(), q.optionA(), q.optionB(), q.optionC(), q.optionD(),
                    a.getResponses().get(i).isEmpty() ? null : a.getResponses().get(i), a.getAnswerKey().get(i),
                    q.explanation(), q.citation()));
        }
        return new Result(a.getId(), a.getMode(), a.getScopeLabel(), a.getScore(), a.getCorrectCount(),
                a.getWrongCount(), a.getUnansweredCount(), a.getNegativeMarks(), a.getPercentage(), a.isPassed(),
                a.getSubmittedAt(), review);
    }

    public List<Summary> history(String userId) {
        return attempts.findByUserId(userId).stream()
                .sorted(Comparator.comparing(TestAttempt::getStartedAt).reversed())
                .map(a -> new Summary(a.getId(), a.getMode(), a.getScopeLabel(), a.getStatus(), a.getStartedAt(),
                        "SUBMITTED".equals(a.getStatus()) ? a.getPercentage() : null,
                        "SUBMITTED".equals(a.getStatus()) ? a.isPassed() : null))
                .toList();
    }

    private TestAttempt owned(String userId, String attemptId) {
        return attempts.findById(attemptId).filter(a -> a.getUserId().equals(userId))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Test not found"));
    }

    /** Keys are zero-based question indexes; a blank or invalid value clears the answer. */
    private static void applyAnswers(TestAttempt a, Map<Integer, String> answers) {
        answers.forEach((index, choice) -> {
            if (index == null || index < 0 || index >= a.getResponses().size()) {
                return;
            }
            a.getResponses().set(index, choice != null && choice.matches("[A-D]") ? choice : "");
        });
    }

    private static void require(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, name + " is required");
        }
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
