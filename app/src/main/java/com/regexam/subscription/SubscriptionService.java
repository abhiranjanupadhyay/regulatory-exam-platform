package com.regexam.subscription;

import com.regexam.common.security.UserContext;
import com.regexam.common.web.ApiException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import com.regexam.user.AppUser;
import com.regexam.user.AppUserRepository;

@Service
public class SubscriptionService {

    /** Alert threshold for the amber validity badge. */
    public static final int EXPIRY_WARNING_DAYS = 5;

    public record View(String id, String userId, String userEmail, String userName, String userOffice,
                       String planId, String planName, String examId, String utr, String status,
                       Instant submittedAt, Instant expiresAt, long daysRemaining, boolean expiringSoon,
                       String adminNote) {
    }

    public record SubmitResult(View subscription, String whatsappUrl) {
    }

    public record PaymentInfo(PaymentConfig config, String upiUri) {
    }

    private final SubscriptionRepository subscriptions;
    private final PlanRepository plans;
    private final PaymentConfigRepository paymentConfigs;
    private final AppUserRepository users;

    public SubscriptionService(SubscriptionRepository subscriptions, PlanRepository plans,
                               PaymentConfigRepository paymentConfigs, AppUserRepository users) {
        this.subscriptions = subscriptions;
        this.plans = plans;
        this.paymentConfigs = paymentConfigs;
        this.users = users;
    }

    // ---- student ----

    public SubmitResult submit(UserContext user, String planId, String utr) {
        if (utr == null || !utr.matches("\\d{12}")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "UTR must be a 12 digit number");
        }
        Plan plan = plans.findById(planId).filter(Plan::isActive)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Plan not found"));
        boolean alreadyPending = subscriptions.findByUserId(user.id()).stream()
                .anyMatch(s -> s.getPlanId().equals(planId) && s.getStatus() == Subscription.Status.PENDING);
        if (alreadyPending) {
            throw new ApiException(HttpStatus.CONFLICT, "A payment for this plan is already pending approval");
        }
        AppUser profile = users.findById(user.id()).orElse(null);

        Subscription sub = new Subscription();
        sub.setUserId(user.id());
        sub.setUserEmail(user.email());
        sub.setUserName(user.name());
        sub.setUserMobile(profile == null ? null : profile.getMobile());
        sub.setUserOffice(profile == null ? null : profile.getOffice());
        sub.setPlanId(plan.getId());
        sub.setPlanName(plan.getName());
        sub.setExamId(plan.getExamId());
        sub.setUtr(utr);
        subscriptions.save(sub);

        String text = "Hello, I have paid for a plan.\nName: " + user.name() + "\nEmail: " + user.email()
                + "\nPlan: " + plan.getName() + "\nUTR: " + utr;
        String whatsapp = "https://wa.me/" + paymentConfig().getWhatsappNumber()
                + "?text=" + URLEncoder.encode(text, StandardCharsets.UTF_8);
        return new SubmitResult(view(sub), whatsapp);
    }

    public List<View> mine(String userId) {
        return subscriptions.findByUserId(userId).stream()
                .sorted(Comparator.comparing(Subscription::getSubmittedAt).reversed())
                .map(this::view).toList();
    }

    public PaymentInfo paymentInfo(String planId) {
        PaymentConfig cfg = paymentConfig();
        String upi = null;
        if (planId != null && !cfg.getUpiId().isBlank()) {
            Plan plan = plans.findById(planId)
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Plan not found"));
            upi = "upi://pay?pa=" + enc(cfg.getUpiId()) + "&pn=" + enc(cfg.getAccountName())
                    + "&am=" + plan.getPriceInr() + "&cu=INR&tn=" + enc(plan.getName());
        }
        return new PaymentInfo(cfg, upi);
    }

    // ---- admin ----

    public List<View> roster(String status, String q) {
        String needle = q == null ? "" : q.toLowerCase(Locale.ROOT);
        return subscriptions.findAll().stream()
                .map(this::view)
                .filter(v -> status == null || status.isBlank() || matchesFilter(v.status(), status))
                .filter(v -> needle.isEmpty() || contains(v.userName(), needle) || contains(v.userEmail(), needle)
                        || contains(v.userOffice(), needle) || contains(v.utr(), needle))
                .sorted(Comparator.comparing(View::submittedAt).reversed())
                .toList();
    }

    public View approve(String id) {
        Subscription s = get(id);
        Plan plan = plans.findById(s.getPlanId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Plan no longer exists"));
        Instant now = Instant.now();
        s.setStatus(Subscription.Status.ACTIVE);
        s.setActivatedAt(now);
        s.setExpiresAt(now.plus(plan.getDurationDays(), ChronoUnit.DAYS));
        s.setFrozenAt(null);
        return view(subscriptions.save(s));
    }

    public View reject(String id, String note) {
        Subscription s = get(id);
        s.setStatus(Subscription.Status.REJECTED);
        s.setAdminNote(note);
        return view(subscriptions.save(s));
    }

    public View freeze(String id) {
        Subscription s = get(id);
        if (s.getStatus() != Subscription.Status.ACTIVE) {
            throw new ApiException(HttpStatus.CONFLICT, "Only an active plan can be frozen");
        }
        s.setStatus(Subscription.Status.FROZEN);
        s.setFrozenAt(Instant.now());
        return view(subscriptions.save(s));
    }

    /** Pushes the expiry out by the time spent frozen so the student loses no days. */
    public View unfreeze(String id) {
        Subscription s = get(id);
        if (s.getStatus() != Subscription.Status.FROZEN) {
            throw new ApiException(HttpStatus.CONFLICT, "Plan is not frozen");
        }
        s.setExpiresAt(s.getExpiresAt().plus(Duration.between(s.getFrozenAt(), Instant.now())));
        s.setStatus(Subscription.Status.ACTIVE);
        s.setFrozenAt(null);
        return view(subscriptions.save(s));
    }

    public View extend(String id, Integer days, LocalDate until) {
        Subscription s = get(id);
        if (s.getExpiresAt() == null) {
            throw new ApiException(HttpStatus.CONFLICT, "Plan has not been approved yet");
        }
        if (until != null) {
            s.setExpiresAt(until.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC));
        } else if (days != null && days > 0) {
            Instant base = s.getExpiresAt().isAfter(Instant.now()) ? s.getExpiresAt() : Instant.now();
            s.setExpiresAt(base.plus(days, ChronoUnit.DAYS));
        } else {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Provide days or a custom date");
        }
        return view(subscriptions.save(s));
    }

    public PaymentConfig paymentConfig() {
        return paymentConfigs.findById(PaymentConfig.ID).orElseGet(PaymentConfig::new);
    }

    public PaymentConfig savePaymentConfig(PaymentConfig in) {
        PaymentConfig cfg = paymentConfig();
        cfg.setUpiId(in.getUpiId());
        cfg.setAccountName(in.getAccountName());
        cfg.setSupportEmail(in.getSupportEmail());
        cfg.setWhatsappNumber(in.getWhatsappNumber() == null ? "" : in.getWhatsappNumber().replaceAll("\\D", ""));
        return paymentConfigs.save(cfg);
    }

    // ---- helpers ----

    private Subscription get(String id) {
        return subscriptions.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Subscription not found"));
    }

    /** ACTIVE past its expiry is reported as EXPIRED; a frozen plan's clock is stopped at the freeze time. */
    View view(Subscription s) {
        Instant now = Instant.now();
        String status = s.getStatus().name();
        long days = 0;
        if (s.getExpiresAt() != null) {
            Instant clock = s.getStatus() == Subscription.Status.FROZEN ? s.getFrozenAt() : now;
            days = Math.max(0, (long) Math.ceil(Duration.between(clock, s.getExpiresAt()).toSeconds() / 86400.0));
            if (s.getStatus() == Subscription.Status.ACTIVE && !s.getExpiresAt().isAfter(now)) {
                status = "EXPIRED";
            }
        }
        boolean soon = "ACTIVE".equals(status) && days <= EXPIRY_WARNING_DAYS;
        return new View(s.getId(), s.getUserId(), s.getUserEmail(), s.getUserName(), s.getUserOffice(),
                s.getPlanId(), s.getPlanName(), s.getExamId(), s.getUtr(), status, s.getSubmittedAt(),
                s.getExpiresAt(), days, soon, s.getAdminNote());
    }

    private static boolean matchesFilter(String status, String filter) {
        return switch (filter.toUpperCase(Locale.ROOT)) {
            case "ACTIVE" -> status.equals("ACTIVE");
            case "PENDING" -> status.equals("PENDING");
            case "INACTIVE" -> !status.equals("ACTIVE") && !status.equals("PENDING");
            default -> status.equals(filter.toUpperCase(Locale.ROOT));
        };
    }

    private static boolean contains(String value, String needle) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(needle);
    }

    private static String enc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8).replace("+", "%20");
    }
}
