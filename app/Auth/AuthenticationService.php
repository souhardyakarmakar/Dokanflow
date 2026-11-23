<?php
declare(strict_types=1);

namespace DokanFlow\Auth;

use DateTimeImmutable;
use DateTimeZone;
use DomainException;
use PDO;
use RuntimeException;
use Throwable;

final class AuthenticationService
{
    private const LOGIN_ATTEMPTS = 8;
    private const REGISTRATION_ATTEMPTS = 5;
    private const RATE_WINDOW_SECONDS = 900;

    public function __construct(
        private readonly PDO $pdo,
        private readonly string $appKey,
    ) {
        if (strlen($this->appKey) < 32) {
            throw new RuntimeException('APP_KEY must contain at least 32 characters.');
        }
    }

    /**
     * @return array<string, int|string>
     */
    public function register(string $name, string $businessName, string $email, string $password, string $ip): array
    {
        $name = $this->requiredText($name, 'Enter your name.', 120);
        $businessName = $this->requiredText($businessName, 'Enter your business name.', 160);
        $email = $this->normalizeEmail($email);
        $this->validatePassword($password);
        $this->consumeRateLimit('register', $email, $ip, self::REGISTRATION_ATTEMPTS, 3600);

        $this->pdo->beginTransaction();
        try {
            $algorithm = defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_DEFAULT;
            $passwordHash = password_hash($password, $algorithm);
            if ($passwordHash === false) {
                throw new RuntimeException('Password hashing failed.');
            }

            $insertUser = $this->pdo->prepare(
                'INSERT INTO users (public_id, full_name, email, password_hash, status) VALUES (:public_id, :full_name, :email, :password_hash, \'active\')'
            );
            $insertUser->execute([
                'public_id' => $this->uuid(),
                'full_name' => $name,
                'email' => $email,
                'password_hash' => $passwordHash,
            ]);
            $userId = (int) $this->pdo->lastInsertId();

            $businessId = $this->createBusiness($businessName, $email);
            $membership = $this->pdo->prepare(
                'INSERT INTO business_members (business_id, user_id, role, status, accepted_at) VALUES (:business_id, :user_id, \'owner\', \'active\', CURRENT_TIMESTAMP)'
            );
            $membership->execute(['business_id' => $businessId, 'user_id' => $userId]);

            $settings = $this->pdo->prepare(
                'INSERT INTO business_settings (business_id) VALUES (:business_id)'
            );
            $settings->execute(['business_id' => $businessId]);

            $this->writeAuditLog($businessId, $userId, 'account.registered');
            $identity = $this->identity($userId, $businessId);
            if ($identity === null) {
                throw new RuntimeException('New account identity could not be loaded.');
            }
            $this->clearRateLimit('register', $email, $ip);
            $this->pdo->commit();

            return $identity;
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            if ($error instanceof \PDOException && $error->getCode() === '23000') {
                throw new AuthenticationException('An account already uses that email address.');
            }
            throw $error;
        }
    }

    /**
     * @return array<string, int|string>
     */
    public function login(string $email, string $password, string $ip): array
    {
        $email = $this->normalizeEmail($email);
        $this->consumeRateLimit('login', $email, $ip, self::LOGIN_ATTEMPTS, self::RATE_WINDOW_SECONDS);

        $findUser = $this->pdo->prepare(
            'SELECT id, public_id, full_name, email, password_hash, status FROM users WHERE email = :email LIMIT 1'
        );
        $findUser->execute(['email' => $email]);
        $user = $findUser->fetch();

        if ($user === false) {
            static $dummyHash = null;
            $dummyHash ??= password_hash(bin2hex(random_bytes(24)), PASSWORD_DEFAULT);
            password_verify($password, $dummyHash);
            throw new AuthenticationException('Email or password is incorrect.');
        }

        if ($user['status'] !== 'active' || !password_verify($password, (string) $user['password_hash'])) {
            throw new AuthenticationException('Email or password is incorrect.');
        }

        $userId = (int) $user['id'];
        $businessId = $this->activeBusinessId($userId);

        if (password_needs_rehash((string) $user['password_hash'], defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_DEFAULT)) {
            $algorithm = defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_DEFAULT;
            $newHash = password_hash($password, $algorithm);
            if ($newHash === false) {
                throw new RuntimeException('Password rehash failed.');
            }
            $rehash = $this->pdo->prepare('UPDATE users SET password_hash = :password_hash WHERE id = :id');
            $rehash->execute(['password_hash' => $newHash, 'id' => $userId]);
        }

        $lastLogin = $this->pdo->prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = :id');
        $lastLogin->execute(['id' => $userId]);
        $this->clearRateLimit('login', $email, $ip);

        return $this->identity($userId, $businessId)
            ?? throw new AuthenticationException('Email or password is incorrect.');
    }

    /**
     * @return array<string, int|string>|null
     */
    public function currentIdentity(int $userId, int $businessId): ?array
    {
        return $this->identity($userId, $businessId);
    }

    public function updateProfile(int $userId, int $businessId, string $name, string $email, string $phone): array
    {
        $name = $this->requiredText($name, 'Enter your name.', 120);
        $email = $this->normalizeEmail($email);
        $phone = trim($phone);
        if (strlen($phone) > 32) {
            throw new DomainException('Enter a valid phone number.');
        }

        $this->pdo->beginTransaction();
        try {
            $userUpdate = $this->pdo->prepare(
                'UPDATE users SET full_name = :full_name, email = :email, phone = :phone WHERE id = :id'
            );
            $userUpdate->execute([
                'full_name' => $name,
                'email' => $email,
                'phone' => $phone === '' ? null : $phone,
                'id' => $userId,
            ]);

            $businessUpdate = $this->pdo->prepare(
                'UPDATE businesses SET email = :email, phone = :phone WHERE id = :id'
            );
            $businessUpdate->execute([
                'email' => $email,
                'phone' => $phone === '' ? null : $phone,
                'id' => $businessId,
            ]);

            $identity = $this->identity($userId, $businessId);
            if ($identity === null) {
                throw new RuntimeException('Updated account identity could not be loaded.');
            }
            $this->writeAuditLog($businessId, $userId, 'profile.updated');
            $this->pdo->commit();
            return $identity;
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            if ($error instanceof \PDOException && $error->getCode() === '23000') {
                throw new AuthenticationException('An account already uses that email address.');
            }
            throw $error;
        }
    }

    private function createBusiness(string $name, string $email): int
    {
        $asciiName = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $name);
        $slugBase = strtolower(trim(preg_replace('/[^a-zA-Z0-9]+/', '-', $asciiName === false ? $name : $asciiName) ?? '', '-'));
        $slug = substr($slugBase === '' ? 'business' : $slugBase, 0, 76) . '-' . bin2hex(random_bytes(6));

        $insert = $this->pdo->prepare(
            'INSERT INTO businesses (public_id, slug, name, email) VALUES (:public_id, :slug, :name, :email)'
        );
        $insert->execute([
            'public_id' => $this->uuid(),
            'slug' => $slug,
            'name' => $name,
            'email' => $email,
        ]);

        return (int) $this->pdo->lastInsertId();
    }

    /**
     * @return array<string, int|string>|null
     */
    private function identity(int $userId, int $businessId): ?array
    {
        $query = $this->pdo->prepare(
            'SELECT u.id, u.public_id, u.full_name, u.email, u.phone, bm.business_id, bm.role, b.public_id AS business_public_id, b.name AS business_name, bs.timezone, bs.locale FROM users u JOIN business_members bm ON bm.user_id = u.id JOIN businesses b ON b.id = bm.business_id LEFT JOIN business_settings bs ON bs.business_id = b.id WHERE u.id = :user_id AND bm.business_id = :business_id AND u.status = \'active\' AND bm.status = \'active\' AND b.status = \'active\' LIMIT 1'
        );
        $query->execute(['user_id' => $userId, 'business_id' => $businessId]);
        $identity = $query->fetch();

        if ($identity === false) {
            return null;
        }

        return [
            'user_id' => (int) $identity['id'],
            'user_public_id' => (string) $identity['public_id'],
            'name' => (string) $identity['full_name'],
            'email' => (string) $identity['email'],
            'phone' => $identity['phone'] === null ? '' : (string) $identity['phone'],
            'business_id' => (int) $identity['business_id'],
            'business_public_id' => (string) $identity['business_public_id'],
            'business_name' => (string) $identity['business_name'],
            'role' => (string) $identity['role'],
            'timezone' => $identity['timezone'] === null ? 'Asia/Kolkata' : (string) $identity['timezone'],
            'locale' => $identity['locale'] === null ? 'en-IN' : (string) $identity['locale'],
        ];
    }

    private function writeAuditLog(int $businessId, int $userId, string $action): void
    {
        $insert = $this->pdo->prepare(
            'INSERT INTO audit_logs (business_id, actor_user_id, action, request_id, ip_hash, metadata) VALUES (:business_id, :actor_user_id, :action, :request_id, :ip_hash, :metadata)'
        );
        $insert->execute([
            'business_id' => $businessId,
            'actor_user_id' => $userId,
            'action' => $action,
            'request_id' => $this->uuid(),
            'ip_hash' => hash_hmac('sha256', (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown'), $this->appKey),
            'metadata' => json_encode(['role' => 'owner'], JSON_THROW_ON_ERROR),
        ]);
    }

    private function activeBusinessId(int $userId): int
    {
        $membershipQuery = $this->pdo->prepare(
            'SELECT business_id FROM business_members WHERE user_id = :user_id AND status = \'active\' ORDER BY created_at ASC LIMIT 1'
        );
        $membershipQuery->execute(['user_id' => $userId]);
        $businessId = $membershipQuery->fetchColumn();
        if ($businessId === false) {
            throw new AuthenticationException('Email or password is incorrect.');
        }

        return (int) $businessId;
    }

    private function consumeRateLimit(string $scope, string $identifier, string $ip, int $limit, int $windowSeconds): void
    {
        $subjectHash = hash_hmac('sha256', $scope . "\0" . $identifier . "\0" . $ip, $this->appKey);
        $this->pdo->beginTransaction();
        try {
            $insert = $this->pdo->prepare(
                'INSERT IGNORE INTO auth_rate_limits (scope, subject_hash, attempt_count, window_started_at) VALUES (:scope, :subject_hash, 0, UTC_TIMESTAMP())'
            );
            $insert->execute(['scope' => $scope, 'subject_hash' => $subjectHash]);

            $find = $this->pdo->prepare(
                'SELECT attempt_count, window_started_at, blocked_until FROM auth_rate_limits WHERE scope = :scope AND subject_hash = :subject_hash FOR UPDATE'
            );
            $find->execute(['scope' => $scope, 'subject_hash' => $subjectHash]);
            $rate = $find->fetch();
            if ($rate === false) {
                throw new RuntimeException('Authentication rate limit could not be loaded.');
            }

            $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
            $blockedUntil = $rate['blocked_until'] === null
                ? null
                : new DateTimeImmutable((string) $rate['blocked_until'], new DateTimeZone('UTC'));
            if ($blockedUntil !== null && $blockedUntil > $now) {
                $this->pdo->commit();
                throw new AuthenticationException('Too many attempts. Please wait before trying again.');
            }

            $windowStartedAt = new DateTimeImmutable((string) $rate['window_started_at'], new DateTimeZone('UTC'));
            $attempts = $windowStartedAt->modify('+' . $windowSeconds . ' seconds') <= $now
                ? 0
                : (int) $rate['attempt_count'];
            if ($attempts >= $limit) {
                $blockedUntil = $now->modify('+' . $windowSeconds . ' seconds');
                $update = $this->pdo->prepare(
                    'UPDATE auth_rate_limits SET blocked_until = :blocked_until WHERE scope = :scope AND subject_hash = :subject_hash'
                );
                $update->execute([
                    'blocked_until' => $blockedUntil->format('Y-m-d H:i:s'),
                    'scope' => $scope,
                    'subject_hash' => $subjectHash,
                ]);
                $this->pdo->commit();
                throw new AuthenticationException('Too many attempts. Please wait before trying again.');
            }

            $nextWindowStart = $attempts === 0 ? $now : $windowStartedAt;
            $update = $this->pdo->prepare(
                'UPDATE auth_rate_limits SET attempt_count = :attempt_count, window_started_at = :window_started_at, blocked_until = NULL WHERE scope = :scope AND subject_hash = :subject_hash'
            );
            $update->execute([
                'attempt_count' => $attempts + 1,
                'window_started_at' => $nextWindowStart->format('Y-m-d H:i:s'),
                'scope' => $scope,
                'subject_hash' => $subjectHash,
            ]);
            $this->pdo->commit();
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $error;
        }
    }

    private function clearRateLimit(string $scope, string $identifier, string $ip): void
    {
        $delete = $this->pdo->prepare(
            'DELETE FROM auth_rate_limits WHERE scope = :scope AND subject_hash = :subject_hash'
        );
        $delete->execute([
            'scope' => $scope,
            'subject_hash' => hash_hmac('sha256', $scope . "\0" . $identifier . "\0" . $ip, $this->appKey),
        ]);
    }

    private function requiredText(string $value, string $message, int $maxLength): string
    {
        $value = trim($value);
        $length = preg_match_all('/./us', $value);
        if ($length === false || $value === '' || $length > $maxLength) {
            throw new DomainException($message);
        }

        return $value;
    }

    private function normalizeEmail(string $email): string
    {
        $email = strtolower(trim($email));
        if (strlen($email) > 254 || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            throw new DomainException('Enter a valid email address.');
        }

        return $email;
    }

    private function validatePassword(string $password): void
    {
        if (strlen($password) < 6 || strlen($password) > 72) {
            throw new DomainException('Use a password between 6 and 72 characters.');
        }
    }

    private function uuid(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        $hex = bin2hex($bytes);

        return sprintf('%s-%s-%s-%s-%s', substr($hex, 0, 8), substr($hex, 8, 4), substr($hex, 12, 4), substr($hex, 16, 4), substr($hex, 20, 12));
    }
}
