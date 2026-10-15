package com.regexam.subscription;

import java.util.List;
import org.springframework.data.neo4j.repository.Neo4jRepository;

interface PlanRepository extends Neo4jRepository<Plan, String> {
}

interface PaymentConfigRepository extends Neo4jRepository<PaymentConfig, String> {
}

interface SubscriptionRepository extends Neo4jRepository<Subscription, String> {
    List<Subscription> findByUserId(String userId);
}
