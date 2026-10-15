package com.regexam.assessment;

import com.regexam.common.web.ApiException;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class PracticeService {

    public record Feedback(boolean correct, String correctOption, String explanation, String citation) {
    }

    /** A question without its answer. */
    public record SafeQuestion(String id, String topicId, String question, String optionA, String optionB,
                               String optionC, String optionD) {
        static SafeQuestion of(ContentClient.McqFull m) {
            return new SafeQuestion(m.id(), m.topicId(), m.question(), m.optionA(), m.optionB(), m.optionC(),
                    m.optionD());
        }
    }

    private final PracticeRecordRepository practice;
    private final TestAttemptRepository attempts;
    private final ContentClient content;

    public Feedback answer(String userId, String mcqId, String choice) {
        if (choice == null || !choice.matches("[A-D]")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Choice must be A, B, C or D");
        }
        ContentClient.McqFull mcq = content.lookup(List.of(mcqId)).stream().findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Question not found"));
        boolean correct = mcq.correct().equals(choice);

        PracticeRecord rec = practice.findById(userId + ":" + mcqId).orElseGet(() -> {
            PracticeRecord r = new PracticeRecord();
            r.setId(userId + ":" + mcqId);
            r.setUserId(userId);
            r.setMcqId(mcqId);
            return r;
        });
        rec.setTopicId(mcq.topicId());
        rec.setCorrect(correct);
        rec.setAttempts(rec.getAttempts() + 1);
        rec.setAnsweredAt(Instant.now());
        practice.save(rec);
        return new Feedback(correct, mcq.correct(), mcq.explanation(), mcq.citation());
    }

    /** Question ids the student currently gets wrong, from practice and from submitted tests. */
    Set<String> weakQuestionIds(String userId) {
        List<PracticeRecord> records = practice.findByUserId(userId);
        Set<String> wrong = records.stream().filter(r -> !r.isCorrect()).map(PracticeRecord::getMcqId)
                .collect(Collectors.toCollection(HashSet::new));
        for (TestAttempt a : attempts.findByUserId(userId)) {
            if (!"SUBMITTED".equals(a.getStatus())) {
                continue;
            }
            for (int i = 0; i < a.getQuestionIds().size(); i++) {
                String given = a.getResponses().get(i);
                if (!given.isEmpty() && !given.equals(a.getAnswerKey().get(i))) {
                    wrong.add(a.getQuestionIds().get(i));
                }
            }
        }
        records.stream().filter(PracticeRecord::isCorrect).map(PracticeRecord::getMcqId).forEach(wrong::remove);
        return wrong;
    }

    public List<SafeQuestion> weakQuestions(String userId, String examId, int limit) {
        Set<String> inExam = new HashSet<>(content.mcqIds(examId, null));
        List<String> ids = weakQuestionIds(userId).stream().filter(inExam::contains).limit(limit).toList();
        return content.lookup(ids).stream().map(SafeQuestion::of).toList();
    }

    Map<String, Long> weakCountByTopic(String userId) {
        Set<String> weak = weakQuestionIds(userId);
        return content.lookup(weak).stream()
                .collect(Collectors.groupingBy(ContentClient.McqFull::topicId, Collectors.counting()));
    }
}
