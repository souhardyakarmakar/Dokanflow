<?php
declare(strict_types=1);

return static function (PDO $pdo): void {
    $pdo->exec(<<<'SQL'
CREATE TABLE payments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    business_id BIGINT UNSIGNED NOT NULL,
    invoice_id BIGINT UNSIGNED NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    method VARCHAR(24) NOT NULL,
    status VARCHAR(16) NOT NULL,
    reference VARCHAR(120) NULL,
    provider VARCHAR(24) NULL,
    gateway_order_id VARCHAR(100) NULL,
    gateway_payment_id VARCHAR(100) NULL,
    idempotency_key VARCHAR(100) NULL,
    received_at TIMESTAMP NULL DEFAULT NULL,
    recorded_by_user_id BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_payments_public_id (public_id),
    UNIQUE KEY uq_payments_business_idempotency (business_id, idempotency_key),
    UNIQUE KEY uq_payments_gateway_order (provider, gateway_order_id),
    UNIQUE KEY uq_payments_gateway_payment (provider, gateway_payment_id),
    KEY idx_payments_business_invoice_status (business_id, invoice_id, status),
    KEY idx_payments_business_received (business_id, received_at),
    CONSTRAINT chk_payments_amount CHECK (amount > 0),
    CONSTRAINT chk_payments_method CHECK (method IN ('upi', 'cash', 'bank_transfer', 'card', 'razorpay', 'other')),
    CONSTRAINT chk_payments_status CHECK (status IN ('pending', 'captured', 'failed', 'refunded')),
    CONSTRAINT fk_payments_invoice FOREIGN KEY (business_id, invoice_id) REFERENCES invoices (business_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_payments_recorder FOREIGN KEY (business_id, recorded_by_user_id) REFERENCES business_members (business_id, user_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL);

    $pdo->exec(<<<'SQL'
CREATE TABLE expenses (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    business_id BIGINT UNSIGNED NOT NULL,
    category VARCHAR(24) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    expense_date DATE NOT NULL,
    method VARCHAR(24) NOT NULL,
    description VARCHAR(500) NOT NULL,
    idempotency_key VARCHAR(100) NULL,
    recorded_by_user_id BIGINT UNSIGNED NULL,
    archived_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_expenses_public_id (public_id),
    UNIQUE KEY uq_expenses_business_idempotency (business_id, idempotency_key),
    KEY idx_expenses_business_date_category (business_id, expense_date, category),
    CONSTRAINT chk_expenses_amount CHECK (amount > 0),
    CONSTRAINT chk_expenses_category CHECK (category IN ('rent', 'utilities', 'salaries', 'supplies', 'transport', 'marketing', 'other')),
    CONSTRAINT chk_expenses_method CHECK (method IN ('upi', 'cash', 'bank_transfer', 'card', 'other')),
    CONSTRAINT fk_expenses_business FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE RESTRICT,
    CONSTRAINT fk_expenses_recorder FOREIGN KEY (business_id, recorded_by_user_id) REFERENCES business_members (business_id, user_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL);

    $pdo->exec(<<<'SQL'
CREATE TABLE reminders (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    business_id BIGINT UNSIGNED NOT NULL,
    invoice_id BIGINT UNSIGNED NOT NULL,
    channel VARCHAR(16) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'prepared',
    message_text TEXT NOT NULL,
    idempotency_key VARCHAR(100) NULL,
    prepared_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP NULL DEFAULT NULL,
    created_by_user_id BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_reminders_public_id (public_id),
    UNIQUE KEY uq_reminders_business_idempotency (business_id, idempotency_key),
    KEY idx_reminders_business_invoice_prepared (business_id, invoice_id, prepared_at),
    CONSTRAINT chk_reminders_channel CHECK (channel IN ('whatsapp', 'sms', 'email')),
    CONSTRAINT chk_reminders_status CHECK (status IN ('draft', 'prepared', 'sent', 'failed')),
    CONSTRAINT fk_reminders_invoice FOREIGN KEY (business_id, invoice_id) REFERENCES invoices (business_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_reminders_creator FOREIGN KEY (business_id, created_by_user_id) REFERENCES business_members (business_id, user_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL);

    $pdo->exec(<<<'SQL'
CREATE TABLE password_resets (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP NULL DEFAULT NULL,
    request_ip_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_password_resets_token_hash (token_hash),
    KEY idx_password_resets_user_expiry (user_id, expires_at),
    CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL);

    $pdo->exec(<<<'SQL'
CREATE TABLE audit_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NULL,
    actor_user_id BIGINT UNSIGNED NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(64) NULL,
    entity_public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    ip_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    metadata JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_audit_logs_business_created (business_id, created_at),
    KEY idx_audit_logs_actor_created (actor_user_id, created_at),
    KEY idx_audit_logs_entity (business_id, entity_type, entity_public_id),
    CONSTRAINT fk_audit_logs_business FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE RESTRICT,
    CONSTRAINT fk_audit_logs_actor FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT fk_audit_logs_member FOREIGN KEY (business_id, actor_user_id) REFERENCES business_members (business_id, user_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL);

    $pdo->exec(<<<'SQL'
CREATE TABLE webhook_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NULL,
    provider VARCHAR(24) NOT NULL,
    event_id VARCHAR(191) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    payload JSON NOT NULL,
    signature_verified TINYINT(1) NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'received',
    attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL DEFAULT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_webhook_events_provider_event (provider, event_id),
    KEY idx_webhook_events_status_received (status, received_at),
    KEY idx_webhook_events_business (business_id, received_at),
    CONSTRAINT chk_webhook_events_status CHECK (status IN ('received', 'processing', 'processed', 'failed')),
    CONSTRAINT fk_webhook_events_business FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL);

    $pdo->exec(<<<'SQL'
CREATE TABLE auth_rate_limits (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    scope VARCHAR(32) NOT NULL,
    subject_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
    window_started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    blocked_until TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_auth_rate_limits_scope_subject (scope, subject_hash),
    KEY idx_auth_rate_limits_blocked_until (blocked_until),
    CONSTRAINT chk_auth_rate_limits_attempts CHECK (attempt_count >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL);
};
