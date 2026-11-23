<script src="assets/js/app.js" type="module"></script>
<script src="assets/js/preferences.js" type="module"></script>
<script src="assets/js/global-search.js" type="module"></script>
<script type="module" src="assets/js/sections.js"></script>
<?php if ($activePage === 'profile'): ?>
<script src="assets/js/profile.js" type="module"></script>
<?php endif; ?>
<?php if ($activePage === 'overview'): ?>
<script defer src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<script type="module" src="assets/js/dashboard.js"></script>
<?php endif; ?>
