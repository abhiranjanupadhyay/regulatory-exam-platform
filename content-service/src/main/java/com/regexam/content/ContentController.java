package com.regexam.content;

import com.regexam.common.security.UserContext;
import com.regexam.common.web.ApiException;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ContentController {

    /** Student view of a question: no answer, no explanation. */
    public record PracticeQuestion(String id, String question, String optionA, String optionB, String optionC,
                                   String optionD) {
    }

    public record TextBody(String text) {
    }

    public record IdsBody(List<String> ids) {
    }

    private final ContentService service;
    private final ExamRepository exams;
    private final PaperRepository papers;
    private final TopicRepository topics;
    private final BookRepository books;
    private final McqRepository mcqs;
    private final DictionaryRepository dictionary;

    // ---- student ----

    @GetMapping("/exams")
    public List<Exam> exams() {
        return exams.findAll().stream().sorted(Comparator.comparing(Exam::getName)).toList();
    }

    @GetMapping("/exams/{examId}/syllabus")
    public ContentService.SyllabusView syllabus(@PathVariable String examId) {
        return service.syllabus(examId);
    }

    @GetMapping("/topics/{topicId}/book")
    public Map<String, String> book(@PathVariable String topicId) {
        Topic topic = topics.findById(topicId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Topic not found"));
        String markdown = books.findById(topicId).map(Book::getMarkdown).orElse("");
        return Map.of("topicId", topicId, "title", topic.getTitle(), "markdown", markdown);
    }

    /** Answers are checked by the assessment service, which also records progress. */
    @GetMapping("/topics/{topicId}/mcqs")
    public List<PracticeQuestion> topicMcqs(@PathVariable String topicId) {
        return mcqs.findByTopicId(topicId).stream()
                .map(m -> new PracticeQuestion(m.getId(), m.getQuestion(), m.getOptionA(), m.getOptionB(),
                        m.getOptionC(), m.getOptionD()))
                .toList();
    }

    @GetMapping("/dictionary/{word}")
    public DictionaryEntry define(@PathVariable String word) {
        return dictionary.findById(word.trim().toLowerCase(Locale.ROOT))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "No definition found for '" + word + "'"));
    }

    // ---- admin: curriculum ----

    @PostMapping("/admin/exams")
    public Exam createExam(UserContext user, @RequestBody Exam exam) {
        user.requireAdmin();
        requireText(exam.getName(), "Exam name");
        exam.setId(UUID.randomUUID().toString());
        return exams.save(exam);
    }

    @DeleteMapping("/admin/exams/{id}")
    public void deleteExam(UserContext user, @PathVariable String id) {
        user.requireAdmin();
        if (!papers.findByExamId(id).isEmpty()) {
            throw new ApiException(HttpStatus.CONFLICT, "Delete the exam's papers first");
        }
        exams.deleteById(id);
    }

    @PostMapping("/admin/papers")
    public Paper createPaper(UserContext user, @RequestBody Paper paper) {
        user.requireAdmin();
        requireText(paper.getName(), "Paper name");
        exams.findById(paper.getExamId()).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Exam not found"));
        paper.setId(UUID.randomUUID().toString());
        return papers.save(paper);
    }

    @DeleteMapping("/admin/papers/{id}")
    public void deletePaper(UserContext user, @PathVariable String id) {
        user.requireAdmin();
        if (!topics.findByPaperId(id).isEmpty()) {
            throw new ApiException(HttpStatus.CONFLICT, "Delete the paper's topics first");
        }
        papers.deleteById(id);
    }

    @PostMapping("/admin/topics")
    public Topic createTopic(UserContext user, @RequestBody Topic topic) {
        user.requireAdmin();
        requireText(topic.getTitle(), "Topic title");
        if (topic.getTier() < 1 || topic.getTier() > 3) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Tier must be 1, 2 or 3");
        }
        papers.findById(topic.getPaperId()).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Paper not found"));
        topic.setId(UUID.randomUUID().toString());
        return topics.save(topic);
    }

    @GetMapping("/admin/matrix")
    public List<ContentService.MatrixRow> matrix(UserContext user) {
        user.requireAdmin();
        return service.matrix();
    }

    // ---- admin: ingestion ----

    @PutMapping("/admin/topics/{topicId}/book")
    public Book putBook(UserContext user, @PathVariable String topicId, @RequestBody TextBody body) {
        user.requireAdmin();
        return service.saveBook(topicId, body.text());
    }

    @PostMapping("/admin/topics/{topicId}/book/upload")
    public Book uploadBook(UserContext user, @PathVariable String topicId, @RequestParam MultipartFile file)
            throws IOException {
        user.requireAdmin();
        return service.saveBook(topicId, new String(file.getBytes(), StandardCharsets.UTF_8));
    }

    /** mode=ADD appends; mode=REPLACE overwrites the topic's existing questions. */
    @PostMapping("/admin/topics/{topicId}/mcqs")
    public ContentService.IngestReport ingestMcqs(UserContext user, @PathVariable String topicId,
                                                  @RequestParam(defaultValue = "ADD") String mode,
                                                  @RequestBody TextBody body) {
        user.requireAdmin();
        return service.ingestMcqs(topicId, body.text(), "REPLACE".equalsIgnoreCase(mode));
    }

    @PostMapping("/admin/topics/{topicId}/mcqs/upload")
    public ContentService.IngestReport uploadMcqs(UserContext user, @PathVariable String topicId,
                                                  @RequestParam(defaultValue = "ADD") String mode,
                                                  @RequestParam MultipartFile file) throws IOException {
        user.requireAdmin();
        String name = String.valueOf(file.getOriginalFilename()).toLowerCase(Locale.ROOT);
        if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
            throw new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "Excel files are not supported yet: save the sheet as CSV or paste the rows");
        }
        return service.ingestMcqs(topicId, new String(file.getBytes(), StandardCharsets.UTF_8),
                "REPLACE".equalsIgnoreCase(mode));
    }

    @PostMapping("/admin/dictionary")
    public ContentService.IngestReport addDictionary(UserContext user, @RequestBody List<DictionaryEntry> entries) {
        user.requireAdmin();
        return service.addDictionary(entries);
    }

    // ---- admin: MCQ editor ----

    @GetMapping("/admin/mcqs")
    public List<Mcq> listMcqs(UserContext user, @RequestParam String topicId) {
        user.requireAdmin();
        return mcqs.findByTopicId(topicId);
    }

    @PutMapping("/admin/mcqs/{id}")
    public Mcq updateMcq(UserContext user, @PathVariable String id, @RequestBody Mcq mcq) {
        user.requireAdmin();
        return service.updateMcq(id, mcq);
    }

    // ---- admin: snapshot vault ----

    @GetMapping("/admin/backup")
    public ResponseEntity<ContentService.Backup> backup(UserContext user) {
        user.requireAdmin();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"content-backup.json\"")
                .body(service.backup());
    }

    @PostMapping("/admin/restore")
    public Map<String, String> restore(UserContext user, @RequestBody ContentService.Backup backup) {
        user.requireAdmin();
        service.restore(backup);
        return Map.of("status", "restored");
    }

    // ---- internal (not routed by the gateway) ----

    @GetMapping("/internal/mcqs/select")
    public List<ContentService.McqFull> select(@RequestParam(required = false) String examId,
                                               @RequestParam(required = false) String paperId,
                                               @RequestParam(required = false) String topicId,
                                               @RequestParam(required = false) Integer tier,
                                               @RequestParam(defaultValue = "50") int limit) {
        return service.select(examId, paperId, topicId, tier, limit);
    }

    @GetMapping("/internal/mcqs/ids")
    public List<String> mcqIds(@RequestParam String examId, @RequestParam(required = false) Integer tier) {
        return service.mcqIds(examId, tier);
    }

    @PostMapping("/internal/mcqs/lookup")
    public List<ContentService.McqFull> lookup(@RequestBody IdsBody body) {
        return service.lookup(body.ids());
    }

    @PostMapping("/internal/topics/titles")
    public Map<String, String> titles(@RequestBody IdsBody body) {
        return service.topicTitles(body.ids());
    }

    private static void requireText(String value, String label) {
        if (value == null || value.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, label + " is required");
        }
    }
}
