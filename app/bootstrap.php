<?php
declare(strict_types=1);

$projectRoot = dirname(__DIR__);
$autoloadFile = $projectRoot . '/vendor/autoload.php';
if (is_file($autoloadFile)) {
    require_once $autoloadFile;
} else {
    spl_autoload_register(static function (string $class) use ($projectRoot): void {
        $prefix = 'DokanFlow\\';
        if (!str_starts_with($class, $prefix)) {
            return;
        }

        $file = $projectRoot . '/app/' . str_replace('\\', DIRECTORY_SEPARATOR, substr($class, strlen($prefix))) . '.php';
        if (is_file($file)) {
            require_once $file;
        }
    });
}

require_once $projectRoot . '/app/Support/Environment.php';
DokanFlow\Support\Environment::loadFile($projectRoot . '/.env');

$appConfig = require $projectRoot . '/config/app.php';
date_default_timezone_set($appConfig['timezone']);
ini_set('display_errors', $appConfig['debug'] ? '1' : '0');

return $appConfig;
