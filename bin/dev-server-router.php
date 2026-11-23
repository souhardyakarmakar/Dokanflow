<?php
declare(strict_types=1);

$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
if (!is_string($requestPath)) {
    http_response_code(400);
    exit;
}

$decodedPath = $requestPath;
for ($decodePass = 0; $decodePass < 2; $decodePass++) {
    $nextPath = rawurldecode($decodedPath);
    if ($nextPath === $decodedPath) {
        break;
    }
    $decodedPath = $nextPath;
}

$segments = explode('/', strtolower(str_replace('\\', '/', trim($decodedPath, '/'))));
$blockedDirectories = ['app', 'bin', 'config', 'database', 'storage', 'vendor', '.git'];
$blockedFiles = ['composer.json', 'composer.lock', '.gitignore', '.htaccess', 'readme.md'];
foreach ($segments as $segment) {
    if (
        in_array($segment, $blockedDirectories, true)
        || in_array($segment, $blockedFiles, true)
        || str_starts_with($segment, '.env')
    ) {
        http_response_code(404);
        exit;
    }
}

return false;
