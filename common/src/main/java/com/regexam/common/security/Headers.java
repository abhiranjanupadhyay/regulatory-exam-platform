package com.regexam.common.security;

/** Identity headers set by the gateway after JWT + session validation. Services trust them. */
public final class Headers {
    public static final String USER_ID = "X-User-Id";
    public static final String USER_EMAIL = "X-User-Email";
    public static final String USER_NAME = "X-User-Name";
    public static final String USER_ROLE = "X-User-Role";

    private Headers() {
    }
}
