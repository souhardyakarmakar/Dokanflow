<?php
declare(strict_types=1);

use DokanFlow\Support\Environment;

require_once dirname(__DIR__) . '/app/Support/Environment.php';

$environment = Environment::get('APP_ENV', 'production');
if (!in_array($environment, ['local', 'test', 'staging', 'production'], true)) {
    throw new RuntimeException('APP_ENV must be local, test, staging, or production.');
}

return [
    'name' => 'DokanFlow',
    'environment' => $environment,
    'debug' => Environment::boolean('APP_DEBUG', false),
    'url' => Environment::get('APP_URL', 'https://localhost'),
    'timezone' => Environment::get('APP_TIMEZONE', 'Asia/Kolkata'),
    'session_name' => Environment::get('APP_SESSION_NAME', 'DOKANFLOWSESSID'),
    'force_https' => Environment::boolean('APP_FORCE_HTTPS', $environment === 'production'),
    'key' => Environment::get('APP_KEY', ''),
];
