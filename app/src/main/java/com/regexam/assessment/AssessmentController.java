package com.regexam.assessment;

import com.regexam.common.security.UserContext;
import com.regexam.common.web.ApiException;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.regexam.user.AppUser;
import com.regexam.user.AppUserRepository;

@RestController
@RequestMapping("/api")
public class AssessmentController {

    public record AnswerRequest(String mcqId, String choice) {
    }

    public record AnswersBody(Map<Integer, String> answers) {
    }

    public record TicketRequest(String mcqId, String remarks) {
    }

    public record TicketReply(String reply, String status) {
    }

    public record ManualUnlock(String identifier, int tier) {
    }

    private final PracticeService practice;
    private final TestService tests;
    private final DashboardService dashboards;
    private final TierService tiers;
    private final ContentClient content;
    private final TicketRepository tickets;
    private final AppUserRepository users;

    public AssessmentController(PracticeService practice, TestService tests, DashboardService dashboards,
                                TierService tiers, ContentClient content, TicketRepository tickets,
                                AppUserRepository users) {
        this.practice = practice;
        this.tests = tests;
        this.dashboards = dashboards;
        this.tiers = tiers;
        this.content = content;
        this.tickets = tickets;
        this.users = users;
    }

    // ---- practice (study table) ----

    @PostMapping("/practice/answer")
    public PracticeService.Feedback answer(UserContext user, @RequestBody AnswerRequest req) {
        return practice.answer(user.id(), req.mcqId(), req.choice());
    }

    @GetMapping("/practice/weak")
    public List<PracticeService.SafeQuestion> weak(UserContext user, @RequestParam String examId,
                                                   @RequestParam(defaultValue = "20") int limit) {
        return practice.weakQuestions(user.id(), examId, limit);
    }

    // ---- mock tests ----

    @PostMapping("/tests")
    public TestService.TestPaper start(UserContext user, @RequestBody TestService.StartRequest req) {
        return tests.start(user.id(), req);
    }

    @PutMapping("/tests/{id}/responses")
    public void save(UserContext user, @PathVariable String id, @RequestBody AnswersBody body) {
        tests.saveResponses(user.id(), id, body.answers());
    }

    @PostMapping("/tests/{id}/submit")
    public TestService.Result submit(UserContext user, @PathVariable String id,
                                     @RequestBody(required = false) AnswersBody body) {
        return tests.submit(user.id(), id, body == null ? null : body.answers());
    }

    @GetMapping("/tests/{id}/result")
    public TestService.Result result(UserContext user, @PathVariable String id) {
        return tests.result(user.id(), id);
    }

    @GetMapping("/tests")
    public List<TestService.Summary> history(UserContext user) {
        return tests.history(user.id());
    }

    // ---- dashboard & tiers ----

    @GetMapping("/dashboard")
    public DashboardService.Dashboard dashboard(UserContext user, @RequestParam String examId) {
        return dashboards.dashboard(user.id(), examId);
    }

    @GetMapping("/tiers/me")
    public List<TierService.TierStatus> myTiers(UserContext user, @RequestParam String examId) {
        return tiers.status(user.id(), examId);
    }

    // ---- support tickets ----

    @PostMapping("/tickets")
    public Ticket report(UserContext user, @RequestBody TicketRequest req) {
        if (req.remarks() == null || req.remarks().isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Remarks are required");
        }
        ContentClient.McqFull mcq = content.lookup(List.of(req.mcqId())).stream().findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Question not found"));
        Ticket t = new Ticket();
        t.setUserId(user.id());
        t.setUserEmail(user.email());
        t.setMcqId(mcq.id());
        t.setQuestion(mcq.question());
        t.setCitation(mcq.citation());
        t.setRemarks(req.remarks().trim());
        return tickets.save(t);
    }

    @GetMapping("/tickets/me")
    public List<Ticket> myTickets(UserContext user) {
        return tickets.findByUserId(user.id()).stream()
                .sorted(Comparator.comparing(Ticket::getCreatedAt).reversed()).toList();
    }

    // ---- admin ----

    @GetMapping("/admin/tickets")
    public List<Ticket> allTickets(UserContext user, @RequestParam(required = false) String status) {
        user.requireAdmin();
        return tickets.findAll().stream()
                .filter(t -> status == null || t.getStatus().equalsIgnoreCase(status))
                .sorted(Comparator.comparing(Ticket::getCreatedAt).reversed()).toList();
    }

    @PutMapping("/admin/tickets/{id}")
    public Ticket reply(UserContext user, @PathVariable String id, @RequestBody TicketReply body) {
        user.requireAdmin();
        String status = body.status() == null ? "" : body.status().toUpperCase(Locale.ROOT);
        if (!status.equals("RESOLVED") && !status.equals("REJECTED")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "status must be RESOLVED or REJECTED");
        }
        if (body.reply() == null || body.reply().isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "A reply is required");
        }
        Ticket t = tickets.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Ticket not found"));
        t.setAdminReply(body.reply().trim());
        t.setStatus(status);
        t.setResolvedAt(Instant.now());
        return tickets.save(t);
    }

    @GetMapping("/admin/tier-policy")
    public TierPolicy policy(UserContext user) {
        user.requireAdmin();
        return tiers.policy();
    }

    @PutMapping("/admin/tier-policy")
    public TierPolicy savePolicy(UserContext user, @RequestBody TierPolicy policy) {
        user.requireAdmin();
        return tiers.savePolicy(policy);
    }

    /** Unlock Tier 2 or 3 for one student, found by email or mobile number. */
    @PostMapping("/admin/tier-unlocks")
    public Map<String, Object> unlock(UserContext user, @RequestBody ManualUnlock req) {
        user.requireAdmin();
        if (req.tier() < 2 || req.tier() > 3) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "tier must be 2 or 3");
        }
        String q = req.identifier() == null ? "" : req.identifier().trim();
        AppUser student = users.findByEmail(q.toLowerCase(java.util.Locale.ROOT))
                .or(() -> users.findByMobile(q))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "No student found for " + req.identifier()));
        tiers.unlockManually(student.getId(), req.tier(), "MANUAL");
        return Map.of("email", student.getEmail(), "tier", req.tier(), "status", "UNLOCKED");
    }
}
