package com.regexam.subscription;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface PlanRepository extends JpaRepository<Plan, String> {
}

interface PaymentConfigRepository extends JpaRepository<PaymentConfig, String> {
}

interface SubscriptionRepository extends JpaRepository<Subscription, String> {
    List<Subscription> findByUserId(String userId);
}
