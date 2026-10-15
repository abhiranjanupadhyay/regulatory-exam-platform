package com.regexam.content;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface ExamRepository extends JpaRepository<Exam, String> {
}

interface PaperRepository extends JpaRepository<Paper, String> {
    List<Paper> findByExamId(String examId);
}

interface TopicRepository extends JpaRepository<Topic, String> {
    List<Topic> findByPaperId(String paperId);

    List<Topic> findByPaperIdIn(Collection<String> paperIds);
}

interface BookRepository extends JpaRepository<Book, String> {
}

interface McqRepository extends JpaRepository<Mcq, String> {
    List<Mcq> findByTopicId(String topicId);

    List<Mcq> findByTopicIdIn(Collection<String> topicIds);

    long countByTopicId(String topicId);
}

interface DictionaryRepository extends JpaRepository<DictionaryEntry, String> {
}
