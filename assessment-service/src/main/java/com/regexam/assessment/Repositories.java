package com.regexam.assessment;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface PracticeRecordRepository extends JpaRepository<PracticeRecord, String> {
    List<PracticeRecord> findByUserId(String userId);
}

interface TestAttemptRepository extends JpaRepository<TestAttempt, String> {
    List<TestAttempt> findByUserId(String userId);
}

interface TierPolicyRepository extends JpaRepository<TierPolicy, String> {
}

interface TierUnlockRepository extends JpaRepository<TierUnlock, String> {
    List<TierUnlock> findByUserId(String userId);
}

interface TicketRepository extends JpaRepository<Ticket, String> {
    List<Ticket> findByUserId(String userId);
}
