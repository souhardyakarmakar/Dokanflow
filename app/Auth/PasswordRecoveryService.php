<?php
declare(strict_types=1);

namespace DokanFlow\Auth;

use DomainException;
use PDO;
use RuntimeException;
use Throwable;

final class PasswordRecoveryService
{
    private const OTP_TTL_MINUTES = 5;
    private const RESEND_COOLDOWN_SECONDS = 30;
    private const SEND_LIMIT = 3;
    private const SEND_WINDOW_SECONDS = 900;
    private const MAX_ATTEMPTS = 5;
    private const AUTH_TTL_MINUTES = 10;

    public function __construct(
        private readonly PDO $pdo,
        private readonly string $appKey,
        private readonly PasswordRecoveryMailer $mailer,
    ) {
        if (strlen($this->appKey) < 32) {
            throw new RuntimeException('APP_KEY must contain at least 32 characters.');
        }
    }

    /**
     * Request a code without returning any account-existence information.
     *
     * @return array{challenge_ref:string,email:string,wait_seconds:int}
     */
    public function requestOtp(string $email): array
    {
        $email = $this->normalizeEmail($email);
        $emailHash = $this->digest('email', $email);
        $latest = $this->latestChallenge($emailHash);
        if ($latest !== null) {
            $wait = (int) $latest['wait_seconds'];
            if ($wait > 0) {
                return [
                    'challenge_ref' => (string) $latest['challenge_ref'],
                    'email' => $email,
                    'wait_seconds' => $wait,
                ];
            }
        }

        $rateWait = $this->consumeEmailSendLimit($emailHash);
        if ($rateWait > 0) {
            $latest ??= $this->latestChallenge($emailHash);
            return [
                'challenge_ref' => (string) ($latest['challenge_ref'] ?? ''),
                'email' => $email,
                'wait_seconds' => max($rateWait, (int) ($latest['wait_seconds'] ?? 0)),
            ];
        }

        $otp = (string) random_int(100000, 999999);
        $challengeRef = $this->uuid();
        $userQuery = $this->pdo->prepare(
            'SELECT id, full_name FROM users WHERE email = :email AND status = \'active\' LIMIT 1'
        );
        $userQuery->execute(['email' => $email]);
        $user = $userQuery->fetch();

        $this->pdo->beginTransaction();
        try {
            $rateLock = $this->pdo->prepare(
                'SELECT id FROM auth_rate_limits WHERE scope = :scope AND subject_hash = :subject_hash FOR UPDATE'
            );
            $rateLock->execute([
                'scope' => 'password-otp',
                'subject_hash' => $this->digest('send-limit', $emailHash),
            ]);
            if ($rateLock->fetchColumn() === false) {
                throw new RuntimeException('Password recovery rate limit could not be locked.');
            }
            $latest = $this->latestChallenge($emailHash);
            if ($latest !== null && (int) $latest['wait_seconds'] > 0) {
                $this->pdo->commit();
                return [
                    'challenge_ref' => (string) $latest['challenge_ref'],
                    'email' => $email,
                    'wait_seconds' => (int) $latest['wait_seconds'],
                ];
            }

            $invalidate = $this->pdo->prepare(
                'UPDATE password_recovery_otps SET consumed_at = UTC_TIMESTAMP(), reset_authorization_hash = NULL, reset_authorization_expires_at = NULL WHERE email_hash = :email_hash AND consumed_at IS NULL'
            );
            $invalidate->execute(['email_hash' => $emailHash]);
            $invalidateLegacy = $this->pdo->prepare(
                'UPDATE password_resets SET used_at = UTC_TIMESTAMP() WHERE user_id = :user_id AND used_at IS NULL'
            );
            if ($user !== false) {
                $invalidateLegacy->execute(['user_id' => (int) $user['id']]);
            }

            $insert = $this->pdo->prepare(
                'INSERT INTO password_recovery_otps (challenge_ref, user_id, email_hash, otp_hash, expires_at, sent_at) VALUES (:challenge_ref, :user_id, :email_hash, :otp_hash, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ' . self::OTP_TTL_MINUTES . ' MINUTE), UTC_TIMESTAMP())'
            );
            $insert->execute([
                'challenge_ref' => $challengeRef,
                'user_id' => $user === false ? null : (int) $user['id'],
                'email_hash' => $emailHash,
                'otp_hash' => $this->digest('otp', $otp),
            ]);
            $this->pdo->commit();
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $error;
        }

        if ($user !== false) {
            try {
                $this->mailer->sendOtp($email, (string) $user['full_name'], $otp);
            } catch (Throwable $error) {
                error_log('DokanFlow password recovery request could not deliver an email.');
            }
        }

        return [
            'challenge_ref' => $challengeRef,
            'email' => $email,
            'wait_seconds' => self::RESEND_COOLDOWN_SECONDS,
        ];
    }

    public function verifyOtp(string $challengeRef, string $email, string $otp): string
    {
        if (preg_match('/\A[0-9]{6}\z/', $otp) !== 1) {
            throw new DomainException('That code is invalid or has expired. Request a new code and try again.');
        }
        $challenge = $this->lockChallenge($challengeRef, $email);
        if (
            $challenge === false
            || $challenge['user_id'] === null
            || $challenge['consumed_at'] !== null
            || $challenge['verified_at'] !== null
            || (int) $challenge['failed_attempts'] >= self::MAX_ATTEMPTS
            || (int) $challenge['is_unexpired'] !== 1
        ) {
            $this->pdo->commit();
            throw new DomainException('That code is invalid or has expired. Request a new code and try again.');
        }

        $expectedHash = $this->digest('otp', $otp);
        if (!hash_equals((string) $challenge['otp_hash'], $expectedHash)) {
            $attempts = (int) $challenge['failed_attempts'] + 1;
            $update = $this->pdo->prepare(
                'UPDATE password_recovery_otps SET failed_attempts = :attempts, consumed_at = IF(:lock_attempt >= 5, UTC_TIMESTAMP(), consumed_at) WHERE id = :id'
            );
            $update->execute([
                'attempts' => $attempts,
                'lock_attempt' => $attempts,
                'id' => (int) $challenge['id'],
            ]);
            $this->pdo->commit();
            throw new DomainException('That code is invalid or has expired. Request a new code and try again.');
        }

        $authorization = bin2hex(random_bytes(32));
        $update = $this->pdo->prepare(
            'UPDATE password_recovery_otps SET verified_at = UTC_TIMESTAMP(), reset_authorization_hash = :authorization_hash, reset_authorization_expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ' . self::AUTH_TTL_MINUTES . ' MINUTE) WHERE id = :id'
        );
        $update->execute([
            'authorization_hash' => $this->digest('authorization', $authorization),
            'id' => (int) $challenge['id'],
        ]);
        $this->pdo->commit();
        return $authorization;
    }

    public function hasValidAuthorization(string $challengeRef, string $authorization): bool
    {
        if ($challengeRef === '' || $authorization === '') {
            return false;
        }
        $query = $this->pdo->prepare(
            'SELECT id FROM password_recovery_otps WHERE challenge_ref = :challenge_ref AND reset_authorization_hash = :authorization_hash AND reset_authorization_expires_at > UTC_TIMESTAMP() AND verified_at IS NOT NULL AND consumed_at IS NULL LIMIT 1'
        );
        $query->execute([
            'challenge_ref' => $challengeRef,
            'authorization_hash' => $this->digest('authorization', $authorization),
        ]);
        return $query->fetchColumn() !== false;
    }

    public function resetPassword(string $challengeRef, string $email, string $authorization, string $password, string $confirmation): void
    {
        if (strlen($password) < 6 || strlen($password) > 72) {
            throw new DomainException('Use a password between 6 and 72 characters.');
        }
        if (!hash_equals($password, $confirmation)) {
            throw new DomainException('The passwords do not match.');
        }
        if ($challengeRef === '' || $authorization === '') {
            throw new DomainException('Verify your email code before choosing a new password.');
        }

        $email = $this->normalizeEmail($email);
        $emailHash = $this->digest('email', $email);
        $authorizationHash = $this->digest('authorization', $authorization);
        $this->pdo->beginTransaction();
        try {
            $find = $this->pdo->prepare(
                'SELECT id, user_id FROM password_recovery_otps WHERE challenge_ref = :challenge_ref AND email_hash = :email_hash AND reset_authorization_hash = :authorization_hash AND reset_authorization_expires_at > UTC_TIMESTAMP() AND verified_at IS NOT NULL AND consumed_at IS NULL LIMIT 1 FOR UPDATE'
            );
            $find->execute([
                'challenge_ref' => $challengeRef,
                'email_hash' => $emailHash,
                'authorization_hash' => $authorizationHash,
            ]);
            $challenge = $find->fetch();
            if ($challenge === false || $challenge['user_id'] === null) {
                throw new DomainException('Your reset authorization is invalid or expired. Request a new code.');
            }

            $hash = password_hash($password, defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_DEFAULT);
            if ($hash === false) {
                throw new RuntimeException('Password hashing failed.');
            }
            $updateUser = $this->pdo->prepare(
                'UPDATE users SET password_hash = :password_hash WHERE id = :user_id AND status = \'active\''
            );
            $updateUser->execute(['password_hash' => $hash, 'user_id' => (int) $challenge['user_id']]);
            if ($updateUser->rowCount() !== 1) {
                throw new DomainException('Your reset authorization is invalid or expired. Request a new code.');
            }

            $invalidate = $this->pdo->prepare(
                'UPDATE password_recovery_otps SET consumed_at = UTC_TIMESTAMP(), reset_authorization_hash = NULL, reset_authorization_expires_at = NULL WHERE email_hash = :email_hash AND consumed_at IS NULL'
            );
            $invalidate->execute(['email_hash' => $emailHash]);
            $legacy = $this->pdo->prepare(
                'UPDATE password_resets SET used_at = UTC_TIMESTAMP() WHERE user_id = :user_id AND used_at IS NULL'
            );
            $legacy->execute(['user_id' => (int) $challenge['user_id']]);
            $this->pdo->commit();
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $error;
        }
    }

    private function normalizeEmail(string $email): string
    {
        $email = strtolower(trim($email));
        if (strlen($email) > 254 || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            throw new DomainException('Enter a valid email address.');
        }
        return $email;
    }

    private function consumeEmailSendLimit(string $emailHash): int
    {
        $scope = 'password-otp';
        $subjectHash = $this->digest('send-limit', $emailHash);
        $this->pdo->beginTransaction();
        try {
            $insert = $this->pdo->prepare(
                'INSERT IGNORE INTO auth_rate_limits (scope, subject_hash, attempt_count, window_started_at) VALUES (:scope, :subject_hash, 0, UTC_TIMESTAMP())'
            );
            $insert->execute(['scope' => $scope, 'subject_hash' => $subjectHash]);
            $find = $this->pdo->prepare(
                'SELECT attempt_count, window_started_at, TIMESTAMPDIFF(SECOND, window_started_at, UTC_TIMESTAMP()) AS window_elapsed FROM auth_rate_limits WHERE scope = :scope AND subject_hash = :subject_hash FOR UPDATE'
            );
            $find->execute(['scope' => $scope, 'subject_hash' => $subjectHash]);
            $rate = $find->fetch();
            if ($rate === false) {
                throw new RuntimeException('Password recovery rate limit could not be loaded.');
            }
            $elapsed = max(0, (int) $rate['window_elapsed']);
            $attempts = $elapsed >= self::SEND_WINDOW_SECONDS ? 0 : (int) $rate['attempt_count'];
            if ($attempts >= self::SEND_LIMIT) {
                $this->pdo->commit();
                return max(1, self::SEND_WINDOW_SECONDS - $elapsed);
            }
            $update = $this->pdo->prepare(
                'UPDATE auth_rate_limits SET attempt_count = :attempt_count, window_started_at = IF(:reset_window = 1, UTC_TIMESTAMP(), window_started_at), blocked_until = NULL WHERE scope = :scope AND subject_hash = :subject_hash'
            );
            $update->execute([
                'attempt_count' => $attempts + 1,
                'reset_window' => $attempts === 0 ? 1 : 0,
                'scope' => $scope,
                'subject_hash' => $subjectHash,
            ]);
            $this->pdo->commit();
            return 0;
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $error;
        }
    }

    /** @return array{challenge_ref:string,wait_seconds:int}|null */
    private function latestChallenge(string $emailHash): ?array
    {
        $query = $this->pdo->prepare(
            'SELECT challenge_ref, GREATEST(0, ' . self::RESEND_COOLDOWN_SECONDS . ' - TIMESTAMPDIFF(SECOND, sent_at, UTC_TIMESTAMP())) AS wait_seconds FROM password_recovery_otps WHERE email_hash = :email_hash ORDER BY id DESC LIMIT 1'
        );
        $query->execute(['email_hash' => $emailHash]);
        $row = $query->fetch();
        return $row === false ? null : [
            'challenge_ref' => (string) $row['challenge_ref'],
            'wait_seconds' => (int) $row['wait_seconds'],
        ];
    }

    /** @return array<string, mixed>|false */
    private function lockChallenge(string $challengeRef, string $email): array|false
    {
        $emailHash = $this->digest('email', $this->normalizeEmail($email));
        $this->pdo->beginTransaction();
        $query = $this->pdo->prepare(
            'SELECT id, user_id, otp_hash, failed_attempts, verified_at, consumed_at, (expires_at > UTC_TIMESTAMP()) AS is_unexpired FROM password_recovery_otps WHERE challenge_ref = :challenge_ref AND email_hash = :email_hash LIMIT 1 FOR UPDATE'
        );
        $query->execute([
            'challenge_ref' => $challengeRef,
            'email_hash' => $emailHash,
        ]);
        return $query->fetch();
    }

    private function digest(string $purpose, string $value): string
    {
        return hash_hmac('sha256', $purpose . "\0" . $value, $this->appKey);
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
