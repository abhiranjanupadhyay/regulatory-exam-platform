package com.regexam.user;

import com.regexam.common.web.ApiException;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class GoogleTokenVerifier {

    public record GoogleIdentity(String email, String name) {
    }

    private final String clientId;
    private final boolean devMode;
    private final RestClient http = RestClient.create();

    public GoogleTokenVerifier(@Value("${app.google.client-id:}") String clientId,
                               @Value("${app.google.dev-mode:false}") boolean devMode) {
        this.clientId = clientId;
        this.devMode = devMode;
    }

    /** In dev mode, a token of the form {@code dev:email|Full Name} is accepted without calling Google. */
    @SuppressWarnings("unchecked")
    public GoogleIdentity verify(String idToken) {
        if (devMode && idToken.startsWith("dev:")) {
            String[] parts = idToken.substring(4).split("\\|", 2);
            String email = parts[0].trim().toLowerCase();
            return new GoogleIdentity(email, parts.length > 1 ? parts[1].trim() : email);
        }
        try {
            Map<String, Object> info = http.get()
                    .uri("https://oauth2.googleapis.com/tokeninfo?id_token={t}", idToken)
                    .retrieve().body(Map.class);
            if (info == null || !clientId.equals(info.get("aud"))
                    || !"true".equals(String.valueOf(info.get("email_verified")))) {
                throw new ApiException(HttpStatus.UNAUTHORIZED, "Google sign-in could not be verified");
            }
            String email = String.valueOf(info.get("email")).toLowerCase();
            return new GoogleIdentity(email, String.valueOf(info.getOrDefault("name", email)));
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Google sign-in could not be verified");
        }
    }
}
