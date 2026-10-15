package com.regexam.assessment;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");

    public record WeakArea(String topicId, String topic, long weakQuestions) {
    }

    public record Resume(String topicId, String topic, String mcqId, Instant at) {
    }

    public record Dashboard(int syllabusCompletionPct, int accuracyPct, int readinessPct, int questionsPracticed,
                            double averageMockScore, int streakDays, Resume resume, List<WeakArea> weakAreas) {
    }

    private final PracticeRecordRepository practice;
    private final TestAttemptRepository attempts;
    private final PracticeService practiceService;
    private final ContentClient content;

    public Dashboard dashboard(String userId, String examId) {
        Set<String> examQuestions = new HashSet<>(content.mcqIds(examId, null));
        List<PracticeRecord> records = practice.findByUserId(userId).stream()
                .filter(r -> examQuestions.contains(r.getMcqId())).toList();
        List<TestAttempt> submitted = attempts.findByUserId(userId).stream()
                .filter(a -> "SUBMITTED".equals(a.getStatus())).toList();

        int completion = examQuestions.isEmpty() ? 0 : records.size() * 100 / examQuestions.size();
        int accuracy = records.isEmpty() ? 0 : (int) (records.stream().filter(PracticeRecord::isCorrect).count() * 100
                / records.size());
        double avgMock = submitted.stream().mapToDouble(TestAttempt::getPercentage).average().orElse(0);

        Optional<PracticeRecord> last = records.stream().max(Comparator.comparing(PracticeRecord::getAnsweredAt));
        Map<String, Long> weakByTopic = practiceService.weakCountByTopic(userId);
        Set<String> topicIds = new HashSet<>(weakByTopic.keySet());
        last.ifPresent(r -> topicIds.add(r.getTopicId()));
        Map<String, String> titles = content.topicTitles(topicIds);

        List<WeakArea> weak = weakByTopic.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(5)
                .map(e -> new WeakArea(e.getKey(), titles.getOrDefault(e.getKey(), ""), e.getValue()))
                .toList();
        Resume resume = last.map(r -> new Resume(r.getTopicId(), titles.getOrDefault(r.getTopicId(), ""),
                r.getMcqId(), r.getAnsweredAt())).orElse(null);

        return new Dashboard(completion, accuracy, (completion + accuracy) / 2, records.size(),
                Math.round(avgMock * 100.0) / 100.0, streak(records, submitted), resume, weak);
    }

    /** Consecutive days with any practice or test activity, ending today (or yesterday if today is empty). */
    private static int streak(List<PracticeRecord> records, List<TestAttempt> submitted) {
        Set<LocalDate> days = new HashSet<>();
        records.forEach(r -> days.add(r.getAnsweredAt().atZone(ZONE).toLocalDate()));
        submitted.forEach(a -> days.add(a.getSubmittedAt().atZone(ZONE).toLocalDate()));
        LocalDate day = LocalDate.now(ZONE);
        if (!days.contains(day)) {
            day = day.minusDays(1);
        }
        int streak = 0;
        while (days.contains(day)) {
            streak++;
            day = day.minusDays(1);
        }
        return streak;
    }
}
