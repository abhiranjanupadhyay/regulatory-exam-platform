package com.regexam.user;

import java.time.Instant;
import lombok.Getter;
import lombok.Setter;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "invite_code")
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
