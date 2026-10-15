package com.regexam.assessment;

import java.util.List;
import org.springframework.data.neo4j.repository.Neo4jRepository;

interface PracticeRecordRepository extends Neo4jRepository<PracticeRecord, String> {
    List<PracticeRecord> findByUserId(String userId);
}

interface TestAttemptRepository extends Neo4jRepository<TestAttempt, String> {
    List<TestAttempt> findByUserId(String userId);
}

interface TierPolicyRepository extends Neo4jRepository<TierPolicy, String> {
}

interface TierUnlockRepository extends Neo4jRepository<TierUnlock, String> {
    List<TierUnlock> findByUserId(String userId);
}

interface TicketRepository extends Neo4jRepository<Ticket, String> {
    List<Ticket> findByUserId(String userId);
}
