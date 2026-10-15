package com.regexam.assessment;

import com.regexam.common.web.ApiException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class TierService {

    public record TierStatus(int tier, boolean unlocked, String unlockedBy, Integer previousTierCoveragePct,
                             Integer coverageRequiredPct, Integer qualifyingScorePct, Instant retryAvailableAt,
                             boolean canAttemptQualifier) {
    }

    private final TierPolicyRepository policies;
    private final TierUnlockRepository unlocks;
    private final PracticeRecordRepository practice;
    private final TestAttemptRepository attempts;
    private final ContentClient content;

    TierPolicy policy() {
        return policies.findById(TierPolicy.ID).orElseGet(TierPolicy::new);
    }

    TierPolicy savePolicy(TierPolicy in) {
        if (in.getCoverageRequiredPct() < 0 || in.getCoverageRequiredPct() > 100
                || in.getQualifyingScorePct() < 0 || in.getQualifyingScorePct() > 100
                || in.getCooldownHours() < 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Percentages must be 0-100 and cooldown cannot be negative");
        }
        TierPolicy p = policy();
        p.setCoverageRequiredPct(in.getCoverageRequiredPct());
        p.setQualifyingScorePct(in.getQualifyingScorePct());
        p.setCooldownHours(in.getCooldownHours());
        p.setTier2UnlockDate(in.getTier2UnlockDate());
        p.setTier3UnlockDate(in.getTier3UnlockDate());
        p.setUniversalOverride(in.isUniversalOverride());
        return policies.save(p);
    }

    /** Unlocked by: universal override, a passed scheduled date, a qualifying pass, or a manual admin unlock. */
    String unlockReason(String userId, int tier, TierPolicy policy) {
        if (tier <= 1) {
            return "DEFAULT";
        }
        if (policy.isUniversalOverride()) {
            return "OVERRIDE";
        }
        Instant scheduled = tier == 2 ? policy.getTier2UnlockDate() : policy.getTier3UnlockDate();
        if (scheduled != null && !scheduled.isAfter(Instant.now())) {
            return "SCHEDULED";
        }
        return unlocks.findById(userId + ":" + tier).map(TierUnlock::getReason).orElse(null);
    }

    public boolean isUnlocked(String userId, int tier) {
        return unlockReason(userId, tier, policy()) != null;
    }

    int coveragePct(String userId, String examId, int tier) {
        List<String> ids = content.mcqIds(examId, tier);
        if (ids.isEmpty()) {
            return 100;
        }
        Set<String> practised = practice.findByUserId(userId).stream()
                .map(PracticeRecord::getMcqId).collect(Collectors.toCollection(HashSet::new));
        practised.retainAll(ids);
        return practised.size() * 100 / ids.size();
    }

    /** End of the cooldown after the latest failed qualifying exam for this tier, or null. */
    Instant retryAvailableAt(String userId, int tier, TierPolicy policy) {
        return attempts.findByUserId(userId).stream()
                .filter(a -> "QUALIFYING".equals(a.getMode()) && a.getTargetTier() == tier
                        && "SUBMITTED".equals(a.getStatus()) && !a.isPassed())
                .map(TestAttempt::getSubmittedAt)
                .max(Instant::compareTo)
                .map(t -> t.plus(Duration.ofHours(policy.getCooldownHours())))
                .filter(t -> t.isAfter(Instant.now()))
                .orElse(null);
    }

    public List<TierStatus> status(String userId, String examId) {
        TierPolicy policy = policy();
        List<TierStatus> out = new ArrayList<>();
        out.add(new TierStatus(1, true, "DEFAULT", null, null, null, null, false));
        for (int tier = 2; tier <= 3; tier++) {
            String reason = unlockReason(userId, tier, policy);
            if (reason != null) {
                out.add(new TierStatus(tier, true, reason, null, null, null, null, false));
                continue;
            }
            int coverage = coveragePct(userId, examId, tier - 1);
            Instant retry = retryAvailableAt(userId, tier, policy);
            // A tier can only be attempted once the one below it is open.
            boolean previousOpen = isUnlocked(userId, tier - 1);
            out.add(new TierStatus(tier, false, null, coverage, policy.getCoverageRequiredPct(),
                    policy.getQualifyingScorePct(), retry,
                    previousOpen && coverage >= policy.getCoverageRequiredPct() && retry == null));
        }
        return out;
    }

    void unlockManually(String userId, int tier, String reason) {
        TierUnlock u = new TierUnlock();
        u.setId(userId + ":" + tier);
        u.setUserId(userId);
        u.setTier(tier);
        u.setReason(reason);
        unlocks.save(u);
    }
}
