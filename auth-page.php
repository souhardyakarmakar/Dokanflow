<?php
declare(strict_types=1);

$projectRoot = __DIR__;
$appConfig = require $projectRoot . '/app/bootstrap.php';
$security = require $projectRoot . '/config/security.php';
$security['send_web_headers']();
$security['start_session']($appConfig);

$authConfig = [
    'login' => ['Sign in', 'Welcome back', 'Sign in to your private business workspace.', 'Sign in'],
    'register' => ['Create account', 'Your back office, in one place.', 'Create your account and private business workspace.', 'Create account'],
    'forgot-password' => ['Forgot password', 'Reset your password', 'Verify your email to securely choose a new password.', 'Send code'],
];
$mode = $authMode ?? 'login';
if (!isset($authConfig[$mode])) {
    $mode = 'login';
}
[$title, $heading, $description, $submitLabel] = $authConfig[$mode];

if (isset($_SESSION['auth']) && is_array($_SESSION['auth'])) {
    header('Location: index.php?page=overview', true, 303);
    exit;
}

$csrfToken = $security['csrf_token']();
$formError = '';
$notice = $mode === 'login' && !empty($_SESSION['password_reset_notice'])
    ? 'Your password has been updated. You can now sign in.'
    : '';
if ($mode === 'login') {
    unset($_SESSION['password_reset_notice']);
}
$submittedEmail = is_string($_POST['email'] ?? null)
    ? trim($_POST['email'])
    : '';
$remoteIp = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
$recoveryState = $_SESSION['password_recovery'] ?? null;
$recoveryStep = 'email';
$recoveryWaitSeconds = 0;
$recoveryEmail = '';

if ($mode === 'forgot-password' && ($_GET['restart'] ?? null) === '1') {
    unset($_SESSION['password_recovery']);
    $recoveryState = null;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    if (!$security['csrf_is_valid'](is_string($_POST['_csrf_token'] ?? null) ? $_POST['_csrf_token'] : null)) {
        http_response_code(419);
        $formError = 'Your form session expired. Reload the page and try again.';
    } else {
        try {
            $connect = require $projectRoot . '/config/database.php';
            if ($mode === 'login') {
                $auth = new DokanFlow\Auth\AuthenticationService($connect(), (string) $appConfig['key']);
                $identity = $auth->login(
                    $submittedEmail,
                    is_string($_POST['password'] ?? null) ? $_POST['password'] : '',
                    $remoteIp,
                );
                $security['regenerate_session']();
                unset($_SESSION['password_recovery']);
                $_SESSION['auth'] = $identity;
                unset($_SESSION['_csrf_token']);
                header('Location: index.php?page=overview', true, 303);
                exit;
            }

            if ($mode === 'register') {
                $auth = new DokanFlow\Auth\AuthenticationService($connect(), (string) $appConfig['key']);
                $password = is_string($_POST['password'] ?? null) ? $_POST['password'] : '';
                $confirmation = is_string($_POST['confirm_password'] ?? null) ? $_POST['confirm_password'] : '';
                if (!hash_equals($password, $confirmation)) {
                    throw new DomainException('The passwords do not match.');
                }

                $identity = $auth->register(
                    is_string($_POST['name'] ?? null) ? $_POST['name'] : '',
                    is_string($_POST['business'] ?? null) ? $_POST['business'] : '',
                    $submittedEmail,
                    $password,
                    $remoteIp,
                );
                $security['regenerate_session']();
                unset($_SESSION['password_recovery']);
                $_SESSION['auth'] = $identity;
                unset($_SESSION['_csrf_token']);
                header('Location: index.php?page=overview', true, 303);
                exit;
            }

            if ($mode === 'forgot-password') {
                $connect = require $projectRoot . '/config/database.php';
                $mailConfig = require $projectRoot . '/config/mail.php';
                $recovery = new DokanFlow\Auth\PasswordRecoveryService(
                    $connect(),
                    (string) $appConfig['key'],
                    new DokanFlow\Auth\PasswordRecoveryMailer($mailConfig),
                );
                $recoveryAction = is_string($_POST['recovery_action'] ?? null)
                    ? $_POST['recovery_action']
                    : '';
                $recoveryState = is_array($_SESSION['password_recovery'] ?? null)
                    ? $_SESSION['password_recovery']
                    : null;

                if ($recoveryAction === 'request' || $recoveryAction === 'resend') {
                    $email = $recoveryAction === 'request'
                        ? $submittedEmail
                        : (string) ($recoveryState['email'] ?? '');
                    $requested = $recovery->requestOtp($email);
                    if ($requested['challenge_ref'] === '') {
                        throw new DomainException('Please wait before requesting another code.');
                    }
                    $_SESSION['password_recovery'] = [
                        'challenge_ref' => $requested['challenge_ref'],
                        'email' => $requested['email'],
                        'wait_until' => time() + $requested['wait_seconds'],
                        'authorization' => '',
                        'verified' => false,
                    ];
                    header('Location: forgot-password.php?step=otp', true, 303);
                    exit;
                }

                if ($recoveryAction === 'verify') {
                    if (!is_array($recoveryState) || !empty($recoveryState['verified'])) {
                        throw new DomainException('Request a new code before continuing.');
                    }
                    $otp = is_string($_POST['otp'] ?? null) ? $_POST['otp'] : '';
                    if ($otp === '' && is_array($_POST['otp_digit'] ?? null)) {
                        $otp = implode('', array_map(
                            static fn ($digit): string => is_string($digit) ? $digit : '',
                            $_POST['otp_digit'],
                        ));
                    }
                    $authorization = $recovery->verifyOtp(
                        (string) ($recoveryState['challenge_ref'] ?? ''),
                        (string) ($recoveryState['email'] ?? ''),
                        $otp,
                    );
                    $security['regenerate_session']();
                    $_SESSION['password_recovery']['authorization'] = $authorization;
                    $_SESSION['password_recovery']['verified'] = true;
                    header('Location: forgot-password.php?step=password', true, 303);
                    exit;
                }

                if ($recoveryAction === 'reset') {
                    if (!is_array($recoveryState) || empty($recoveryState['verified'])) {
                        throw new DomainException('Verify your email code before choosing a new password.');
                    }
                    $recovery->resetPassword(
                        (string) ($recoveryState['challenge_ref'] ?? ''),
                        (string) ($recoveryState['email'] ?? ''),
                        (string) ($recoveryState['authorization'] ?? ''),
                        is_string($_POST['password'] ?? null) ? $_POST['password'] : '',
                        is_string($_POST['confirm_password'] ?? null) ? $_POST['confirm_password'] : '',
                    );
                    unset($_SESSION['password_recovery']);
                    $_SESSION['password_reset_notice'] = true;
                    $security['regenerate_session']();
                    unset($_SESSION['_csrf_token']);
                    header('Location: login.php?password_reset=1', true, 303);
                    exit;
                }
            }
        } catch (DokanFlow\Auth\AuthenticationException | DomainException $error) {
            $formError = $error->getMessage();
        } catch (Throwable $error) {
            if ($mode === 'forgot-password') {
                error_log('DokanFlow password recovery request failed.');
                $formError = 'We could not complete that request. Check the database and password-recovery email configuration, then try again.';
            } else {
                error_log(sprintf('DokanFlow account request failed: %s', $error->getMessage()));
            }
            $errorMessage = $error->getMessage();
            if ($mode === 'forgot-password') {
                $formError = 'We could not complete that request. Check the database and password-recovery email configuration, then try again.';
            } elseif (str_contains($errorMessage, 'pdo_mysql extension')) {
                $formError = 'Account creation needs MySQL. Enable PDO MySQL, configure DB_* in .env, and import database/dokanflow.sql.';
            } elseif (str_contains($errorMessage, 'Required environment variable DB_')) {
                $formError = 'Database settings are missing. Copy .env.example to .env and fill in DB_HOST, DB_NAME, DB_USER, and DB_PASS.';
            } elseif (str_contains($errorMessage, 'APP_KEY must contain')) {
                $formError = 'APP_KEY is missing or too short. Generate a private 64-character key and set it in .env.';
            } else {
                $formError = 'We could not complete that request. Check the database and email configuration, then try again.';
            }
        }
    }
}

$formAction = [
    'login' => 'login.php',
    'register' => 'register.php',
    'forgot-password' => 'forgot-password.php',
][$mode];

if ($mode === 'forgot-password' && is_array($_SESSION['password_recovery'] ?? null)) {
    $recoveryState = $_SESSION['password_recovery'];
    $recoveryEmail = (string) ($recoveryState['email'] ?? '');
    if (!empty($recoveryState['verified'])) {
        try {
            $connect = require $projectRoot . '/config/database.php';
            $mailConfig = require $projectRoot . '/config/mail.php';
            $recovery = new DokanFlow\Auth\PasswordRecoveryService(
                $connect(),
                (string) $appConfig['key'],
                new DokanFlow\Auth\PasswordRecoveryMailer($mailConfig),
            );
            if ($recovery->hasValidAuthorization(
                (string) ($recoveryState['challenge_ref'] ?? ''),
                (string) ($recoveryState['authorization'] ?? ''),
            )) {
                $recoveryStep = 'password';
            } else {
                unset($_SESSION['password_recovery']);
                $recoveryState = null;
                $recoveryEmail = '';
                $formError = 'Your verification has expired. Request a new code to continue.';
            }
        } catch (Throwable $error) {
            error_log('DokanFlow password recovery authorization check failed.');
            unset($_SESSION['password_recovery']);
            $recoveryState = null;
            $recoveryEmail = '';
            $formError = 'We could not verify your reset session. Please request a new code.';
        }
    } else {
        $recoveryStep = 'otp';
        $recoveryWaitSeconds = max(0, (int) ($recoveryState['wait_until'] ?? time()) - time());
    }
}

if ($mode === 'forgot-password') {
    [$title, $heading, $description, $submitLabel] = match ($recoveryStep) {
        'otp' => ['Verify code', 'Check your email', 'Enter the six-digit code to continue. If an active account matches that email, a code will be sent.', 'Verify code'],
        'password' => ['New password', 'Choose a new password', 'Your email is verified. Set a new password for your account.', 'Save new password'],
        default => ['Forgot password', 'Reset your password', 'Enter your account email and we will send a one-time code if it matches an active account.', 'Send code'],
    };
}
?>
<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Sign in to your secure DokanFlow business workspace.">
    <title><?= htmlspecialchars($title, ENT_QUOTES, 'UTF-8') ?> · DokanFlow</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/css/style.css">
    <link rel="stylesheet" href="assets/css/components.css">
    <link rel="stylesheet" href="assets/css/animations.css">
    <link rel="stylesheet" href="assets/css/auth.css?v=<?= (int) filemtime($projectRoot . '/assets/css/auth.css') ?>">
    <link rel="stylesheet" href="assets/css/polish.css">
    <link rel="icon" href="assets/img/logo.svg" type="image/svg+xml">
</head>
<body class="auth-body" data-auth-mode="<?= htmlspecialchars($mode, ENT_QUOTES, 'UTF-8') ?>">
    <main class="auth-layout">
        <section class="auth-story" aria-label="About DokanFlow">
            <a class="auth-brand" href="login.php">
                <img src="assets/img/logo.svg" alt="" width="42" height="42">
                <span>DokanFlow</span>
            </a>
            <div class="auth-story__copy">
                <p class="eyebrow">THE ONE-PERSON BACK OFFICE</p>
                <h1>Make room for the work you love.</h1>
                <p>Keep customers, orders, invoices and cash flow together in one calm workspace.</p>
            </div>
            <p class="auth-story__credit">Made with care by SOUHARDYA &amp; DEBARTHA</p>
        </section>
        <section class="auth-panel">
            <a class="auth-panel__back" href="login.php">← Back to sign in</a>
            <div class="auth-form-wrap">
                <span class="demo-label">PRIVATE BUSINESS WORKSPACE</span>
                <p class="eyebrow"><?= htmlspecialchars($title, ENT_QUOTES, 'UTF-8') ?></p>
                <h2><?= htmlspecialchars($heading, ENT_QUOTES, 'UTF-8') ?></h2>
                <p class="page-subtitle"><?= htmlspecialchars($description, ENT_QUOTES, 'UTF-8') ?></p>

                <?php if ($mode === 'forgot-password'): ?>
                    <?php if ($recoveryStep === 'email'): ?>
                        <form class="auth-form" method="post" action="forgot-password.php" data-submit-lock>
                            <input type="hidden" name="_csrf_token" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>">
                            <input type="hidden" name="recovery_action" value="request">
                            <label class="field">
                                <span class="field__label">Email address</span>
                                <input class="input" type="email" name="email" autocomplete="email" maxlength="254" placeholder="you@business.in" value="<?= htmlspecialchars($submittedEmail, ENT_QUOTES, 'UTF-8') ?>" required>
                            </label>
                            <?php if ($formError !== ''): ?><p class="auth-error" role="alert"><?= htmlspecialchars($formError, ENT_QUOTES, 'UTF-8') ?></p><?php endif; ?>
                            <button class="btn btn--primary btn--lg auth-submit" type="submit"><?= htmlspecialchars($submitLabel, ENT_QUOTES, 'UTF-8') ?></button>
                        </form>
                    <?php elseif ($recoveryStep === 'otp'): ?>
                        <p class="auth-notice" role="status">If an active account matches <strong><?= htmlspecialchars($recoveryEmail, ENT_QUOTES, 'UTF-8') ?></strong>, a six-digit code may arrive shortly. It expires five minutes after it is issued.</p>
                        <form class="auth-form otp-form" method="post" action="forgot-password.php" data-otp-form data-resend-wait="<?= (int) $recoveryWaitSeconds ?>">
                            <input type="hidden" name="_csrf_token" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>">
                            <fieldset class="otp-fields">
                                <legend class="field__label">Six-digit verification code</legend>
                                <div class="otp-inputs" dir="ltr">
                                    <?php for ($index = 0; $index < 6; $index++): ?>
                                        <input class="input otp-input" type="text" name="otp_digit[]" inputmode="numeric" pattern="[0-9]" maxlength="1" autocomplete="<?= $index === 0 ? 'one-time-code' : 'off' ?>" aria-label="Code digit <?= $index + 1 ?>" required>
                                    <?php endfor; ?>
                                </div>
                                <input type="hidden" name="otp" value="">
                            </fieldset>
                            <?php if ($formError !== ''): ?><p class="auth-error" role="alert"><?= htmlspecialchars($formError, ENT_QUOTES, 'UTF-8') ?></p><?php endif; ?>
                            <div class="otp-actions">
                                <button class="btn btn--primary btn--lg auth-submit" type="submit" name="recovery_action" value="verify"><?= htmlspecialchars($submitLabel, ENT_QUOTES, 'UTF-8') ?></button>
                                <button class="btn btn--secondary auth-submit" type="submit" name="recovery_action" value="resend" data-resend-button <?= $recoveryWaitSeconds > 0 ? 'disabled' : '' ?> formnovalidate>Resend code <span data-resend-countdown aria-live="off"></span></button>
                            </div>
                        </form>
                    <?php else: ?>
                        <form class="auth-form" method="post" action="forgot-password.php" data-auth-form data-submit-lock>
                            <input type="hidden" name="_csrf_token" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>">
                            <input type="hidden" name="recovery_action" value="reset">
                            <label class="field password-field">
                                <span class="field__label">New password</span>
                                <span class="password-input-wrap">
                                    <input class="input" type="password" name="password" autocomplete="new-password" minlength="6" maxlength="72" required>
                                    <button class="password-toggle" type="button" data-toggle-password aria-label="Show new password" aria-pressed="false">
                                        <svg class="icon" aria-hidden="true" focusable="false"><use href="assets/img/icons.svg#i-eye"></use></svg>
                                    </button>
                                </span>
                            </label>
                            <label class="field password-field">
                                <span class="field__label">Confirm password</span>
                                <span class="password-input-wrap">
                                    <input class="input" type="password" name="confirm_password" autocomplete="new-password" minlength="6" maxlength="72" required>
                                    <button class="password-toggle" type="button" data-toggle-password aria-label="Show confirm password" aria-pressed="false">
                                        <svg class="icon" aria-hidden="true" focusable="false"><use href="assets/img/icons.svg#i-eye"></use></svg>
                                    </button>
                                </span>
                            </label>
                            <?php if ($formError !== ''): ?><p class="auth-error" role="alert"><?= htmlspecialchars($formError, ENT_QUOTES, 'UTF-8') ?></p><?php endif; ?>
                            <p class="auth-error" role="alert" data-auth-error hidden></p>
                            <button class="btn btn--primary btn--lg auth-submit" type="submit"><?= htmlspecialchars($submitLabel, ENT_QUOTES, 'UTF-8') ?></button>
                        </form>
                    <?php endif; ?>
                <?php else: ?>
                    <form class="auth-form" method="post" action="<?= htmlspecialchars($formAction, ENT_QUOTES, 'UTF-8') ?>" data-auth-form data-submit-lock>
                        <input type="hidden" name="_csrf_token" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>">
                        <?php if ($mode === 'register'): ?>
                            <label class="field">
                                <span class="field__label">Your name</span>
                                <input class="input" type="text" name="name" autocomplete="name" maxlength="120" value="<?= htmlspecialchars(is_string($_POST['name'] ?? null) ? $_POST['name'] : '', ENT_QUOTES, 'UTF-8') ?>" required>
                            </label>
                            <label class="field">
                                <span class="field__label">Business name</span>
                                <input class="input" type="text" name="business" autocomplete="organization" maxlength="160" value="<?= htmlspecialchars(is_string($_POST['business'] ?? null) ? $_POST['business'] : '', ENT_QUOTES, 'UTF-8') ?>" required>
                            </label>
                        <?php endif; ?>
                        <label class="field">
                            <span class="field__label">Email address</span>
                            <input class="input" type="email" name="email" autocomplete="email" maxlength="254" placeholder="you@business.in" value="<?= htmlspecialchars($submittedEmail, ENT_QUOTES, 'UTF-8') ?>" required>
                        </label>
                        <label class="field">
                            <span class="field__label">Password</span>
                            <span class="password-input-wrap">
                                <input class="input" type="password" name="password" autocomplete="<?= $mode === 'login' ? 'current-password' : 'new-password' ?>" minlength="6" maxlength="72" <?= $mode === 'register' ? 'data-password-strength-input aria-describedby="password-strength-label"' : '' ?> required>
                                <button class="password-toggle" type="button" data-toggle-password aria-label="Show password" aria-pressed="false">
                                    <svg class="icon" aria-hidden="true" focusable="false"><use href="assets/img/icons.svg#i-eye"></use></svg>
                                </button>
                            </span>
                        </label>
                        <?php if ($mode === 'register'): ?>
                            <div class="password-strength">
                                <div class="password-strength__header">
                                    <span id="password-strength-label">Password strength</span>
                                    <output data-password-strength-text aria-live="polite">Not entered</output>
                                </div>
                                <div class="password-strength__meter" role="meter" aria-label="Password strength" aria-valuemin="0" aria-valuemax="4" aria-valuenow="0" data-password-strength-meter>
                                    <span></span><span></span><span></span><span></span>
                                </div>
                                <small>Use at least 6 characters. A mix of letters, numbers, and symbols is stronger.</small>
                            </div>
                            <label class="field">
                                <span class="field__label">Confirm password</span>
                                <span class="password-input-wrap">
                                    <input class="input" type="password" name="confirm_password" autocomplete="new-password" minlength="6" maxlength="72" required>
                                    <button class="password-toggle" type="button" data-toggle-password aria-label="Show confirm password" aria-pressed="false">
                                        <svg class="icon" aria-hidden="true" focusable="false"><use href="assets/img/icons.svg#i-eye"></use></svg>
                                    </button>
                                </span>
                            </label>
                        <?php endif; ?>
                        <?php if ($formError !== ''): ?><p class="auth-error" role="alert"><?= htmlspecialchars($formError, ENT_QUOTES, 'UTF-8') ?></p><?php endif; ?>
                        <?php if ($notice !== ''): ?><p class="auth-notice" role="status"><?= htmlspecialchars($notice, ENT_QUOTES, 'UTF-8') ?></p><?php endif; ?>
                        <?php if ($mode === 'register'): ?><p class="auth-error" role="alert" data-auth-error hidden></p><?php endif; ?>
                        <button class="btn btn--primary btn--lg auth-submit" type="submit"><?= htmlspecialchars($submitLabel, ENT_QUOTES, 'UTF-8') ?></button>
                    </form>
                <?php endif; ?>

                <nav class="auth-links" aria-label="Account options">
                    <?php if ($mode === 'login'): ?>
                        <a href="forgot-password.php">Forgot password?</a>
                        <span>New to DokanFlow? <a href="register.php">Create an account</a></span>
                    <?php elseif ($mode === 'register'): ?>
                        <span>Already have an account? <a href="login.php">Sign in</a></span>
                    <?php elseif ($mode === 'forgot-password'): ?>
                        <?php if ($recoveryStep !== 'email'): ?><a href="forgot-password.php?restart=1">Use a different email</a><?php endif; ?>
                        <span>Remembered it? <a href="login.php">Back to sign in</a></span>
                    <?php endif; ?>
                </nav>
                <p class="auth-disclaimer">Your account is protected with a secure session. Each account receives its own business workspace.</p>
                <p class="auth-protection">Protected by <a href="https://souhardyakarmakar.github.io/souhardya-portfolio/frenchcat/index.html" target="_blank" rel="noopener noreferrer">French Cat</a></p>
            </div>
        </section>
    </main>
    <div id="toast-root" class="toast-root" aria-live="polite"></div>
    <script type="module" src="assets/js/auth-form.js"></script>
    <?php if ($mode === 'forgot-password'): ?><script type="module" src="assets/js/password-recovery.js"></script><?php endif; ?>
</body>
</html>
