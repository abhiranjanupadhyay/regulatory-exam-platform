package com.regexam.gateway;

import com.regexam.common.security.Headers;
import com.regexam.common.security.JwtService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

/**
 * Single entry point for authentication: verifies the JWT, enforces the single-device rule by checking the
 * token's session id against user-service, enforces admin paths, and forwards identity as trusted headers.
 */
@Component
public class AuthFilter implements GlobalFilter, Ordered {

    static final String DISPLACED_MESSAGE =
            "Session Displaced: This account has been logged in on another device. "
                    + "Your session here has been deactivated.";

    private static final Set<String> PUBLIC_PATHS = Set.of(
            "/api/auth/login", "/api/auth/register", "/api/auth/invite/validate");

    private final JwtService jwt;
    private final WebClient userService;

    public AuthFilter(JwtService jwt, @Value("${services.user.url}") String userServiceUrl) {
        this.jwt = jwt;
        this.userService = WebClient.create(userServiceUrl);
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getURI().getPath();

        if (request.getMethod() == HttpMethod.OPTIONS) {
            return chain.filter(exchange);
        }
        if (path.startsWith("/api/internal")) {
            return reject(exchange, HttpStatus.NOT_FOUND, "NOT_FOUND", "Not found");
        }
        if (PUBLIC_PATHS.contains(path) || path.startsWith("/actuator")) {
            return chain.filter(exchange);
        }

        String auth = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (auth == null || !auth.startsWith("Bearer ")) {
            return reject(exchange, HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Missing bearer token");
        }
        Claims claims;
        try {
            claims = jwt.parse(auth.substring(7));
        } catch (JwtException | IllegalArgumentException e) {
            return reject(exchange, HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid or expired token");
        }
        String role = claims.get("role", String.class);
        if (path.startsWith("/api/admin") && !"ADMIN".equals(role)) {
            return reject(exchange, HttpStatus.FORBIDDEN, "FORBIDDEN", "Admin access required");
        }

        return userService.get()
                .uri("/api/internal/sessions/{userId}/{sid}", claims.getSubject(), claims.get("sid", String.class))
                .retrieve()
                .bodyToMono(Map.class)
                .map(body -> Boolean.TRUE.equals(body.get("valid")))
                .onErrorReturn(false)
                .flatMap(valid -> {
                    if (!valid) {
                        return reject(exchange, HttpStatus.UNAUTHORIZED, "SESSION_DISPLACED", DISPLACED_MESSAGE);
                    }
                    ServerHttpRequest identified = request.mutate().headers(h -> {
                        h.set(Headers.USER_ID, claims.getSubject());
                        h.set(Headers.USER_EMAIL, claims.get("email", String.class));
                        h.set(Headers.USER_NAME, URLEncoder.encode(
                                String.valueOf(claims.get("name", String.class)), StandardCharsets.UTF_8));
                        h.set(Headers.USER_ROLE, role);
                    }).build();
                    return chain.filter(exchange.mutate().request(identified).build());
                });
    }

    private Mono<Void> reject(ServerWebExchange exchange, HttpStatus status, String code, String message) {
        exchange.getResponse().setStatusCode(status);
        exchange.getResponse().getHeaders().setContentType(MediaType.APPLICATION_JSON);
        String json = "{\"code\":\"" + code + "\",\"message\":\"" + message + "\"}";
        DataBuffer buffer = exchange.getResponse().bufferFactory().wrap(json.getBytes(StandardCharsets.UTF_8));
        return exchange.getResponse().writeWith(Mono.just(buffer));
    }

    @Override
    public int getOrder() {
        return -1;
    }
}
