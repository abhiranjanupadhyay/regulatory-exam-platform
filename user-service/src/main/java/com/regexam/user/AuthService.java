package com.regexam.user;

import com.regexam.common.security.JwtService;
import com.regexam.common.web.ApiException;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    public record RegisterRequest(
            @NotBlank String idToken,
            @NotBlank String inviteCode,
            @NotNull @Min(18) @Max(70) Integer age,
            @NotBlank @Pattern(regexp = "\\d{10}", message = "must be a 10 digit number") String mobile,
            @NotBlank String designation,
            String designationOther,
            @NotBlank String station,
            @NotBlank String office,
            @AssertTrue(message = "must be confirmed") boolean detailsGenuine,
            @AssertTrue(message = "must be confirmed") boolean authorizedEmployee) {
    }

    public record LoginRequest(@NotBlank String idToken) {
    }

    public record UserView(String id, String email, String name, String role, Integer age, String mobile,
                           String designation, String station, String office) {
        static UserView of(AppUser u) {
            return new UserView(u.getId(), u.getEmail(), u.getName(), u.getRole(), u.getAge(), u.getMobile(),
                    u.getDesignation(), u.getStation(), u.getOffice());
        }
    }

    public record AuthResponse(String token, UserView user) {
    }

    private final AppUserRepository users;
    private final InviteCodeRepository invites;
    private final GoogleTokenVerifier google;
    private final JwtService jwt;

    @Value("${app.admin-emails:}")
    private List<String> adminEmails;

    public boolean isInviteUsable(String code) {
        return code != null && invites.findById(code.trim().toUpperCase(Locale.ROOT))
                .map(InviteCode::isActive).orElse(false);
    }

    public AuthResponse register(RegisterRequest req) {
        InviteCode invite = invites.findById(req.inviteCode().trim().toUpperCase(Locale.ROOT))
                .filter(InviteCode::isActive)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INVITE",
                        "Invalid or already used invite code."));
        GoogleTokenVerifier.GoogleIdentity identity = google.verify(req.idToken());
        if (users.findByEmail(identity.email()).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "ALREADY_REGISTERED", "User already registered. Kindly login.");
        }
        if (users.findByMobile(req.mobile()).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "MOBILE_IN_USE", "This mobile number is already registered.");
        }

        AppUser user = new AppUser();
        user.setEmail(identity.email());
        user.setName(identity.name());
        user.setRole(roleFor(identity.email()));
        user.setAge(req.age());
        user.setMobile(req.mobile());
        user.setDesignation("Other".equalsIgnoreCase(req.designation()) && req.designationOther() != null
                ? req.designationOther().trim() : req.designation());
        user.setStation(req.station().trim());
        user.setOffice(req.office().trim());
        AuthResponse response = startSession(user);

        invite.setActive(false);
        invite.setRedeemedBy(user.getEmail());
        invite.setRedeemedAt(Instant.now());
        invites.save(invite);
        return response;
    }

    public AuthResponse login(LoginRequest req) {
        GoogleTokenVerifier.GoogleIdentity identity = google.verify(req.idToken());
        AppUser user = users.findByEmail(identity.email()).orElseGet(() -> {
            if (!isAdminEmail(identity.email())) {
                throw new ApiException(HttpStatus.NOT_FOUND, "NOT_REGISTERED",
                        "Account does not exist. Kindly register first.");
            }
            AppUser admin = new AppUser();
            admin.setEmail(identity.email());
            admin.setName(identity.name());
            admin.setRole("ADMIN");
            return admin;
        });
        return startSession(user);
    }

    /** A new session id replaces the previous one, which displaces any other device. */
    private AuthResponse startSession(AppUser user) {
        user.setCurrentSessionId(UUID.randomUUID().toString());
        users.save(user);
        String token = jwt.issue(user.getId(), user.getEmail(), user.getName(), user.getRole(),
                user.getCurrentSessionId());
        return new AuthResponse(token, UserView.of(user));
    }

    public boolean isSessionValid(String userId, String sid) {
        return users.findById(userId).map(u -> sid.equals(u.getCurrentSessionId())).orElse(false);
    }

    private String roleFor(String email) {
        return isAdminEmail(email) ? "ADMIN" : "STUDENT";
    }

    private boolean isAdminEmail(String email) {
        return adminEmails.stream().anyMatch(a -> a.trim().equalsIgnoreCase(email));
    }
}
