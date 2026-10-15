package com.regexam.assessment;

import com.regexam.common.web.ApiException;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/** Calls content-service's internal endpoints, which return answers; callers must sanitize. */
@Component
public class ContentClient {

    public record McqFull(String id, String topicId, String topicTitle, int tier, String question,
                          String optionA, String optionB, String optionC, String optionD, String correct,
                          String explanation, String citation) {
    }

    private final RestClient http;

    public ContentClient(@Value("${services.content.url}") String baseUrl) {
        this.http = RestClient.create(baseUrl);
    }

    public List<McqFull> select(String examId, String paperId, String topicId, Integer tier, int limit) {
        return call(() -> http.get().uri(b -> b.path("/api/internal/mcqs/select")
                        .queryParamIfPresent("examId", java.util.Optional.ofNullable(examId))
                        .queryParamIfPresent("paperId", java.util.Optional.ofNullable(paperId))
                        .queryParamIfPresent("topicId", java.util.Optional.ofNullable(topicId))
                        .queryParamIfPresent("tier", java.util.Optional.ofNullable(tier))
                        .queryParam("limit", limit).build())
                .retrieve().body(new ParameterizedTypeReference<List<McqFull>>() { }));
    }

    public List<String> mcqIds(String examId, Integer tier) {
        return call(() -> http.get().uri(b -> b.path("/api/internal/mcqs/ids").queryParam("examId", examId)
                        .queryParamIfPresent("tier", java.util.Optional.ofNullable(tier)).build())
                .retrieve().body(new ParameterizedTypeReference<List<String>>() { }));
    }

    public List<McqFull> lookup(Collection<String> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        return call(() -> http.post().uri("/api/internal/mcqs/lookup").body(Map.of("ids", ids))
                .retrieve().body(new ParameterizedTypeReference<List<McqFull>>() { }));
    }

    public Map<String, String> topicTitles(Collection<String> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        return call(() -> http.post().uri("/api/internal/topics/titles").body(Map.of("ids", ids))
                .retrieve().body(new ParameterizedTypeReference<Map<String, String>>() { }));
    }

    private static <T> T call(java.util.function.Supplier<T> request) {
        try {
            return request.get();
        } catch (RestClientException e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Content service is unavailable");
        }
    }
}
