package com.regexam.assessment;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;

final class Models {
    private Models() {
    }
}

/** Latest practice outcome of one student on one question (id = userId:mcqId). */
@Node("PracticeRecord")
@Getter
@Setter
class PracticeRecord {
    @Id
    private String id;
    private String userId;
    private String mcqId;
    private String topicId;
    private boolean correct;
    private int attempts;
    private Instant answeredAt = Instant.now();
}

@Node("TestAttempt")
@Getter
@Setter
class TestAttempt {
    @Id
    private String id = UUID.randomUUID().toString();
    private String userId;
    /** FULL, TOPIC or QUALIFYING. */
    private String mode;
    private String examId;
    private String scopeLabel;
    /** For QUALIFYING: the tier this attempt unlocks (2 or 3); otherwise 0. */
    private int targetTier;
    private Instant startedAt = Instant.now();
    private Instant endsAt;
    private int durationMinutes;
    private Instant submittedAt;
    /** IN_PROGRESS or SUBMITTED. */
    private String status = "IN_PROGRESS";
    // Parallel lists, one entry per question. "" in responses means unanswered.
    private List<String> questionIds = new ArrayList<>();
    private List<String> topicIds = new ArrayList<>();
    private List<String> answerKey = new ArrayList<>();
    private List<String> responses = new ArrayList<>();
    private int correctCount;
    private int wrongCount;
    private int unansweredCount;
    private double negativeMarks;
    private double score;
    private double percentage;
    private boolean passed;
}

/** Singleton policy node (fixed id). */
@Node("TierPolicy")
@Getter
@Setter
class TierPolicy {
    static final String ID = "default";

    @Id
    private String id = ID;
    /** Share of the previous tier's MCQs that must be practised before the qualifying exam. */
    private int coverageRequiredPct = 80;
    private int qualifyingScorePct = 50;
    private int cooldownHours = 48;
    private Instant tier2UnlockDate;
    private Instant tier3UnlockDate;
    private boolean universalOverride;
}

@Node("TierUnlock")
@Getter
@Setter
class TierUnlock {
    @Id
    private String id;
    private String userId;
    private int tier;
    /** QUALIFIED or MANUAL. */
    private String reason;
    private Instant unlockedAt = Instant.now();
}

@Node("Ticket")
@Getter
@Setter
class Ticket {
    @Id
    private String id = UUID.randomUUID().toString();
    private String userId;
    private String userEmail;
    private String mcqId;
    private String question;
    private String citation;
    private String remarks;
    /** OPEN, RESOLVED or REJECTED. */
    private String status = "OPEN";
    private String adminReply;
    private Instant createdAt = Instant.now();
    private Instant resolvedAt;
}
