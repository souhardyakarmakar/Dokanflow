<?php
declare(strict_types=1);

return [
    'send_web_headers' => static function (): void {
        header('Cache-Control: no-store, private');
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');
        header('Referrer-Policy: strict-origin-when-cross-origin');
        header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
        header("Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://images.unsplash.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    },

    'send_api_headers' => static function (): void {
        if (headers_sent($file, $line)) {
            throw new RuntimeException(sprintf('Cannot send security headers; output started at %s:%d.', $file, $line));
        }

        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store, private');
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');
        header('Referrer-Policy: strict-origin-when-cross-origin');
        header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
        header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'");

        $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
        if ($https) {
            header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
        }
    },

    'start_session' => static function (array $appConfig): void {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }
        if (headers_sent($file, $line)) {
            throw new RuntimeException(sprintf('Cannot start a session; output started at %s:%d.', $file, $line));
        }

        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        ini_set('session.use_trans_sid', '0');
        ini_set('session.cookie_httponly', '1');
        ini_set('session.cookie_samesite', 'Lax');

        $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || $appConfig['force_https'];
        session_name($appConfig['session_name']);
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'secure' => $https,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);

        if (!session_start()) {
            throw new RuntimeException('Unable to start a secure PHP session.');
        }
    },

    'csrf_token' => static function (): string {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            throw new RuntimeException('Start the session before creating a CSRF token.');
        }
        if (!isset($_SESSION['_csrf_token']) || !is_string($_SESSION['_csrf_token'])) {
            $_SESSION['_csrf_token'] = bin2hex(random_bytes(32));
        }

        return $_SESSION['_csrf_token'];
    },

    'csrf_is_valid' => static function (?string $submittedToken): bool {
        $sessionToken = $_SESSION['_csrf_token'] ?? null;

        return is_string($submittedToken)
            && is_string($sessionToken)
            && hash_equals($sessionToken, $submittedToken);
    },

    'regenerate_session' => static function (): void {
        if (session_status() !== PHP_SESSION_ACTIVE || !session_regenerate_id(true)) {
            throw new RuntimeException('Unable to regenerate the authenticated session.');
        }
    },
];
