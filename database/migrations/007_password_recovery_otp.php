<?php
declare(strict_types=1);

return static function (PDO $pdo): void {
    $pdo->exec(<<<'SQL'
CREATE TABLE password_recovery_otps (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    challenge_ref CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    user_id BIGINT UNSIGNED NULL,
    email_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    otp_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    expires_at DATETIME NOT NULL,
    failed_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    sent_at DATETIME NOT NULL,
    verified_at DATETIME NULL DEFAULT NULL,
    reset_authorization_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    reset_authorization_expires_at DATETIME NULL DEFAULT NULL,
    consumed_at DATETIME NULL DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_password_recovery_challenge_ref (challenge_ref),
    KEY idx_password_recovery_email_created (email_hash, created_at),
    KEY idx_password_recovery_user_created (user_id, created_at),
    KEY idx_password_recovery_expiry (expires_at),
    CONSTRAINT chk_password_recovery_attempts CHECK (failed_attempts <= 5),
    CONSTRAINT fk_password_recovery_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL);
};
