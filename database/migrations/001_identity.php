<?php
declare(strict_types=1);

return static function (PDO $pdo): void {
    $pdo->exec(<<<'SQL'
CREATE TABLE users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    phone VARCHAR(32) NULL,
    email VARCHAR(254) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    email_verified_at TIMESTAMP NULL DEFAULT NULL,
    last_login_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_public_id (public_id),
    UNIQUE KEY uq_users_email (email),
    CONSTRAINT chk_users_status CHECK (status IN ('active', 'pending', 'suspended'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL);

    $pdo->exec(<<<'SQL'
CREATE TABLE businesses (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    slug VARCHAR(100) NOT NULL,
    name VARCHAR(160) NOT NULL,
    legal_name VARCHAR(180) NULL,
    email VARCHAR(254) NULL,
    phone VARCHAR(32) NULL,
    address_line VARCHAR(255) NULL,
    city VARCHAR(100) NULL,
    state VARCHAR(100) NULL,
    postal_code VARCHAR(16) NULL,
    country_code CHAR(2) NOT NULL DEFAULT 'IN',
    gstin VARCHAR(20) NULL,
    gst_registered TINYINT(1) NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_businesses_public_id (public_id),
    UNIQUE KEY uq_businesses_slug (slug),
    UNIQUE KEY uq_businesses_gstin (gstin),
    CONSTRAINT chk_businesses_status CHECK (status IN ('active', 'suspended', 'closed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL);

    $pdo->exec(<<<'SQL'
CREATE TABLE business_members (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    role VARCHAR(24) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    invited_by_user_id BIGINT UNSIGNED NULL,
    invited_at TIMESTAMP NULL DEFAULT NULL,
    accepted_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_business_members_business_user (business_id, user_id),
    KEY idx_business_members_user_status (user_id, status),
    CONSTRAINT chk_business_members_role CHECK (role IN ('owner', 'administrator', 'manager', 'staff')),
    CONSTRAINT chk_business_members_status CHECK (status IN ('invited', 'active', 'suspended', 'removed')),
    CONSTRAINT fk_business_members_business FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE RESTRICT,
    CONSTRAINT fk_business_members_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT fk_business_members_inviter FOREIGN KEY (business_id, invited_by_user_id) REFERENCES business_members (business_id, user_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL);

    $pdo->exec(<<<'SQL'
CREATE TABLE business_settings (
    business_id BIGINT UNSIGNED NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
    locale VARCHAR(16) NOT NULL DEFAULT 'en-IN',
    default_gst_rate DECIMAL(5,2) NOT NULL DEFAULT 18.00,
    invoice_prefix VARCHAR(20) NOT NULL DEFAULT 'INV',
    next_invoice_number BIGINT UNSIGNED NOT NULL DEFAULT 1,
    payment_terms_days SMALLINT UNSIGNED NOT NULL DEFAULT 15,
    invoice_footer VARCHAR(500) NULL,
    notifications_enabled TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (business_id),
    CONSTRAINT chk_business_settings_gst CHECK (default_gst_rate >= 0 AND default_gst_rate <= 100),
    CONSTRAINT fk_business_settings_business FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL);
};
