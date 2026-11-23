<?php
declare(strict_types=1);

$projectRoot = __DIR__;
$appConfig = require $projectRoot . '/app/bootstrap.php';
$security = require $projectRoot . '/config/security.php';
$security['send_web_headers']();
$security['start_session']($appConfig);

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    exit('Method not allowed.');
}

if (!$security['csrf_is_valid'](is_string($_POST['_csrf_token'] ?? null) ? $_POST['_csrf_token'] : null)) {
    http_response_code(419);
    exit('Your session expired. Reload the page and try again.');
}

$_SESSION = [];
if (ini_get('session.use_cookies')) {
    $cookie = session_get_cookie_params();
    setcookie(session_name(), '', [
        'expires' => time() - 42000,
        'path' => $cookie['path'],
        'domain' => $cookie['domain'],
        'secure' => $cookie['secure'],
        'httponly' => $cookie['httponly'],
        'samesite' => $cookie['samesite'] ?? 'Lax',
    ]);
}
session_destroy();

header('Location: login.php', true, 303);
exit;
