<?php
declare(strict_types=1);

use DokanFlow\Support\Environment;

$projectRoot = dirname(__DIR__);
try {
    $appConfig = require $projectRoot . '/app/bootstrap.php';
    if (!in_array($appConfig['environment'], ['local', 'test'], true)) {
        throw new RuntimeException('The demo seed is available only in local or test environments.');
    }

    $connect = require $projectRoot . '/config/database.php';
    $seed = require $projectRoot . '/database/seeds/001_demo.php';
    $seed($connect());

    fwrite(STDOUT, sprintf(
        "Seeded local demo business for %s. Password is set only from the provided environment variable.\n",
        Environment::required('DEMO_OWNER_EMAIL'),
    ));
} catch (Throwable $error) {
    fwrite(STDERR, sprintf("Seed failed: %s\n", $error->getMessage()));
    exit(1);
}
