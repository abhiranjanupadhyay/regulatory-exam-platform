package com.regexam.common.security;

import com.regexam.common.web.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import org.springframework.http.HttpStatus;

public record UserContext(String id, String email, String name, String role) {

    public static UserContext from(HttpServletRequest request) {
        String id = request.getHeader(Headers.USER_ID);
        if (id == null || id.isBlank()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Not authenticated");
        }
        String name = request.getHeader(Headers.USER_NAME);
        return new UserContext(id,
                request.getHeader(Headers.USER_EMAIL),
                name == null ? "" : URLDecoder.decode(name, StandardCharsets.UTF_8),
                request.getHeader(Headers.USER_ROLE));
    }

    public boolean isAdmin() {
        return "ADMIN".equals(role);
    }

    public UserContext requireAdmin() {
        if (!isAdmin()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Admin access required");
        }
        return this;
    }
}
