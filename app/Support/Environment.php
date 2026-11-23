<?php
declare(strict_types=1);

namespace DokanFlow\Support;

use RuntimeException;

final class Environment
{
    public static function loadFile(string $path): void
    {
        if (!is_file($path) || !is_readable($path)) {
            return;
        }

        $lines = file($path, FILE_IGNORE_NEW_LINES);
        if ($lines === false) {
            throw new RuntimeException('Unable to read the environment configuration file.');
        }

        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }

            if (str_starts_with($line, 'export ')) {
                $line = substr($line, 7);
            }

            $separator = strpos($line, '=');
            if ($separator === false) {
                continue;
            }

            $name = trim(substr($line, 0, $separator));
            if (preg_match('/\A[A-Za-z_][A-Za-z0-9_]*\z/', $name) !== 1) {
                continue;
            }
            if (isset($_ENV[$name]) || isset($_SERVER[$name]) || getenv($name) !== false) {
                continue;
            }

            $value = trim(substr($line, $separator + 1));
            if (strlen($value) >= 2 && $value[0] === '"' && $value[strlen($value) - 1] === '"') {
                $decoded = json_decode($value, true);
                $value = is_string($decoded) ? $decoded : substr($value, 1, -1);
            } elseif (strlen($value) >= 2 && $value[0] === "'" && $value[strlen($value) - 1] === "'") {
                $value = substr($value, 1, -1);
            } else {
                $value = preg_replace('/\s+#.*$/', '', $value) ?? $value;
            }

            $_ENV[$name] = $value;
            $_SERVER[$name] = $value;
            putenv($name . '=' . $value);
        }
    }

    public static function get(string $name, ?string $default = null): ?string
    {
        $value = $_ENV[$name] ?? $_SERVER[$name] ?? getenv($name);

        return $value === false || $value === null ? $default : (string) $value;
    }

    public static function required(string $name): string
    {
        $value = self::get($name);
        if ($value === null || trim($value) === '') {
            throw new RuntimeException(sprintf('Required environment variable %s is not set.', $name));
        }

        return $value;
    }

    public static function boolean(string $name, bool $default = false): bool
    {
        $value = self::get($name);
        if ($value === null) {
            return $default;
        }

        $parsed = filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        if ($parsed === null) {
            throw new RuntimeException(sprintf('Environment variable %s must be a boolean.', $name));
        }

        return $parsed;
    }
}
