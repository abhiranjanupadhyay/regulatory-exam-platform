package com.regexam.subscription;

import com.regexam.common.security.UserContext;
import com.regexam.common.web.ApiException;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class SubscriptionController {

    public record SubmitRequest(String planId, String utr) {
    }

    public record ExtendRequest(Integer days, LocalDate until) {
    }

    private final SubscriptionService service;
    private final PlanRepository plans;

    // ---- student ----

    @GetMapping("/plans")
    public List<Plan> plans(@RequestParam(required = false) String examId) {
        return plans.findAll().stream()
                .filter(Plan::isActive)
                .filter(p -> examId == null || examId.equals(p.getExamId()))
                .sorted(Comparator.comparingLong(Plan::getPriceInr))
                .toList();
    }

    @GetMapping("/payment-config")
    public SubscriptionService.PaymentInfo paymentInfo(UserContext user, @RequestParam(required = false) String planId) {
        return service.paymentInfo(planId);
    }

    @PostMapping("/subscriptions")
    public SubscriptionService.SubmitResult submit(UserContext user, @RequestBody SubmitRequest req) {
        return service.submit(user, req.planId(), req.utr());
    }

    /** The paywall check: the client redirects to the payment screen when no entry is ACTIVE. */
    @GetMapping("/subscriptions/me")
    public Map<String, Object> mine(UserContext user) {
        List<SubscriptionService.View> all = service.mine(user.id());
        return Map.of(
                "subscriptions", all,
                "hasActivePlan", all.stream().anyMatch(v -> v.status().equals("ACTIVE")),
                "hasPending", all.stream().anyMatch(v -> v.status().equals("PENDING")));
    }

    // ---- admin ----

    @GetMapping("/admin/subscriptions")
    public List<SubscriptionService.View> roster(UserContext user, @RequestParam(required = false) String status,
                                                 @RequestParam(required = false) String q) {
        user.requireAdmin();
        return service.roster(status, q);
    }

    @PostMapping("/admin/subscriptions/{id}/approve")
    public SubscriptionService.View approve(UserContext user, @PathVariable String id) {
        user.requireAdmin();
        return service.approve(id);
    }

    @PostMapping("/admin/subscriptions/{id}/reject")
    public SubscriptionService.View reject(UserContext user, @PathVariable String id,
                                           @RequestBody(required = false) Map<String, String> body) {
        user.requireAdmin();
        return service.reject(id, body == null ? null : body.get("note"));
    }

    @PostMapping("/admin/subscriptions/{id}/freeze")
    public SubscriptionService.View freeze(UserContext user, @PathVariable String id) {
        user.requireAdmin();
        return service.freeze(id);
    }

    @PostMapping("/admin/subscriptions/{id}/unfreeze")
    public SubscriptionService.View unfreeze(UserContext user, @PathVariable String id) {
        user.requireAdmin();
        return service.unfreeze(id);
    }

    @PostMapping("/admin/subscriptions/{id}/extend")
    public SubscriptionService.View extend(UserContext user, @PathVariable String id, @RequestBody ExtendRequest req) {
        user.requireAdmin();
        return service.extend(id, req.days(), req.until());
    }

    @GetMapping("/admin/payment-config")
    public PaymentConfig getPaymentConfig(UserContext user) {
        user.requireAdmin();
        return service.paymentConfig();
    }

    @PutMapping("/admin/payment-config")
    public PaymentConfig savePaymentConfig(UserContext user, @RequestBody PaymentConfig cfg) {
        user.requireAdmin();
        return service.savePaymentConfig(cfg);
    }

    @PostMapping("/admin/plans")
    public Plan createPlan(UserContext user, @RequestBody Plan plan) {
        user.requireAdmin();
        validate(plan);
        plan.setId(java.util.UUID.randomUUID().toString());
        return plans.save(plan);
    }

    @PutMapping("/admin/plans/{id}")
    public Plan updatePlan(UserContext user, @PathVariable String id, @RequestBody Plan plan) {
        user.requireAdmin();
        validate(plan);
        Plan existing = plans.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Plan not found"));
        existing.setName(plan.getName());
        existing.setExamId(plan.getExamId());
        existing.setPriceInr(plan.getPriceInr());
        existing.setDurationDays(plan.getDurationDays());
        existing.setFeatures(plan.getFeatures());
        existing.setActive(plan.isActive());
        return plans.save(existing);
    }

    /** Soft delete: existing subscriptions keep their plan name and expiry. */
    @DeleteMapping("/admin/plans/{id}")
    public void deactivatePlan(UserContext user, @PathVariable String id) {
        user.requireAdmin();
        plans.findById(id).ifPresent(p -> {
            p.setActive(false);
            plans.save(p);
        });
    }

    private static void validate(Plan p) {
        if (p.getName() == null || p.getName().isBlank() || p.getExamId() == null
                || p.getPriceInr() < 0 || p.getDurationDays() <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Plan needs a name, exam, price and a positive duration");
        }
    }
}
