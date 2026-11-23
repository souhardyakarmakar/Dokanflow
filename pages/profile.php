<section class="page-header">
    <div>
        <p class="eyebrow">Your account</p>
        <h2 class="page-title">Profile</h2>
        <p class="page-subtitle">Update the authenticated owner details for this workspace.</p>
    </div>
</section>

<section class="account-page" aria-label="Profile details">
    <article class="card account-card">
        <header class="card__header">
            <div>
                <h3 class="card__title">Personal details</h3>
                <p class="card__subtitle">These details are saved securely to your account.</p>
            </div>
        </header>
        <form id="profile-form" class="section-stack" method="post" action="profile.php">
            <input type="hidden" name="_csrf_token" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>">
            <?php if (!empty($profileSuccess)): ?>
                <p class="form-success" role="status"><?= htmlspecialchars($profileSuccess, ENT_QUOTES, 'UTF-8') ?></p>
            <?php endif; ?>
            <?php if (!empty($profileError)): ?>
                <p class="form-error" role="alert"><?= htmlspecialchars($profileError, ENT_QUOTES, 'UTF-8') ?></p>
            <?php endif; ?>
            <div class="profile-summary">
                <span class="avatar avatar--large" id="profile-avatar" aria-hidden="true"><?= htmlspecialchars($avatarInitials, ENT_QUOTES, 'UTF-8') ?></span>
                <div>
                    <strong id="profile-summary-name"><?= htmlspecialchars((string) $authUser['name'], ENT_QUOTES, 'UTF-8') ?></strong>
                    <p class="field__hint">Business owner · <?= htmlspecialchars((string) $authUser['business_name'], ENT_QUOTES, 'UTF-8') ?></p>
                </div>
            </div>
            <div class="form-grid">
                <label class="field">
                    <span class="field__label">Full name</span>
                    <input class="input" type="text" name="owner" autocomplete="name" required maxlength="120" value="<?= htmlspecialchars((string) $authUser['name'], ENT_QUOTES, 'UTF-8') ?>">
                </label>
                <label class="field">
                    <span class="field__label">Email address</span>
                    <input class="input" type="email" name="email" autocomplete="email" required maxlength="254" value="<?= htmlspecialchars((string) $authUser['email'], ENT_QUOTES, 'UTF-8') ?>">
                </label>
                <label class="field">
                    <span class="field__label">Phone number</span>
                    <input class="input" type="tel" name="phone" autocomplete="tel" maxlength="32" value="<?= htmlspecialchars((string) ($authUser['phone'] ?? ''), ENT_QUOTES, 'UTF-8') ?>">
                </label>
            </div>
            <div class="inline-actions">
                <button class="btn btn--primary" type="submit">Save profile</button>
                <a class="btn btn--secondary" href="settings.php">Application settings</a>
            </div>
        </form>
    </article>
    <p class="account-note">Profile changes are shared across this signed-in account and workspace.</p>
</section>