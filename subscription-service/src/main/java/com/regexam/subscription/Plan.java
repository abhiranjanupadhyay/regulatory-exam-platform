package com.regexam.subscription;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;

@Node("Plan")
@Getter
@Setter
public class Plan {
    @Id
    private String id = UUID.randomUUID().toString();
    private String name;
    private String examId;
    private long priceInr;
    private int durationDays;
    private List<String> features = new ArrayList<>();
    private boolean active = true;
}
