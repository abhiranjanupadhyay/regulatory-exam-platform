package com.regexam;

import com.regexam.common.security.JwtService;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** One deployable for user, subscription, content and assessment; authentication lives in {@link AuthFilter}. */
@SpringBootApplication
public class Application implements WebMvcConfigurer {

    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }

    @Bean
    JwtService jwtService(@Value("${app.jwt.secret}") String secret,
                          @Value("${app.jwt.ttl-hours:12}") long ttlHours) {
        return new JwtService(secret, Duration.ofHours(ttlHours));
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**").allowedOriginPatterns("*").allowedMethods("*").allowedHeaders("*");
    }
}
