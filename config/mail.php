<?php
declare(strict_types=1);

use DokanFlow\Support\Environment;

require_once dirname(__DIR__) . '/app/Support/Environment.php';

$host = Environment::get('MAIL_HOST', '');
$username = Environment::get('MAIL_USERNAME', '');
$password = Environment::get('MAIL_PASSWORD', '');
$from = Environment::get('MAIL_FROM', '');
$fromName = Environment::get('MAIL_FROM_NAME', 'DokanFlow');
$port = Environment::get('MAIL_PORT', '587');
$encryption = strtolower((string) Environment::get('MAIL_ENCRYPTION', 'tls'));

if ($port !== '587' || $encryption !== 'tls') {
    throw new RuntimeException('Password recovery mail must use STARTTLS on port 587.');
}

return [
    'host' => $host,
    'port' => 587,
    'encryption' => 'tls',
    'username' => $username,
    'password' => $password,
    'from' => $from,
    'from_name' => $fromName,
];
