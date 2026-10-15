package com.regexam.content;

import com.regexam.common.web.ApiException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ContentService {

    public record TopicView(String id, String title, int tier, int weightage, List<String> chapterTitles,
                            boolean hasBook, long mcqCount) {
    }

    public record PaperView(String id, String name, List<TopicView> topics) {
    }

    public record SyllabusView(String examId, String examName, List<PaperView> papers) {
    }

    public record MatrixRow(String topicId, String examName, String paperName, String topic, int tier,
                            int weightage, boolean hasBook, long mcqCount, String status) {
    }

    public record IngestReport(int added, int skipped, List<String> errors) {
    }

    /** Includes the answer: only ever returned by internal endpoints. */
    public record McqFull(String id, String topicId, String topicTitle, int tier, String question,
                          String optionA, String optionB, String optionC, String optionD, String correct,
                          String explanation, String citation) {
    }

    public record Backup(List<Exam> exams, List<Paper> papers, List<Topic> topics, List<Book> books,
                         List<Mcq> mcqs, List<DictionaryEntry> dictionary) {
    }

    private final ExamRepository exams;
    private final PaperRepository papers;
    private final TopicRepository topics;
    private final BookRepository books;
    private final McqRepository mcqs;
    private final DictionaryRepository dictionary;

    // ---- syllabus ----

    public SyllabusView syllabus(String examId) {
        Exam exam = exams.findById(examId).orElseThrow(() -> notFound("Exam"));
        List<PaperView> paperViews = papers.findByExamId(examId).stream()
                .sorted(Comparator.comparingInt(Paper::getSortOrder))
                .map(p -> new PaperView(p.getId(), p.getName(), topics.findByPaperId(p.getId()).stream()
                        .sorted(Comparator.comparingInt(Topic::getTier).thenComparing(Topic::getTitle))
                        .map(this::topicView).toList()))
                .toList();
        return new SyllabusView(exam.getId(), exam.getName(), paperViews);
    }

    private TopicView topicView(Topic t) {
        return new TopicView(t.getId(), t.getTitle(), t.getTier(), t.getWeightage(), t.getChapterTitles(),
                books.existsById(t.getId()), mcqs.countByTopicId(t.getId()));
    }

    public List<MatrixRow> matrix() {
        Map<String, Paper> paperById = papers.findAll().stream().collect(Collectors.toMap(Paper::getId, p -> p));
        Map<String, Exam> examById = exams.findAll().stream().collect(Collectors.toMap(Exam::getId, e -> e));
        return topics.findAll().stream().map(t -> {
            Paper paper = paperById.get(t.getPaperId());
            Exam exam = paper == null ? null : examById.get(paper.getExamId());
            boolean hasBook = books.existsById(t.getId());
            long count = mcqs.countByTopicId(t.getId());
            String status = hasBook && count > 0 ? "COMPLETE"
                    : !hasBook && count == 0 ? "EMPTY" : !hasBook ? "MISSING_BOOK" : "MISSING_MCQS";
            return new MatrixRow(t.getId(), exam == null ? "?" : exam.getName(),
                    paper == null ? "?" : paper.getName(), t.getTitle(), t.getTier(), t.getWeightage(),
                    hasBook, count, status);
        }).sorted(Comparator.comparing(MatrixRow::examName).thenComparing(MatrixRow::paperName)
                .thenComparingInt(MatrixRow::tier)).toList();
    }

    // ---- ingestion ----

    public Book saveBook(String topicId, String markdown) {
        topics.findById(topicId).orElseThrow(() -> notFound("Topic"));
        if (markdown == null || markdown.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Book text is empty");
        }
        Book book = new Book();
        book.setId(topicId);
        book.setMarkdown(markdown);
        return books.save(book);
    }

    /**
     * Columns: Question, Option A-D, Correct Answer, Explanation, Citation. In replace mode the old questions
     * are only removed when at least one row is valid, so a bad upload cannot wipe a topic.
     */
    public IngestReport ingestMcqs(String topicId, String text, boolean replace) {
        topics.findById(topicId).orElseThrow(() -> notFound("Topic"));
        List<List<String>> rows = Csv.parse(text);
        if (!rows.isEmpty() && rows.get(0).get(0).equalsIgnoreCase("question")) {
            rows = rows.subList(1, rows.size());
        }
        List<Mcq> parsed = new ArrayList<>();
        List<String> errors = new ArrayList<>();
        int rowNo = 1;
        for (List<String> r : rows) {
            rowNo++;
            if (r.size() < 6 || r.subList(0, 6).stream().anyMatch(String::isBlank)) {
                errors.add("Row " + rowNo + ": needs question, four options and a correct answer");
                continue;
            }
            String correct = normalizeAnswer(r.get(5), r.subList(1, 5));
            if (correct == null) {
                errors.add("Row " + rowNo + ": correct answer '" + r.get(5) + "' is not A, B, C or D");
                continue;
            }
            Mcq m = new Mcq();
            m.setTopicId(topicId);
            m.setQuestion(r.get(0));
            m.setOptionA(r.get(1));
            m.setOptionB(r.get(2));
            m.setOptionC(r.get(3));
            m.setOptionD(r.get(4));
            m.setCorrect(correct);
            m.setExplanation(r.size() > 6 ? r.get(6) : "");
            m.setCitation(r.size() > 7 ? r.get(7) : "");
            parsed.add(m);
        }
        if (replace && !parsed.isEmpty()) {
            mcqs.deleteAll(mcqs.findByTopicId(topicId));
        }
        mcqs.saveAll(parsed);
        return new IngestReport(parsed.size(), errors.size(), errors);
    }

    private static String normalizeAnswer(String raw, List<String> options) {
        String a = raw.trim().toUpperCase(Locale.ROOT);
        if (a.matches("[A-D]")) {
            return a;
        }
        if (a.matches("[1-4]")) {
            return String.valueOf((char) ('A' + Integer.parseInt(a) - 1));
        }
        for (int i = 0; i < options.size(); i++) {
            if (options.get(i).trim().equalsIgnoreCase(raw.trim())) {
                return String.valueOf((char) ('A' + i));
            }
        }
        return null;
    }

    public Mcq updateMcq(String id, Mcq in) {
        Mcq m = mcqs.findById(id).orElseThrow(() -> notFound("Question"));
        if (in.getCorrect() == null || !in.getCorrect().matches("[A-D]")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Correct answer must be A, B, C or D");
        }
        m.setQuestion(in.getQuestion());
        m.setOptionA(in.getOptionA());
        m.setOptionB(in.getOptionB());
        m.setOptionC(in.getOptionC());
        m.setOptionD(in.getOptionD());
        m.setCorrect(in.getCorrect());
        m.setExplanation(in.getExplanation());
        m.setCitation(in.getCitation());
        return mcqs.save(m);
    }

    /** Existing words are skipped, never overwritten. */
    public IngestReport addDictionary(List<DictionaryEntry> entries) {
        int added = 0;
        int skipped = 0;
        List<String> errors = new ArrayList<>();
        for (DictionaryEntry e : entries) {
            if (e.getWord() == null || e.getWord().isBlank() || e.getDefinition() == null) {
                errors.add("Entry without a word or definition");
                continue;
            }
            e.setWord(e.getWord().trim().toLowerCase(Locale.ROOT));
            if (dictionary.existsById(e.getWord())) {
                skipped++;
            } else {
                dictionary.save(e);
                added++;
            }
        }
        return new IngestReport(added, skipped, errors);
    }

    // ---- backup ----

    public Backup backup() {
        return new Backup(exams.findAll(), papers.findAll(), topics.findAll(), books.findAll(), mcqs.findAll(),
                dictionary.findAll());
    }

    /** Replaces all content with the snapshot. */
    public void restore(Backup b) {
        exams.deleteAll();
        papers.deleteAll();
        topics.deleteAll();
        books.deleteAll();
        mcqs.deleteAll();
        dictionary.deleteAll();
        exams.saveAll(nullSafe(b.exams()));
        papers.saveAll(nullSafe(b.papers()));
        topics.saveAll(nullSafe(b.topics()));
        books.saveAll(nullSafe(b.books()));
        mcqs.saveAll(nullSafe(b.mcqs()));
        dictionary.saveAll(nullSafe(b.dictionary()));
    }

    private static <T> List<T> nullSafe(List<T> l) {
        return l == null ? Collections.emptyList() : l;
    }

    // ---- selection for the assessment service ----

    /** Scope narrows from topic to paper to exam; {@code tier} (when given) filters topics. */
    public List<McqFull> select(String examId, String paperId, String topicId, Integer tier, int limit) {
        List<Topic> scope = resolveTopics(examId, paperId, topicId, tier);
        List<McqFull> all = full(mcqs.findByTopicIdIn(ids(scope)), scope);
        Collections.shuffle(all);
        return all.size() > limit ? new ArrayList<>(all.subList(0, limit)) : all;
    }

    public List<String> mcqIds(String examId, Integer tier) {
        return mcqs.findByTopicIdIn(ids(resolveTopics(examId, null, null, tier))).stream().map(Mcq::getId).toList();
    }

    public List<McqFull> lookup(Collection<String> ids) {
        List<Mcq> found = mcqs.findAllById(ids);
        Map<String, Topic> topicById = topics.findAllById(
                found.stream().map(Mcq::getTopicId).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(Topic::getId, t -> t));
        return found.stream().map(m -> toFull(m, topicById.get(m.getTopicId()))).toList();
    }

    public Map<String, String> topicTitles(Collection<String> ids) {
        Map<String, String> out = new HashMap<>();
        topics.findAllById(ids).forEach(t -> out.put(t.getId(), t.getTitle()));
        return out;
    }

    private List<Topic> resolveTopics(String examId, String paperId, String topicId, Integer tier) {
        List<Topic> scope;
        if (topicId != null) {
            scope = topics.findById(topicId).map(List::of).orElseThrow(() -> notFound("Topic"));
        } else if (paperId != null) {
            scope = topics.findByPaperId(paperId);
        } else if (examId != null) {
            scope = topics.findByPaperIdIn(papers.findByExamId(examId).stream().map(Paper::getId).toList());
        } else {
            throw new ApiException(HttpStatus.BAD_REQUEST, "examId, paperId or topicId is required");
        }
        return tier == null ? scope : scope.stream().filter(t -> t.getTier() == tier).toList();
    }

    private List<McqFull> full(List<Mcq> list, List<Topic> scope) {
        Map<String, Topic> byId = scope.stream().collect(Collectors.toMap(Topic::getId, t -> t));
        return list.stream().map(m -> toFull(m, byId.get(m.getTopicId()))).collect(Collectors.toCollection(ArrayList::new));
    }

    private static McqFull toFull(Mcq m, Topic t) {
        return new McqFull(m.getId(), m.getTopicId(), t == null ? "" : t.getTitle(), t == null ? 1 : t.getTier(),
                m.getQuestion(), m.getOptionA(), m.getOptionB(), m.getOptionC(), m.getOptionD(), m.getCorrect(),
                m.getExplanation(), m.getCitation());
    }

    private static List<String> ids(List<Topic> list) {
        return list.stream().map(Topic::getId).toList();
    }

    private static ApiException notFound(String what) {
        return new ApiException(HttpStatus.NOT_FOUND, what + " not found");
    }
}
