<nav class="bottom-nav glass" aria-label="Quick navigation">
    <a class="bottom-nav__link<?= $activePage === 'overview' ? ' is-active' : '' ?>" href="index.php?page=overview" data-nav="overview"<?= $activePage === 'overview' ? ' aria-current="page"' : '' ?>>
        <svg class="icon" aria-hidden="true"><use href="assets/img/icons.svg#i-home"></use></svg>
        <span>Overview</span>
    </a>
    <a class="bottom-nav__link<?= $activePage === 'customers' ? ' is-active' : '' ?>" href="index.php?page=customers" data-nav="customers"<?= $activePage === 'customers' ? ' aria-current="page"' : '' ?>>
        <svg class="icon" aria-hidden="true"><use href="assets/img/icons.svg#i-users"></use></svg>
        <span>Customers</span>
    </a>
    <a class="bottom-nav__link<?= $activePage === 'invoices' ? ' is-active' : '' ?>" href="index.php?page=invoices" data-nav="invoices"<?= $activePage === 'invoices' ? ' aria-current="page"' : '' ?>>
        <svg class="icon" aria-hidden="true"><use href="assets/img/icons.svg#i-file-text"></use></svg>
        <span>Invoices</span>
    </a>
    <a class="bottom-nav__link<?= $activePage === 'payments' ? ' is-active' : '' ?>" href="index.php?page=payments" data-nav="payments"<?= $activePage === 'payments' ? ' aria-current="page"' : '' ?>>
        <svg class="icon" aria-hidden="true"><use href="assets/img/icons.svg#i-credit-card"></use></svg>
        <span>Payments</span>
    </a>
    <button class="bottom-nav__link" type="button" data-action="open-drawer" aria-controls="sidebar" aria-expanded="false">
        <svg class="icon" aria-hidden="true"><use href="assets/img/icons.svg#i-menu"></use></svg>
        <span>More</span>
    </button>
</nav>

<div class="drawer-overlay" data-action="close-drawer" hidden></div>
