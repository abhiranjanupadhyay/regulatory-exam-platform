package com.regexam.user;

import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;

@Node("AppUser")
@Getter
@Setter
public class AppUser {
    @Id
    private String id = UUID.randomUUID().toString();
    private String email;
    private String name;
    private String role;
    private Integer age;
    private String mobile;
    private String designation;
    private String station;
    private String office;
    /** Only the session id stored here is accepted by the gateway: this is the single-device lock. */
    private String currentSessionId;
    private Instant createdAt = Instant.now();
}
