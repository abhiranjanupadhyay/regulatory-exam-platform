package com.regexam.content;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** Exam -> Paper -> Topic hierarchy is held by parent ids (examId / paperId / topicId). */
final class Models {
    private Models() {
    }
}

@Entity
@Table(name = "exam")
@Getter
@Setter
class Exam {
    @Id
    private String id = UUID.randomUUID().toString();
    private String name;
}

@Entity
@Table(name = "paper")
@Getter
@Setter
class Paper {
    @Id
    private String id = UUID.randomUUID().toString();
    private String examId;
    private String name;
    private int sortOrder;
}

@Entity
@Table(name = "topic")
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
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<String> chapterTitles = new ArrayList<>();
}

/** One statutory handbook per topic; the book id equals the topic id. */
@Entity
@Table(name = "book")
@Getter
@Setter
class Book {
    @Id
    private String id;
    @Column(columnDefinition = "text")
    private String markdown;
}

@Entity
@Table(name = "mcq")
@Getter
@Setter
class Mcq {
    @Id
    private String id = UUID.randomUUID().toString();
    private String topicId;
    @Column(columnDefinition = "text")
    private String question;
    private String optionA;
    private String optionB;
    private String optionC;
    private String optionD;
    /** A, B, C or D. */
    private String correct;
    @Column(columnDefinition = "text")
    private String explanation;
    @Column(columnDefinition = "text")
    private String citation;
}

/** The lower-cased word is the id, which makes duplicate detection a simple existence check. */
@Entity
@Table(name = "dictionary_entry")
@Getter
@Setter
class DictionaryEntry {
    @Id
    private String word;
    @Column(columnDefinition = "text")
    private String definition;
    @Column(columnDefinition = "text")
    private String translation;
    @Column(columnDefinition = "text")
    private String legalContext;
}
