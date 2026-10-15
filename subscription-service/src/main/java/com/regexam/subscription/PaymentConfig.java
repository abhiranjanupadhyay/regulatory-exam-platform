package com.regexam.subscription;

import lombok.Getter;
import lombok.Setter;
import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;

/** Singleton settings node (fixed id). */
@Node("PaymentConfig")
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
