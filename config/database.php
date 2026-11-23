<?php
declare(strict_types=1);

use DokanFlow\Database\ConnectionFactory;
use DokanFlow\Support\Environment;

require_once dirname(__DIR__) . '/app/Support/Environment.php';
require_once dirname(__DIR__) . '/app/Database/ConnectionFactory.php';

$port = filter_var(Environment::get('DB_PORT', '3306'), FILTER_VALIDATE_INT, [
    'options' => ['min_range' => 1, 'max_range' => 65535],
]);
$timeout = filter_var(Environment::get('DB_CONNECT_TIMEOUT', '5'), FILTER_VALIDATE_INT, [
    'options' => ['min_range' => 1, 'max_range' => 30],
]);
if ($port === false || $timeout === false) {
    throw new RuntimeException('DB_PORT or DB_CONNECT_TIMEOUT is outside its permitted range.');
}

$config = [
    'host' => Environment::required('DB_HOST'),
    'port' => $port,
    'database' => Environment::required('DB_NAME'),
    'username' => Environment::required('DB_USER'),
    'password' => Environment::get('DB_PASS', Environment::get('DB_PASSWORD', '')),
    'timeout' => $timeout,
];

return static fn (): PDO => ConnectionFactory::create($config);
