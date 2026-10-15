package com.regexam.content;

import com.regexam.common.web.ApiException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
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

    /** One matched column of an MCQ upload: which of our fields it feeds and the header it was found under. */
    public record ColumnMatch(String field, String header) {
    }

    public record McqPreview(String question, String optionA, String optionB, String optionC, String optionD,
                             String correct) {
    }

    /**
     * What an MCQ upload looks like to the importer, without saving anything: how the columns were matched,
     * which were ignored, how many rows are usable, and the first problems.
     */
    public record McqCheck(int rows, int valid, int skipped, boolean headerDetected, List<ColumnMatch> mapped,
                           List<String> ignored, int chapterCount, List<String> chapters, List<String> errors,
                           List<McqPreview> preview) {
    }

    private record ParsedMcqs(List<Mcq> mcqs, McqCheck check) {
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

    private static final int MAX_REPORTED_ERRORS = 50;

    /** Header names (lower-case, letters and digits only) that each MCQ field is recognised by. */
    private static final Map<String, Set<String>> MCQ_HEADERS = new LinkedHashMap<>();
    private static final Map<String, String> MCQ_LABELS = new LinkedHashMap<>();

    static {
        MCQ_HEADERS.put("question", Set.of("question", "questionstem", "stem", "questiontext", "mcq"));
        MCQ_HEADERS.put("optionA", Set.of("optiona", "a", "choicea", "answera"));
        MCQ_HEADERS.put("optionB", Set.of("optionb", "b", "choiceb", "answerb"));
        MCQ_HEADERS.put("optionC", Set.of("optionc", "c", "choicec", "answerc"));
        MCQ_HEADERS.put("optionD", Set.of("optiond", "d", "choiced", "answerd"));
        MCQ_HEADERS.put("correct", Set.of("correctanswer", "answer", "correct", "correctoption", "key", "ans",
                "rightanswer"));
        MCQ_HEADERS.put("explanation", Set.of("explanation", "rationale", "solution", "answerexplanation"));
        MCQ_HEADERS.put("citation", Set.of("paragraphcitation", "relevantpara", "relevantparagraph", "citation",
                "reference", "para", "paragraph", "source"));
        MCQ_LABELS.put("question", "Question");
        MCQ_LABELS.put("optionA", "Option A");
        MCQ_LABELS.put("optionB", "Option B");
        MCQ_LABELS.put("optionC", "Option C");
        MCQ_LABELS.put("optionD", "Option D");
        MCQ_LABELS.put("correct", "Correct answer");
        MCQ_LABELS.put("explanation", "Explanation");
        MCQ_LABELS.put("citation", "Citation");
    }

    private static final List<String> REQUIRED_FIELDS =
            List.of("question", "optionA", "optionB", "optionC", "optionD", "correct");
    private static final Set<String> CHAPTER_HEADERS = Set.of("chapter", "chapterrule", "chaptertitle", "topic");

    private static String headerKey(String header) {
        return header.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }

    /**
     * Columns are matched by header name, so their order does not matter and extra columns (serial number,
     * book title, difficulty...) are ignored. Without a recognisable header row the old fixed order is used:
     * Question, Option A-D, Correct Answer, Explanation, Citation.
     */
    private ParsedMcqs parseMcqs(String text) {
        List<List<String>> rows = Csv.parse(text);
        Map<String, Integer> col = new LinkedHashMap<>();
        List<ColumnMatch> mapped = new ArrayList<>();
        List<String> ignored = new ArrayList<>();
        int chapterCol = -1;
        int firstDataRow = 1;
        boolean header = false;

        if (!rows.isEmpty()) {
            List<String> head = rows.get(0);
            for (Map.Entry<String, Set<String>> f : MCQ_HEADERS.entrySet()) {
                for (int i = 0; i < head.size(); i++) {
                    if (f.getValue().contains(headerKey(head.get(i))) && !col.containsValue(i)) {
                        col.put(f.getKey(), i);
                        break;
                    }
                }
            }
            for (int i = 0; i < head.size() && chapterCol < 0; i++) {
                if (CHAPTER_HEADERS.contains(headerKey(head.get(i))) && !col.containsValue(i)) {
                    chapterCol = i;
                }
            }
            long requiredFound = REQUIRED_FIELDS.stream().filter(col::containsKey).count();
            if (requiredFound >= 3) {
                header = true;
                List<String> missing = REQUIRED_FIELDS.stream().filter(f -> !col.containsKey(f))
                        .map(MCQ_LABELS::get).toList();
                if (!missing.isEmpty()) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, "Missing column(s): " + String.join(", ", missing)
                            + ". Columns found in the file: " + String.join(", ", head)
                            + ". Name the columns Question, Option A, Option B, Option C, Option D, Correct Answer"
                            + " (Explanation and Citation are optional).");
                }
            }
        }
        if (header) {
            List<String> head = rows.get(0);
            col.forEach((field, i) -> mapped.add(new ColumnMatch(MCQ_LABELS.get(field), head.get(i))));
            for (int i = 0; i < head.size(); i++) {
                if (!col.containsValue(i) && !head.get(i).isBlank()) {
                    ignored.add(head.get(i));
                }
            }
            rows = rows.subList(1, rows.size());
            firstDataRow = 2;
        } else {
            // Legacy fixed order, with or without a header line.
            String[] order = {"question", "optionA", "optionB", "optionC", "optionD", "correct", "explanation",
                "citation"};
            for (int i = 0; i < order.length; i++) {
                col.put(order[i], i);
            }
            if (!rows.isEmpty() && rows.get(0).get(0).equalsIgnoreCase("question")) {
                rows = rows.subList(1, rows.size());
                firstDataRow = 2;
            }
        }

        List<Mcq> parsed = new ArrayList<>();
        List<String> errors = new ArrayList<>();
        Set<String> chapters = new LinkedHashSet<>();
        int skipped = 0;
        int fileRow = firstDataRow - 1;
        for (List<String> r : rows) {
            fileRow++;
            String q = cell(r, col.get("question"));
            String a = cell(r, col.get("optionA"));
            String b = cell(r, col.get("optionB"));
            String c = cell(r, col.get("optionC"));
            String d = cell(r, col.get("optionD"));
            String rawAnswer = cell(r, col.get("correct"));
            String chapter = chapterCol >= 0 ? cell(r, chapterCol) : "";
            if (!chapter.isBlank()) {
                chapters.add(chapter);
            }
            String label = "Row " + fileRow;
            if (q.isBlank() || a.isBlank() || b.isBlank() || c.isBlank() || d.isBlank() || rawAnswer.isBlank()) {
                skipped++;
                addError(errors, label + ": needs a question, four options and a correct answer");
                continue;
            }
            String correct = normalizeAnswer(rawAnswer, List.of(a, b, c, d));
            if (correct == null) {
                skipped++;
                addError(errors, label + ": correct answer '" + rawAnswer + "' is not A, B, C or D");
                continue;
            }
            Mcq m = new Mcq();
            m.setQuestion(q);
            m.setOptionA(a);
            m.setOptionB(b);
            m.setOptionC(c);
            m.setOptionD(d);
            m.setCorrect(correct);
            m.setExplanation(cell(r, col.get("explanation")));
            m.setCitation(cell(r, col.get("citation")));
            parsed.add(m);
        }
        List<McqPreview> preview = parsed.stream().limit(3).map(m -> new McqPreview(m.getQuestion(),
                m.getOptionA(), m.getOptionB(), m.getOptionC(), m.getOptionD(), m.getCorrect())).toList();
        McqCheck check = new McqCheck(rows.size(), parsed.size(), skipped, header, mapped, ignored, chapters.size(),
                chapters.stream().limit(12).toList(), errors, preview);
        return new ParsedMcqs(parsed, check);
    }

    private static void addError(List<String> errors, String message) {
        if (errors.size() < MAX_REPORTED_ERRORS) {
            errors.add(message);
        }
    }

    private static String cell(List<String> row, Integer index) {
        return index == null || index < 0 || index >= row.size() ? "" : row.get(index);
    }

    /** Dry run of an MCQ upload: reads the text exactly as the import would, but saves nothing. */
    public McqCheck checkMcqs(String text) {
        return parseMcqs(text).check();
    }

    /** In replace mode the old questions are only removed when at least one row is valid, so a bad upload cannot wipe a topic. */
    public IngestReport ingestMcqs(String topicId, String text, boolean replace) {
        topics.findById(topicId).orElseThrow(() -> notFound("Topic"));
        ParsedMcqs p = parseMcqs(text);
        p.mcqs().forEach(m -> m.setTopicId(topicId));
        if (replace && !p.mcqs().isEmpty()) {
            mcqs.deleteAll(mcqs.findByTopicId(topicId));
        }
        mcqs.saveAll(p.mcqs());
        return new IngestReport(p.mcqs().size(), p.check().skipped(), p.check().errors());
    }

    /** Accepts "B", "b", "(B)", "B.", "Option B", "Answer: B", a number 1-4, or the text of the right option. */
    private static String normalizeAnswer(String raw, List<String> options) {
        String a = raw.trim().toUpperCase(Locale.ROOT)
                .replaceFirst("^(OPTION|OPT|ANSWER|ANS|CHOICE)\\b[\\s:.\\-]*", "")
                .replaceAll("[()\\[\\].:\\s]", "");
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
