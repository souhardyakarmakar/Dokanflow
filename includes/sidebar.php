<aside id="sidebar" class="app-sidebar" aria-label="Primary">
    <div class="sidebar-brand">
        <a class="sidebar-logo" href="index.php?page=overview">
            <img src="assets/img/logo.svg" alt="DokanFlow" width="36" height="36">
            <span class="nav-label">DokanFlow</span>
        </a>
        <button class="btn btn--ghost btn--icon sidebar-collapse" type="button" data-action="toggle-sidebar" aria-label="Collapse sidebar">
            <svg class="icon" aria-hidden="true"><use href="assets/img/icons.svg#i-chevron-down"></use></svg>
        </button>
    </div>

    <div class="sidebar-nav">
        <span class="nav-indicator" aria-hidden="true"></span>
        <ul class="nav-list">
        <li>
            <a class="nav-link<?= $activePage === 'overview' ? ' is-active' : '' ?>" href="index.php?page=overview" data-nav="overview" aria-label="Overview" title="Overview"<?= $activePage === 'overview' ? ' aria-current="page"' : '' ?>>
                <svg class="icon" aria-hidden="true"><use href="assets/img/icons.svg#i-home"></use></svg>
                <span class="nav-label">Overview</span>
            </a>
        </li>
        <li>
            <a class="nav-link<?= $activePage === 'customers' ? ' is-active' : '' ?>" href="index.php?page=customers" data-nav="customers" aria-label="Customers" title="Customers"<?= $activePage === 'customers' ? ' aria-current="page"' : '' ?>>
                <svg class="icon" aria-hidden="true"><use href="assets/img/icons.svg#i-users"></use></svg>
                <span class="nav-label">Customers</span>
            </a>
        </li>
        <li>
            <a class="nav-link<?= $activePage === 'orders' ? ' is-active' : '' ?>" href="index.php?page=orders" data-nav="orders" aria-label="Orders &amp; Services" title="Orders &amp; Services"<?= $activePage === 'orders' ? ' aria-current="page"' : '' ?>>
                <svg class="icon" aria-hidden="true"><use href="assets/img/icons.svg#i-wrench"></use></svg>
                <span class="nav-label">Orders &amp; Services</span>
            </a>
        </li>
        <li>
            <a class="nav-link<?= $activePage === 'invoices' ? ' is-active' : '' ?>" href="index.php?page=invoices" data-nav="invoices" aria-label="Invoices" title="Invoices"<?= $activePage === 'invoices' ? ' aria-current="page"' : '' ?>>
                <svg class="icon" aria-hidden="true"><use href="assets/img/icons.svg#i-file-text"></use></svg>
                <span class="nav-label">Invoices</span>
            </a>
        </li>
        <li>
            <a class="nav-link<?= $activePage === 'payments' ? ' is-active' : '' ?>" href="index.php?page=payments" data-nav="payments" aria-label="Payments" title="Payments"<?= $activePage === 'payments' ? ' aria-current="page"' : '' ?>>
                <svg class="icon" aria-hidden="true"><use href="assets/img/icons.svg#i-credit-card"></use></svg>
                <span class="nav-label">Payments</span>
            </a>
        </li>
        <li>
            <a class="nav-link<?= $activePage === 'expenses' ? ' is-active' : '' ?>" href="index.php?page=expenses" data-nav="expenses" aria-label="Expenses" title="Expenses"<?= $activePage === 'expenses' ? ' aria-current="page"' : '' ?>>
                <svg class="icon" aria-hidden="true"><use href="assets/img/icons.svg#i-receipt"></use></svg>
                <span class="nav-label">Expenses</span>
            </a>
        </li>
        <li>
            <a class="nav-link<?= $activePage === 'cashflow' ? ' is-active' : '' ?>" href="index.php?page=cashflow" data-nav="cashflow" aria-label="Cash Flow" title="Cash Flow"<?= $activePage === 'cashflow' ? ' aria-current="page"' : '' ?>>
                <svg class="icon" aria-hidden="true"><use href="assets/img/icons.svg#i-trending-up"></use></svg>
                <span class="nav-label">Cash Flow</span>
            </a>
        </li>
        <li>
            <a class="nav-link<?= $activePage === 'reminders' ? ' is-active' : '' ?>" href="index.php?page=reminders" data-nav="reminders" aria-label="Reminders" title="Reminders"<?= $activePage === 'reminders' ? ' aria-current="page"' : '' ?>>
                <svg class="icon" aria-hidden="true"><use href="assets/img/icons.svg#i-bell"></use></svg>
                <span class="nav-label">Reminders</span>
            </a>
        </li>
        <li>
            <a class="nav-link<?= $activePage === 'reports' ? ' is-active' : '' ?>" href="index.php?page=reports" data-nav="reports" aria-label="Reports &amp; Settings" title="Reports &amp; Settings"<?= $activePage === 'reports' ? ' aria-current="page"' : '' ?>>
                <svg class="icon" aria-hidden="true"><use href="assets/img/icons.svg#i-bar-chart"></use></svg>
                <span class="nav-label">Reports &amp; Settings</span>
            </a>
        </li>
        </ul>
    </div>

    <div class="sidebar-business card">
        <span class="nav-label">Business</span>
        <p data-business-label><?= htmlspecialchars((string) $authUser['business_name'], ENT_QUOTES, 'UTF-8') ?></p>
    </div>
</aside>
