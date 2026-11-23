<?php
declare(strict_types=1);

use DokanFlow\Database\MigrationRunner;

$projectRoot = dirname(__DIR__);
try {
    require $projectRoot . '/app/bootstrap.php';
    $connect = require $projectRoot . '/config/database.php';
    $runner = new MigrationRunner($connect(), $projectRoot . '/database/migrations');
    $applied = $runner->migrate();

    if ($applied === []) {
        fwrite(STDOUT, "Database schema is already up to date.\n");
    } else {
        foreach ($applied as $migration) {
            fwrite(STDOUT, sprintf("Applied %s\n", $migration));
        }
    }
} catch (Throwable $error) {
    fwrite(STDERR, sprintf("Migration failed: %s\n", $error->getMessage()));
    exit(1);
}
