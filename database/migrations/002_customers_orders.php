<?php
declare(strict_types=1);

return static function (PDO $pdo): void {
    $pdo->exec(<<<'SQL'
CREATE TABLE customers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    business_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(160) NOT NULL,
    customer_type VARCHAR(16) NOT NULL DEFAULT 'individual',
    phone VARCHAR(32) NULL,
    email VARCHAR(254) NULL,
    address_line VARCHAR(255) NULL,
    city VARCHAR(100) NULL,
    state VARCHAR(100) NULL,
    postal_code VARCHAR(16) NULL,
    credit_limit DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    notes TEXT NULL,
    archived_at TIMESTAMP NULL DEFAULT NULL,
    created_by_user_id BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_customers_public_id (public_id),
    UNIQUE KEY uq_customers_business_id (business_id, id),
    UNIQUE KEY uq_customers_business_email (business_id, email),
    KEY idx_customers_business_name (business_id, name),
    KEY idx_customers_business_phone (business_id, phone),
    KEY idx_customers_business_type (business_id, customer_type),
    CONSTRAINT chk_customers_type CHECK (customer_type IN ('individual', 'business')),
    CONSTRAINT chk_customers_credit_limit CHECK (credit_limit >= 0),
    CONSTRAINT fk_customers_business FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE RESTRICT,
    CONSTRAINT fk_customers_creator FOREIGN KEY (business_id, created_by_user_id) REFERENCES business_members (business_id, user_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL);

    $pdo->exec(<<<'SQL'
CREATE TABLE orders (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    business_id BIGINT UNSIGNED NOT NULL,
    customer_id BIGINT UNSIGNED NOT NULL,
    order_number VARCHAR(40) NOT NULL,
    service_description VARCHAR(500) NOT NULL,
    estimated_amount DECIMAL(15,2) NOT NULL,
    order_date DATE NOT NULL,
    expected_delivery_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'received',
    notes TEXT NULL,
    created_by_user_id BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_orders_public_id (public_id),
    UNIQUE KEY uq_orders_business_number (business_id, order_number),
    UNIQUE KEY uq_orders_business_id_customer (business_id, id, customer_id),
    KEY idx_orders_business_status_date (business_id, status, order_date),
    KEY idx_orders_business_customer (business_id, customer_id),
    KEY idx_orders_business_delivery (business_id, expected_delivery_date),
    CONSTRAINT chk_orders_status CHECK (status IN ('received', 'in_progress', 'ready', 'delivered', 'cancelled')),
    CONSTRAINT chk_orders_estimated_amount CHECK (estimated_amount >= 0),
    CONSTRAINT chk_orders_delivery_dates CHECK (expected_delivery_date >= order_date),
    CONSTRAINT fk_orders_business FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE RESTRICT,
    CONSTRAINT fk_orders_customer FOREIGN KEY (business_id, customer_id) REFERENCES customers (business_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_orders_creator FOREIGN KEY (business_id, created_by_user_id) REFERENCES business_members (business_id, user_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL);
};
