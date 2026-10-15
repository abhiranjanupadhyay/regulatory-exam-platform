package com.regexam.user;

import com.regexam.common.security.UserContext;
import com.regexam.common.web.ApiException;
import jakarta.validation.Valid;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class UserController {

    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    public record InviteView(String code, String createdBy, Instant createdAt, String redeemedBy,
                             Instant redeemedAt, String status, String shareMessage) {
    }

    private final AuthService auth;
    private final AppUserRepository users;
    private final InviteCodeRepository invites;

    @Value("${app.public-url:http://localhost:3000}")
    private String publicUrl;

    // ---- public auth ----

    @PostMapping("/auth/register")
    public AuthService.AuthResponse register(@Valid @RequestBody AuthService.RegisterRequest req) {
        return auth.register(req);
    }

    @PostMapping("/auth/login")
    public AuthService.AuthResponse login(@Valid @RequestBody AuthService.LoginRequest req) {
        return auth.login(req);
    }

    @PostMapping("/auth/invite/validate")
    public Map<String, Boolean> validateInvite(@RequestBody Map<String, String> body) {
        return Map.of("valid", auth.isInviteUsable(body.get("code")));
    }

    // ---- authenticated ----

    /** Doubles as the heartbeat the client polls: the gateway answers 401 SESSION_DISPLACED if displaced. */
    @GetMapping("/users/me")
    public AuthService.UserView me(UserContext user) {
        return users.findById(user.id()).map(AuthService.UserView::of)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found"));
    }

    // ---- admin ----

    @PostMapping("/admin/invites")
    public InviteView generateInvite(UserContext user) {
        user.requireAdmin();
        InviteCode invite = new InviteCode();
        invite.setCode(randomCode());
        invite.setCreatedBy(user.email());
        return view(invites.save(invite));
    }

    @GetMapping("/admin/invites")
    public List<InviteView> listInvites(UserContext user) {
        user.requireAdmin();
        return invites.findAll().stream()
                .sorted(Comparator.comparing(InviteCode::getCreatedAt).reversed())
                .map(this::view).toList();
    }

    @GetMapping("/admin/users")
    public List<AuthService.UserView> listUsers(UserContext user, @RequestParam(required = false) String q) {
        user.requireAdmin();
        String needle = q == null ? "" : q.toLowerCase(Locale.ROOT);
        return users.findAll().stream()
                .filter(u -> needle.isEmpty() || contains(u.getName(), needle) || contains(u.getEmail(), needle)
                        || contains(u.getOffice(), needle) || contains(u.getMobile(), needle))
                .map(AuthService.UserView::of).toList();
    }

    // ---- internal (not routed by the gateway) ----

    @GetMapping("/internal/sessions/{userId}/{sid}")
    public Map<String, Boolean> sessionValid(@PathVariable String userId, @PathVariable String sid) {
        return Map.of("valid", auth.isSessionValid(userId, sid));
    }

    @GetMapping("/internal/users/{id}")
    public AuthService.UserView byId(@PathVariable String id) {
        return users.findById(id).map(AuthService.UserView::of)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found"));
    }

    /** Find a student by email or 10-digit mobile number. */
    @GetMapping("/internal/users/lookup")
    public AuthService.UserView lookup(@RequestParam String q) {
        return users.findByEmail(q.trim().toLowerCase(Locale.ROOT))
                .or(() -> users.findByMobile(q.trim()))
                .map(AuthService.UserView::of)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "No student found for " + q));
    }

    private InviteView view(InviteCode c) {
        String message = "You are invited to the Regulatory Exam Preparation Platform. Register at " + publicUrl
                + " using invite code " + c.getCode() + ". The code works only once.";
        return new InviteView(c.getCode(), c.getCreatedBy(), c.getCreatedAt(), c.getRedeemedBy(),
                c.getRedeemedAt(), c.isActive() ? "ACTIVE" : "USED", message);
    }

    private static boolean contains(String value, String needle) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(needle);
    }

    private static String randomCode() {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 8; i++) {
            sb.append(CODE_ALPHABET.charAt(RANDOM.nextInt(CODE_ALPHABET.length())));
        }
        return sb.toString();
    }
}
