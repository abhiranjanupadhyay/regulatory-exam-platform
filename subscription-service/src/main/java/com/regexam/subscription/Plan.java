package com.regexam.subscription;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "plan")
@Getter
@Setter
public class Plan {
    @Id
    private String id = UUID.randomUUID().toString();
    private String name;
    private String examId;
    private long priceInr;
    private int durationDays;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<String> features = new ArrayList<>();
    private boolean active = true;
}
