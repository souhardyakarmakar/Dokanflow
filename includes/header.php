<header class="app-header glass" role="banner">
    <button class="btn btn--ghost btn--icon header-menu-toggle" type="button" data-action="open-drawer" aria-controls="sidebar" aria-expanded="false" aria-label="Open menu">
        <svg class="icon" aria-hidden="true"><use href="assets/img/icons.svg#i-menu"></use></svg>
    </button>

    <a class="header-logo" href="index.php?page=overview">
        <img src="assets/img/logo.svg" alt="DokanFlow" width="32" height="32">
    </a>

    <nav class="header-breadcrumb" aria-label="Breadcrumb">
        <ol>
            <li>Dashboard</li>
            <li aria-current="page"><?= htmlspecialchars($pageTitle, ENT_QUOTES, 'UTF-8') ?></li>
        </ol>
    </nav>

    <h1 class="header-title"><?= htmlspecialchars($pageTitle, ENT_QUOTES, 'UTF-8') ?></h1>

    <form role="search" class="header-search" action="#" method="get">
        <svg class="icon" aria-hidden="true"><use href="assets/img/icons.svg#i-search"></use></svg>
        <input class="input" type="search" id="global-search" placeholder="Search customers, invoices, orders…" aria-label="Search" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-controls="global-search-results" aria-expanded="false" autocomplete="off">
        <kbd>/</kbd>
        <div class="global-search-results" id="global-search-results" role="listbox" aria-label="Search results" hidden></div>
    </form>

    <div class="header-actions">
        <div class="dropdown" data-dropdown-root>
            <button class="btn btn--ghost btn--icon" type="button" data-dropdown="notifications" aria-haspopup="true" aria-expanded="false" aria-controls="notifications-menu" aria-label="Notifications">
                <svg class="icon" aria-hidden="true"><use href="assets/img/icons.svg#i-bell"></use></svg>
                <span class="badge-dot" aria-hidden="true" hidden>0</span>
            </button>
            <div class="dropdown__menu dropdown__menu--notifications" id="notifications-menu" role="menu" hidden>
                <div role="menuitem" class="dropdown__item">No new notifications.</div>
            </div>
        </div>

        <button class="btn btn--ghost btn--icon" type="button" data-action="show-help" aria-label="Help">
            <svg class="icon" aria-hidden="true"><use href="assets/img/icons.svg#i-help-circle"></use></svg>
        </button>

        <div class="dropdown" data-dropdown-root>
            <button class="btn btn--ghost header-profile" type="button" data-dropdown="profile" aria-haspopup="true" aria-expanded="false" aria-controls="profile-menu">
                <span class="avatar" data-profile-avatar aria-hidden="true"><?= htmlspecialchars($avatarInitials, ENT_QUOTES, 'UTF-8') ?></span>
                <span class="header-profile__name" data-profile-name><?= htmlspecialchars((string) $authUser['name'], ENT_QUOTES, 'UTF-8') ?></span>
                <svg class="icon icon--sm" aria-hidden="true"><use href="assets/img/icons.svg#i-chevron-down"></use></svg>
                <span class="visually-hidden">Account menu</span>
            </button>
            <div class="dropdown__menu dropdown__menu--profile" id="profile-menu" role="menu" hidden>
                <a class="dropdown__item" role="menuitem" href="profile.php">
                    <svg class="icon" aria-hidden="true"><use href="assets/img/icons.svg#i-user"></use></svg>
                    Profile
                </a>
                <a class="dropdown__item" role="menuitem" href="settings.php">
                    <svg class="icon" aria-hidden="true"><use href="assets/img/icons.svg#i-settings"></use></svg>
                    Settings
                </a>
                <hr class="dropdown__divider">
                <form class="dropdown__logout" method="post" action="logout.php">
                    <input type="hidden" name="_csrf_token" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>">
                    <button class="dropdown__item" type="submit" role="menuitem">
                        <svg class="icon" aria-hidden="true"><use href="assets/img/icons.svg#i-log-out"></use></svg>
                        Sign out
                    </button>
                </form>
            </div>
        </div>
    </div>
</header>
