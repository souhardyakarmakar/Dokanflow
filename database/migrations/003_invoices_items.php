<?php
declare(strict_types=1);

return static function (PDO $pdo): void {
    $pdo->exec(<<<'SQL'
CREATE TABLE invoices (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    business_id BIGINT UNSIGNED NOT NULL,
    customer_id BIGINT UNSIGNED NOT NULL,
    order_id BIGINT UNSIGNED NULL,
    invoice_number VARCHAR(40) NOT NULL,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'issued',
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    gst_enabled TINYINT(1) NOT NULL DEFAULT 1,
    discount_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    subtotal DECIMAL(15,2) NOT NULL,
    discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(15,2) NOT NULL,
    business_snapshot JSON NOT NULL,
    customer_snapshot JSON NOT NULL,
    created_by_user_id BIGINT UNSIGNED NULL,
    issued_at TIMESTAMP NULL DEFAULT NULL,
    voided_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_invoices_public_id (public_id),
    UNIQUE KEY uq_invoices_business_number (business_id, invoice_number),
    UNIQUE KEY uq_invoices_business_id (business_id, id),
    UNIQUE KEY uq_invoices_business_order (business_id, order_id),
    KEY idx_invoices_business_customer_date (business_id, customer_id, issue_date),
    KEY idx_invoices_business_due_status (business_id, due_date, status),
    CONSTRAINT chk_invoices_status CHECK (status IN ('draft', 'issued', 'void')),
    CONSTRAINT chk_invoices_amounts CHECK (subtotal >= 0 AND discount_amount >= 0 AND tax_amount >= 0 AND total_amount >= 0),
    CONSTRAINT chk_invoices_discount_rate CHECK (discount_rate >= 0 AND discount_rate <= 100),
    CONSTRAINT chk_invoices_due_date CHECK (due_date >= issue_date),
    CONSTRAINT fk_invoices_business FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE RESTRICT,
    CONSTRAINT fk_invoices_customer FOREIGN KEY (business_id, customer_id) REFERENCES customers (business_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_invoices_order_customer FOREIGN KEY (business_id, order_id, customer_id) REFERENCES orders (business_id, id, customer_id) ON DELETE RESTRICT,
    CONSTRAINT fk_invoices_creator FOREIGN KEY (business_id, created_by_user_id) REFERENCES business_members (business_id, user_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL);

    $pdo->exec(<<<'SQL'
CREATE TABLE invoice_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    business_id BIGINT UNSIGNED NOT NULL,
    invoice_id BIGINT UNSIGNED NOT NULL,
    line_number SMALLINT UNSIGNED NOT NULL,
    description VARCHAR(500) NOT NULL,
    quantity DECIMAL(12,3) NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    gst_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    line_subtotal DECIMAL(15,2) NOT NULL,
    discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    taxable_amount DECIMAL(15,2) NOT NULL,
    tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    line_total DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_invoice_items_public_id (public_id),
    UNIQUE KEY uq_invoice_items_business_line (business_id, invoice_id, line_number),
    KEY idx_invoice_items_business_invoice (business_id, invoice_id),
    CONSTRAINT chk_invoice_items_quantity CHECK (quantity > 0),
    CONSTRAINT chk_invoice_items_unit_price CHECK (unit_price >= 0),
    CONSTRAINT chk_invoice_items_gst CHECK (gst_rate >= 0 AND gst_rate <= 100),
    CONSTRAINT chk_invoice_items_amounts CHECK (line_subtotal >= 0 AND discount_amount >= 0 AND taxable_amount >= 0 AND tax_amount >= 0 AND line_total >= 0),
    CONSTRAINT fk_invoice_items_invoice FOREIGN KEY (business_id, invoice_id) REFERENCES invoices (business_id, id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL);
};
