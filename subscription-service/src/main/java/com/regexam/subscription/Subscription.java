package com.regexam.subscription;

import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "subscription")
@Getter
@Setter
public class Subscription {
    public enum Status { PENDING, ACTIVE, REJECTED, FROZEN }

    @Id
    private String id = UUID.randomUUID().toString();
    private String userId;
    private String userEmail;
    private String userName;
    private String userMobile;
    private String userOffice;
    private String planId;
    private String planName;
    private String examId;
    private String utr;
    private Status status = Status.PENDING;
    private Instant submittedAt = Instant.now();
    private Instant activatedAt;
    private Instant expiresAt;
    private Instant frozenAt;
    @Column(columnDefinition = "text")
    private String adminNote;
}
