<?php
declare(strict_types=1);

return static function (PDO $pdo): void {
    $pdo->exec("UPDATE users SET status = 'active' WHERE status = 'pending'");
    $pdo->exec('DROP TABLE IF EXISTS email_verification_codes');
    $pdo->exec('ALTER TABLE users DROP COLUMN email_verified_at');
};
