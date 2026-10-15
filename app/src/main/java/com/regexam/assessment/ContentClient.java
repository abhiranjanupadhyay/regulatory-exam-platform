package com.regexam.assessment;

import com.regexam.content.ContentService;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/** Reads content in-process; results include answers, so callers must sanitize. */
@Component
public class ContentClient {

    public record McqFull(String id, String topicId, String topicTitle, int tier, String question,
                          String optionA, String optionB, String optionC, String optionD, String correct,
                          String explanation, String citation) {
        static McqFull of(ContentService.McqFull m) {
            return new McqFull(m.id(), m.topicId(), m.topicTitle(), m.tier(), m.question(), m.optionA(),
                    m.optionB(), m.optionC(), m.optionD(), m.correct(), m.explanation(), m.citation());
        }
    }

    private final ContentService content;

    public ContentClient(ContentService content) {
        this.content = content;
    }

    public List<McqFull> select(String examId, String paperId, String topicId, Integer tier, int limit) {
        return content.select(examId, paperId, topicId, tier, limit).stream().map(McqFull::of).toList();
    }

    public List<String> mcqIds(String examId, Integer tier) {
        return content.mcqIds(examId, tier);
    }

    public List<McqFull> lookup(Collection<String> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        return content.lookup(ids).stream().map(McqFull::of).toList();
    }

    public Map<String, String> topicTitles(Collection<String> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        return content.topicTitles(ids);
    }
}
