package com.regexam.content;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;

/** Exam -> Paper -> Topic hierarchy is held by parent ids (examId / paperId / topicId). */
final class Models {
    private Models() {
    }
}

@Node("Exam")
@Getter
@Setter
class Exam {
    @Id
    private String id = UUID.randomUUID().toString();
    private String name;
}

@Node("Paper")
@Getter
@Setter
class Paper {
    @Id
    private String id = UUID.randomUUID().toString();
    private String examId;
    private String name;
    private int sortOrder;
}

@Node("Topic")
@Getter
@Setter
class Topic {
    @Id
    private String id = UUID.randomUUID().toString();
    private String paperId;
    private String title;
    /** 1 = Foundation, 2 = Expansion, 3 = Mastery. */
    private int tier = 1;
    private int weightage;
    private List<String> chapterTitles = new ArrayList<>();
}

/** One statutory handbook per topic; the book id equals the topic id. */
@Node("Book")
@Getter
@Setter
class Book {
    @Id
    private String id;
    private String markdown;
}

@Node("Mcq")
@Getter
@Setter
class Mcq {
    @Id
    private String id = UUID.randomUUID().toString();
    private String topicId;
    private String question;
    private String optionA;
    private String optionB;
    private String optionC;
    private String optionD;
    /** A, B, C or D. */
    private String correct;
    private String explanation;
    private String citation;
}

/** The lower-cased word is the id, which makes duplicate detection a simple existence check. */
@Node("DictionaryEntry")
@Getter
@Setter
class DictionaryEntry {
    @Id
    private String word;
    private String definition;
    private String translation;
    private String legalContext;
}
