package com.regexam.user;

import java.time.Instant;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;

@Node("InviteCode")
@Getter
@Setter
public class InviteCode {
    @Id
    private String code;
    private String createdBy;
    private Instant createdAt = Instant.now();
    private String redeemedBy;
    private Instant redeemedAt;
    private boolean active = true;
}
