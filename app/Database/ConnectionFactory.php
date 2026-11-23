<?php
declare(strict_types=1);

namespace DokanFlow\Database;

use PDO;
use RuntimeException;

final class ConnectionFactory
{
    /**
     * @param array{host:string,port:int,database:string,username:string,password:string,timeout:int} $config
     */
    public static function create(array $config): PDO
    {
        if (!in_array('mysql', PDO::getAvailableDrivers(), true)) {
            throw new RuntimeException('The pdo_mysql extension is required to connect to DokanFlow.');
        }
        if (
            !isset($config['host'], $config['database'], $config['username'], $config['password'])
            || !is_string($config['host'])
            || preg_match('/\A[A-Za-z0-9._:\-\[\]%]+\z/', $config['host']) !== 1
            || !is_string($config['database'])
            || preg_match('/\A[A-Za-z0-9_$-]{1,64}\z/', $config['database']) !== 1
            || !is_string($config['username'])
            || $config['username'] === ''
            || !is_string($config['password'])
            || !isset($config['port'], $config['timeout'])
            || !is_int($config['port'])
            || $config['port'] < 1
            || $config['port'] > 65535
            || !is_int($config['timeout'])
            || $config['timeout'] < 1
            || $config['timeout'] > 30
        ) {
            throw new RuntimeException('Database connection configuration contains invalid values.');
        }

        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
            $config['host'],
            $config['port'],
            $config['database'],
        );

        $pdo = new PDO($dsn, $config['username'], $config['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_STRINGIFY_FETCHES => false,
            PDO::ATTR_TIMEOUT => $config['timeout'],
        ]);
        $pdo->exec("SET time_zone = '+00:00'");

        return $pdo;
    }
}
