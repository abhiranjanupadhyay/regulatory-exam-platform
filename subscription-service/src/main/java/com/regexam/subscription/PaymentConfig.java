package com.regexam.subscription;

import lombok.Getter;
import lombok.Setter;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Singleton settings node (fixed id). */
@Entity
@Table(name = "payment_config")
@Getter
@Setter
public class PaymentConfig {
    public static final String ID = "default";

    @Id
    private String id = ID;
    private String upiId = "";
    private String accountName = "";
    private String supportEmail = "";
    /** Digits only with country code, e.g. 919876543210. */
    private String whatsappNumber = "";
}
