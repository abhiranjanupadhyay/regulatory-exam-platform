package com.regexam;

import com.regexam.common.security.Headers;
import com.regexam.common.security.JwtService;
import com.regexam.user.AuthService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Enumeration;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Single entry point for authentication: verifies the JWT, enforces the single-device rule by checking the
 * token's session id, enforces admin paths, and exposes the identity as trusted headers to the controllers.
 */
@Component
public class AuthFilter extends OncePerRequestFilter {

    static final String DISPLACED_MESSAGE =
            "Session Displaced: This account has been logged in on another device. "
                    + "Your session here has been deactivated.";

    private static final Set<String> PUBLIC_PATHS = Set.of(
            "/api/auth/login", "/api/auth/register", "/api/auth/invite/validate");

    private final JwtService jwt;
    private final AuthService auth;

    public AuthFilter(JwtService jwt, AuthService auth) {
        this.jwt = jwt;
        this.auth = auth;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return "OPTIONS".equals(request.getMethod()) || !request.getRequestURI().startsWith("/api");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String path = request.getRequestURI();

        if (path.startsWith("/api/internal")) {
            reject(response, HttpStatus.NOT_FOUND, "NOT_FOUND", "Not found");
            return;
        }
        if (PUBLIC_PATHS.contains(path)) {
            // Never trust client-supplied identity headers.
            chain.doFilter(new IdentityRequest(request, new TreeMap<>(String.CASE_INSENSITIVE_ORDER)), response);
            return;
        }

        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header == null || !header.startsWith("Bearer ")) {
            reject(response, HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Missing bearer token");
            return;
        }
        Claims claims;
        try {
            claims = jwt.parse(header.substring(7));
        } catch (JwtException | IllegalArgumentException e) {
            reject(response, HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid or expired token");
            return;
        }
        String role = claims.get("role", String.class);
        if (path.startsWith("/api/admin") && !"ADMIN".equals(role)) {
            reject(response, HttpStatus.FORBIDDEN, "FORBIDDEN", "Admin access required");
            return;
        }
        String sid = claims.get("sid", String.class);
        if (sid == null || !auth.isSessionValid(claims.getSubject(), sid)) {
            reject(response, HttpStatus.UNAUTHORIZED, "SESSION_DISPLACED", DISPLACED_MESSAGE);
            return;
        }

        Map<String, String> identity = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
        identity.put(Headers.USER_ID, claims.getSubject());
        identity.put(Headers.USER_EMAIL, claims.get("email", String.class));
        identity.put(Headers.USER_NAME, URLEncoder.encode(
                String.valueOf(claims.get("name", String.class)), StandardCharsets.UTF_8));
        identity.put(Headers.USER_ROLE, role);
        chain.doFilter(new IdentityRequest(request, identity), response);
    }

    private static void reject(HttpServletResponse response, HttpStatus status, String code, String message)
            throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write("{\"code\":\"" + code + "\",\"message\":\"" + message + "\"}");
    }

    /** Replaces the X-User-* headers with the verified identity (or hides them when none is given). */
    private static final class IdentityRequest extends HttpServletRequestWrapper {
        private static final Set<String> IDENTITY_HEADERS = Set.of(
                Headers.USER_ID.toLowerCase(), Headers.USER_EMAIL.toLowerCase(),
                Headers.USER_NAME.toLowerCase(), Headers.USER_ROLE.toLowerCase());

        private final Map<String, String> identity;

        IdentityRequest(HttpServletRequest request, Map<String, String> identity) {
            super(request);
            this.identity = identity;
        }

        @Override
        public String getHeader(String name) {
            return IDENTITY_HEADERS.contains(name.toLowerCase()) ? identity.get(name) : super.getHeader(name);
        }

        @Override
        public Enumeration<String> getHeaders(String name) {
            if (!IDENTITY_HEADERS.contains(name.toLowerCase())) {
                return super.getHeaders(name);
            }
            String value = identity.get(name);
            return value == null ? Collections.emptyEnumeration() : Collections.enumeration(java.util.List.of(value));
        }

        @Override
        public Enumeration<String> getHeaderNames() {
            java.util.List<String> names = new java.util.ArrayList<>();
            for (String n : Collections.list(super.getHeaderNames())) {
                if (!IDENTITY_HEADERS.contains(n.toLowerCase())) {
                    names.add(n);
                }
            }
            names.addAll(identity.keySet());
            return Collections.enumeration(names);
        }
    }
}
