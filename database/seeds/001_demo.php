<?php
declare(strict_types=1);

namespace DokanFlow\Database\Seeds;

use DokanFlow\Support\Environment;
use Closure;
use DateTimeImmutable;
use DateTimeZone;
use PDO;
use RuntimeException;
use Throwable;

return static function (PDO $pdo): void {
    $ownerName = Environment::required('DEMO_OWNER_NAME');
    $ownerEmail = strtolower(trim(Environment::required('DEMO_OWNER_EMAIL')));
    $ownerPassword = Environment::required('DEMO_OWNER_PASSWORD');
    if (filter_var($ownerEmail, FILTER_VALIDATE_EMAIL) === false) {
        throw new RuntimeException('DEMO_OWNER_EMAIL must be a valid email address.');
    }
    if (strlen($ownerPassword) < 6 || strlen($ownerPassword) > 72) {
        throw new RuntimeException('DEMO_OWNER_PASSWORD must be between 6 and 72 characters.');
    }

    $invoiceDate = (new DateTimeImmutable('today', new DateTimeZone('Asia/Kolkata')))->modify('-10 days');
    $orderDate = $invoiceDate->modify('-8 days')->format('Y-m-d');
    $deliveryDate = $invoiceDate->format('Y-m-d');
    $dueDate = $invoiceDate->modify('+30 days')->format('Y-m-d');
    $paymentReceivedAt = $invoiceDate->modify('+5 days')->format('Y-m-d') . ' 09:00:00';
    $expenseDate = $invoiceDate->modify('-3 days')->format('Y-m-d');

    $uuid = static function (): string {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        $hex = bin2hex($bytes);

        return sprintf('%s-%s-%s-%s-%s', substr($hex, 0, 8), substr($hex, 8, 4), substr($hex, 12, 4), substr($hex, 16, 4), substr($hex, 20, 12));
    };

    $pdo->beginTransaction();
    try {
        $findUser = $pdo->prepare('SELECT id, status FROM users WHERE email = :email LIMIT 1');
        $findUser->execute(['email' => $ownerEmail]);
        $user = $findUser->fetch();
        if ($user === false) {
            $algorithm = defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_DEFAULT;
            $passwordHash = password_hash($ownerPassword, $algorithm);
            if ($passwordHash === false) {
                throw new RuntimeException('Unable to hash the development owner password.');
            }
            $insertUser = $pdo->prepare(
                'INSERT INTO users (public_id, full_name, email, password_hash) VALUES (:public_id, :full_name, :email, :password_hash)'
            );
            $insertUser->execute([
                'public_id' => $uuid(),
                'full_name' => $ownerName,
                'email' => $ownerEmail,
                'password_hash' => $passwordHash,
            ]);
            $userId = (int) $pdo->lastInsertId();
        } else {
            if ($user['status'] !== 'active') {
                throw new RuntimeException('The configured development owner account is not active.');
            }
            $userId = (int) $user['id'];
        }

        $findBusiness = $pdo->prepare('SELECT id FROM businesses WHERE slug = :slug LIMIT 1');
        $findBusiness->execute(['slug' => 'dokanflow-local-demo']);
        $businessId = $findBusiness->fetchColumn();
        if ($businessId === false) {
            $insertBusiness = $pdo->prepare(
                'INSERT INTO businesses (public_id, slug, name, legal_name, email, phone, address_line, city, state, postal_code, gstin, gst_registered) VALUES (:public_id, :slug, :name, :legal_name, :email, :phone, :address_line, :city, :state, :postal_code, :gstin, 1)'
            );
            $insertBusiness->execute([
                'public_id' => $uuid(),
                'slug' => 'dokanflow-local-demo',
                'name' => 'DokanFlow Demo Studio',
                'legal_name' => 'DokanFlow Demo Studio',
                'email' => $ownerEmail,
                'phone' => '+91 98290 11234',
                'address_line' => '14, Johari Bazaar Road',
                'city' => 'Jaipur',
                'state' => 'Rajasthan',
                'postal_code' => '302003',
                'gstin' => '08ABCDE1234F1Z5',
            ]);
            $businessId = (int) $pdo->lastInsertId();
        } else {
            $businessId = (int) $businessId;
        }

        $findMembership = $pdo->prepare(
            'SELECT role, status FROM business_members WHERE business_id = :business_id AND user_id = :user_id LIMIT 1'
        );
        $findMembership->execute(['business_id' => $businessId, 'user_id' => $userId]);
        $membership = $findMembership->fetch();
        if ($membership === false) {
            $insertMembership = $pdo->prepare(
                'INSERT INTO business_members (business_id, user_id, role, status, accepted_at) VALUES (:business_id, :user_id, \'owner\', \'active\', CURRENT_TIMESTAMP)'
            );
            $insertMembership->execute(['business_id' => $businessId, 'user_id' => $userId]);
        } elseif ($membership['role'] !== 'owner' || $membership['status'] !== 'active') {
            throw new RuntimeException('The configured development owner is not an active owner of the demo business.');
        }

        $findSettings = $pdo->prepare('SELECT business_id FROM business_settings WHERE business_id = :business_id');
        $findSettings->execute(['business_id' => $businessId]);
        if ($findSettings->fetchColumn() === false) {
            $insertSettings = $pdo->prepare(
                'INSERT INTO business_settings (business_id, invoice_prefix, next_invoice_number) VALUES (:business_id, \'DEMO\', 2)'
            );
            $insertSettings->execute(['business_id' => $businessId]);
        }

        $customer = findOrCreateCustomer($pdo, $uuid, $businessId, $userId, [
            'name' => 'Asha Stationery',
            'email' => 'asha@sample.invalid',
            'phone' => '+91 90000 00001',
            'city' => 'Jaipur',
        ]);
        findOrCreateCustomer($pdo, $uuid, $businessId, $userId, [
            'name' => 'Ravi Electricals',
            'email' => 'ravi@sample.invalid',
            'phone' => '+91 90000 00002',
            'city' => 'Jaipur',
        ]);

        $order = findOrCreateOrder($pdo, $uuid, $businessId, $customer, $userId, $orderDate, $deliveryDate);
        $invoice = findOrCreateInvoice($pdo, $uuid, $businessId, $customer, $order, $userId, $invoiceDate, $dueDate);
        findOrCreatePayment($pdo, $uuid, $businessId, $invoice, $userId, $paymentReceivedAt);
        findOrCreateExpense($pdo, $uuid, $businessId, $userId, $expenseDate);
        findOrCreateReminder($pdo, $uuid, $businessId, $invoice, $userId);

        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
};

function findOrCreateCustomer(PDO $pdo, Closure $uuid, int $businessId, int $userId, array $customer): int
{
    $find = $pdo->prepare('SELECT id FROM customers WHERE business_id = :business_id AND email = :email LIMIT 1');
    $find->execute(['business_id' => $businessId, 'email' => $customer['email']]);
    $id = $find->fetchColumn();
    if ($id !== false) {
        return (int) $id;
    }

    $insert = $pdo->prepare(
        'INSERT INTO customers (public_id, business_id, name, customer_type, phone, email, city, state, created_by_user_id) VALUES (:public_id, :business_id, :name, \'business\', :phone, :email, :city, \'Rajasthan\', :created_by_user_id)'
    );
    $insert->execute([
        'public_id' => $uuid(),
        'business_id' => $businessId,
        'name' => $customer['name'],
        'phone' => $customer['phone'],
        'email' => $customer['email'],
        'city' => $customer['city'],
        'created_by_user_id' => $userId,
    ]);

    return (int) $pdo->lastInsertId();
}

function findOrCreateOrder(PDO $pdo, Closure $uuid, int $businessId, int $customerId, int $userId, string $orderDate, string $deliveryDate): int
{
    $find = $pdo->prepare('SELECT id FROM orders WHERE business_id = :business_id AND order_number = :order_number LIMIT 1');
    $find->execute(['business_id' => $businessId, 'order_number' => 'DEMO-ORD-1001']);
    $id = $find->fetchColumn();
    if ($id !== false) {
        return (int) $id;
    }

    $insert = $pdo->prepare(
        'INSERT INTO orders (public_id, business_id, customer_id, order_number, service_description, estimated_amount, order_date, expected_delivery_date, status, notes, created_by_user_id) VALUES (:public_id, :business_id, :customer_id, \'DEMO-ORD-1001\', \'Shop lighting repair\', 5900.00, :order_date, :delivery_date, \'delivered\', \'Demo seed order\', :created_by_user_id)'
    );
    $insert->execute([
        'public_id' => $uuid(),
        'business_id' => $businessId,
        'customer_id' => $customerId,
        'order_date' => $orderDate,
        'delivery_date' => $deliveryDate,
        'created_by_user_id' => $userId,
    ]);

    return (int) $pdo->lastInsertId();
}

function findOrCreateInvoice(PDO $pdo, Closure $uuid, int $businessId, int $customerId, int $orderId, int $userId, DateTimeImmutable $invoiceDate, string $dueDate): int
{
    $invoiceNumber = 'DEMO-INV-LOCAL-001';
    $find = $pdo->prepare('SELECT id FROM invoices WHERE business_id = :business_id AND invoice_number = :invoice_number LIMIT 1');
    $find->execute(['business_id' => $businessId, 'invoice_number' => $invoiceNumber]);
    $id = $find->fetchColumn();
    if ($id !== false) {
        return (int) $id;
    }

    $businessSnapshot = json_encode([
        'name' => 'DokanFlow Demo Studio',
        'address' => '14, Johari Bazaar Road, Jaipur, Rajasthan 302003',
        'gstin' => '08ABCDE1234F1Z5',
    ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
    $customerSnapshot = json_encode([
        'name' => 'Asha Stationery',
        'phone' => '+91 90000 00001',
        'address' => 'Jaipur, Rajasthan',
    ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
    $insert = $pdo->prepare(
        'INSERT INTO invoices (public_id, business_id, customer_id, order_id, invoice_number, issue_date, due_date, status, currency, gst_enabled, discount_rate, subtotal, discount_amount, tax_amount, total_amount, business_snapshot, customer_snapshot, created_by_user_id, issued_at) VALUES (:public_id, :business_id, :customer_id, :order_id, :invoice_number, :issue_date, :due_date, \'issued\', \'INR\', 1, 0.00, 5000.00, 0.00, 900.00, 5900.00, :business_snapshot, :customer_snapshot, :created_by_user_id, :issued_at)'
    );
    $insert->execute([
        'public_id' => $uuid(),
        'business_id' => $businessId,
        'customer_id' => $customerId,
        'order_id' => $orderId,
        'invoice_number' => $invoiceNumber,
        'issue_date' => $invoiceDate->format('Y-m-d'),
        'due_date' => $dueDate,
        'business_snapshot' => $businessSnapshot,
        'customer_snapshot' => $customerSnapshot,
        'created_by_user_id' => $userId,
        'issued_at' => $invoiceDate->format('Y-m-d') . ' 10:00:00',
    ]);
    $invoiceId = (int) $pdo->lastInsertId();

    $insertItem = $pdo->prepare(
        'INSERT INTO invoice_items (public_id, business_id, invoice_id, line_number, description, quantity, unit_price, gst_rate, line_subtotal, discount_amount, taxable_amount, tax_amount, line_total) VALUES (:public_id, :business_id, :invoice_id, 1, \'Repair parts and labour\', 1.000, 5000.00, 18.00, 5000.00, 0.00, 5000.00, 900.00, 5900.00)'
    );
    $insertItem->execute([
        'public_id' => $uuid(),
        'business_id' => $businessId,
        'invoice_id' => $invoiceId,
    ]);

    return $invoiceId;
}

function findOrCreatePayment(PDO $pdo, Closure $uuid, int $businessId, int $invoiceId, int $userId, string $receivedAt): void
{
    $find = $pdo->prepare('SELECT id FROM payments WHERE business_id = :business_id AND idempotency_key = :idempotency_key LIMIT 1');
    $find->execute(['business_id' => $businessId, 'idempotency_key' => 'local-seed-payment-1001']);
    if ($find->fetchColumn() !== false) {
        return;
    }

    $insert = $pdo->prepare(
        'INSERT INTO payments (public_id, business_id, invoice_id, amount, method, status, reference, idempotency_key, received_at, recorded_by_user_id) VALUES (:public_id, :business_id, :invoice_id, 2500.00, \'upi\', \'captured\', \'DEMO-UPI-1001\', \'local-seed-payment-1001\', :received_at, :recorded_by_user_id)'
    );
    $insert->execute([
        'public_id' => $uuid(),
        'business_id' => $businessId,
        'invoice_id' => $invoiceId,
        'received_at' => $receivedAt,
        'recorded_by_user_id' => $userId,
    ]);
}

function findOrCreateExpense(PDO $pdo, Closure $uuid, int $businessId, int $userId, string $expenseDate): void
{
    $find = $pdo->prepare('SELECT id FROM expenses WHERE business_id = :business_id AND idempotency_key = :idempotency_key LIMIT 1');
    $find->execute(['business_id' => $businessId, 'idempotency_key' => 'local-seed-expense-1001']);
    if ($find->fetchColumn() !== false) {
        return;
    }

    $insert = $pdo->prepare(
        'INSERT INTO expenses (public_id, business_id, category, amount, expense_date, method, description, idempotency_key, recorded_by_user_id) VALUES (:public_id, :business_id, \'supplies\', 850.00, :expense_date, \'cash\', \'Packaging and delivery materials\', \'local-seed-expense-1001\', :recorded_by_user_id)'
    );
    $insert->execute([
        'public_id' => $uuid(),
        'business_id' => $businessId,
        'expense_date' => $expenseDate,
        'recorded_by_user_id' => $userId,
    ]);
}

function findOrCreateReminder(PDO $pdo, Closure $uuid, int $businessId, int $invoiceId, int $userId): void
{
    $find = $pdo->prepare('SELECT id FROM reminders WHERE business_id = :business_id AND idempotency_key = :idempotency_key LIMIT 1');
    $find->execute(['business_id' => $businessId, 'idempotency_key' => 'local-seed-reminder-1001']);
    if ($find->fetchColumn() !== false) {
        return;
    }

    $insert = $pdo->prepare(
        'INSERT INTO reminders (public_id, business_id, invoice_id, channel, status, message_text, idempotency_key, created_by_user_id) VALUES (:public_id, :business_id, :invoice_id, \'whatsapp\', \'prepared\', \'Demo reminder: please review invoice DEMO-INV-LOCAL-001. This message has not been sent.\', \'local-seed-reminder-1001\', :created_by_user_id)'
    );
    $insert->execute([
        'public_id' => $uuid(),
        'business_id' => $businessId,
        'invoice_id' => $invoiceId,
        'created_by_user_id' => $userId,
    ]);
}
