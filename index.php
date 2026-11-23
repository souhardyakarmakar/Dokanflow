<?php
declare(strict_types=1);

require __DIR__ . '/includes/auth-bootstrap.php';

$profileError = '';
$profileSuccess = '';
$allowed = ['overview', 'customers', 'orders', 'invoices', 'payments', 'expenses', 'cashflow', 'reminders', 'reports', 'profile', 'settings'];
$page = $forcedPage ?? ($_GET['page'] ?? 'overview');

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $page === 'profile') {
    if (!$security['csrf_is_valid']($_POST['_csrf_token'] ?? null)) {
        http_response_code(403);
        exit('Invalid or expired form session.');
    }
    try {
        $authUser = $authService->updateProfile(
            (int) $authSession['user_id'],
            (int) $authSession['business_id'],
            (string) ($_POST['owner'] ?? ''),
            (string) ($_POST['email'] ?? ''),
            (string) ($_POST['phone'] ?? ''),
        );
        $_SESSION['auth'] = $authUser;
        $profileSuccess = 'Your profile has been saved.';
    } catch (Throwable $error) {
        $profileError = $error instanceof DomainException
            || $error instanceof DokanFlow\Auth\AuthenticationException
            ? $error->getMessage()
            : 'Your profile could not be saved.';
    }
}
if (!in_array($page, $allowed, true)) {
    $page = 'overview';
}

$pageTitles = [
    'overview'  => 'Overview',
    'customers' => 'Customers',
    'orders'    => 'Orders & Services',
    'invoices'  => 'Invoices',
    'payments'  => 'Payments',
    'expenses'  => 'Expenses',
    'cashflow'  => 'Cash Flow',
    'reminders' => 'Reminders',
    'reports'   => 'Reports & Settings',
    'profile'   => 'Profile',
    'settings'  => 'Application Settings',
];

$activePage = $page;
$pageTitle = $pageTitles[$page];
?>
<!DOCTYPE html>
<html lang="en" data-theme="light">
<?php require __DIR__ . '/includes/head.php'; ?>
<body class="app-body"
      data-page="<?= htmlspecialchars($page, ENT_QUOTES, 'UTF-8') ?>"
      data-account-id="<?= htmlspecialchars((string) $authUser['user_public_id'], ENT_QUOTES, 'UTF-8') ?>"
      data-user-name="<?= htmlspecialchars((string) $authUser['name'], ENT_QUOTES, 'UTF-8') ?>"
      data-user-email="<?= htmlspecialchars((string) $authUser['email'], ENT_QUOTES, 'UTF-8') ?>"
      data-user-phone="<?= htmlspecialchars((string) ($authUser['phone'] ?? ''), ENT_QUOTES, 'UTF-8') ?>"
      data-user-timezone="<?= htmlspecialchars((string) ($authUser['timezone'] ?? 'Asia/Kolkata'), ENT_QUOTES, 'UTF-8') ?>"
      data-business-id="<?= htmlspecialchars((string) $authUser['business_public_id'], ENT_QUOTES, 'UTF-8') ?>"
      data-business-name="<?= htmlspecialchars((string) $authUser['business_name'], ENT_QUOTES, 'UTF-8') ?>">
    <a class="skip-link" href="#main">Skip to content</a>

    <?php require __DIR__ . '/includes/sidebar.php'; ?>
    <?php require __DIR__ . '/includes/header.php'; ?>

    <main id="main" class="app-main" tabindex="-1">
        <?php require __DIR__ . '/pages/' . $page . '.php'; ?>
    </main>

    <?php require __DIR__ . '/includes/navigation.php'; ?>
    <?php require __DIR__ . '/includes/footer.php'; ?>

    <div id="toast-root" class="toast-root" aria-live="polite" aria-atomic="false"></div>

    <?php require __DIR__ . '/includes/scripts.php'; ?>
</body>
</html>
