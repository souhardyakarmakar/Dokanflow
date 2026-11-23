<?php
declare(strict_types=1);

$projectRoot = dirname(__DIR__);
$appConfig = require $projectRoot . '/app/bootstrap.php';
$security = require $projectRoot . '/config/security.php';
$security['send_web_headers']();
$security['start_session']($appConfig);

$authSession = $_SESSION['auth'] ?? null;
if (
    !is_array($authSession)
    || !is_int($authSession['user_id'] ?? null)
    || !is_int($authSession['business_id'] ?? null)
) {
    header('Location: login.php', true, 303);
    exit;
}

$connect = require $projectRoot . '/config/database.php';
$authService = new DokanFlow\Auth\AuthenticationService($connect(), (string) $appConfig['key']);
$authUser = $authService->currentIdentity($authSession['user_id'], $authSession['business_id']);
if ($authUser === null) {
    $_SESSION = [];
    session_destroy();
    header('Location: login.php', true, 303);
    exit;
}

$_SESSION['auth'] = $authUser;
$csrfToken = $security['csrf_token']();
$avatarInitials = strtoupper(implode('', array_map(
    static fn (string $part): string => substr($part, 0, 1),
    array_slice(preg_split('/\s+/', trim((string) $authUser['name'])) ?: [], 0, 2),
)));
