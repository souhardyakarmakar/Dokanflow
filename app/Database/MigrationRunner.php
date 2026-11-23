<?php
declare(strict_types=1);

namespace DokanFlow\Database;

use PDO;
use RuntimeException;
use Throwable;

final class MigrationRunner
{
    public function __construct(
        private readonly PDO $pdo,
        private readonly string $migrationDirectory,
    ) {
    }

    /**
     * @return list<string>
     */
    public function migrate(): array
    {
        $this->createMigrationTable();
        $files = glob(rtrim($this->migrationDirectory, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . '*.php');
        if ($files === false) {
            throw new RuntimeException('Unable to enumerate database migration files.');
        }
        sort($files, SORT_STRING);

        $applied = [];
        foreach ($files as $file) {
            $name = basename($file);
            if (!preg_match('/^\d{3}_[a-z0-9_]+\.php$/', $name)) {
                throw new RuntimeException(sprintf('Invalid migration filename: %s', $name));
            }

            $checksum = hash_file('sha256', $file);
            if ($checksum === false) {
                throw new RuntimeException(sprintf('Unable to checksum migration: %s', $name));
            }

            $select = $this->pdo->prepare(
                'SELECT checksum, status FROM schema_migrations WHERE migration_name = :name'
            );
            $select->execute(['name' => $name]);
            $existing = $select->fetch();
            if ($existing !== false) {
                // Accept original checksums for these migrations when they were
                // already applied before the XAMPP/MariaDB collation adjustment.
                $legacyChecksums = [
                    '001_identity.php' => '362250c54988dfc81da201def0bb8ef08deb0a8af44eb31dff0aa6942885e53e',
                    '002_customers_orders.php' => '51c90a578bdb93f3becc4d74cea7a38b5f67fa2f86b4125230b40a955af196ba',
                    '003_invoices_items.php' => 'efe0f4ca7f92fba90449be4eec04418ab694174c8790d88188969fa578d1a43d',
                    '004_finance_security.php' => '8d8986577fce4aff61ea299249f2a0305b0188c98cd525ce61e29277cbee9e4f',
                    '005_email_verification.php' => '6986d10e7e11cfbb80486a706b0e260de5c983f3aa8a14b66eacc9c63b189399',
                ];
                $isLegacyChecksum = isset($legacyChecksums[$name])
                    && hash_equals($legacyChecksums[$name], (string) $existing['checksum']);
                if ($existing['status'] !== 'applied') {
                    throw new RuntimeException(sprintf(
                        'Migration %s is marked %s. Inspect and repair it manually before continuing.',
                        $name,
                        $existing['status'],
                    ));
                }
                if (!hash_equals((string) $existing['checksum'], $checksum) && !$isLegacyChecksum) {
                    throw new RuntimeException(sprintf('Applied migration %s has changed; create a new migration instead.', $name));
                }
                continue;
            }

            $insert = $this->pdo->prepare(
                'INSERT INTO schema_migrations (migration_name, checksum, status) VALUES (:name, :checksum, \'running\')'
            );
            $insert->execute(['name' => $name, 'checksum' => $checksum]);

            try {
                $migration = require $file;
                if (!is_callable($migration)) {
                    throw new RuntimeException(sprintf('Migration %s must return a callable.', $name));
                }
                $migration($this->pdo);

                $update = $this->pdo->prepare(
                    'UPDATE schema_migrations SET status = \'applied\', applied_at = CURRENT_TIMESTAMP WHERE migration_name = :name'
                );
                $update->execute(['name' => $name]);
                $applied[] = $name;
            } catch (Throwable $error) {
                $update = $this->pdo->prepare(
                    'UPDATE schema_migrations SET status = \'failed\' WHERE migration_name = :name'
                );
                $update->execute(['name' => $name]);
                throw new RuntimeException(sprintf('Migration %s failed.', $name), 0, $error);
            }
        }

        return $applied;
    }

    private function createMigrationTable(): void
    {
        $this->pdo->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
    migration_name VARCHAR(190) NOT NULL,
    checksum CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    status VARCHAR(16) NOT NULL,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    applied_at TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (migration_name),
    CONSTRAINT chk_schema_migrations_status CHECK (status IN ('running', 'applied', 'failed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL);
    }
}
