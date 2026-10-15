package com.regexam.content;

import java.util.Collection;
import java.util.List;
import org.springframework.data.neo4j.repository.Neo4jRepository;

interface ExamRepository extends Neo4jRepository<Exam, String> {
}

interface PaperRepository extends Neo4jRepository<Paper, String> {
    List<Paper> findByExamId(String examId);
}

interface TopicRepository extends Neo4jRepository<Topic, String> {
    List<Topic> findByPaperId(String paperId);

    List<Topic> findByPaperIdIn(Collection<String> paperIds);
}

interface BookRepository extends Neo4jRepository<Book, String> {
}

interface McqRepository extends Neo4jRepository<Mcq, String> {
    List<Mcq> findByTopicId(String topicId);

    List<Mcq> findByTopicIdIn(Collection<String> topicIds);

    long countByTopicId(String topicId);
}

interface DictionaryRepository extends Neo4jRepository<DictionaryEntry, String> {
}
