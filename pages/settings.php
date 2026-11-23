<section class="page-header">
    <div>
        <p class="eyebrow">Workspace preferences</p>
        <h2 class="page-title">Application settings</h2>
        <p class="page-subtitle">Personalize this browser’s DokanFlow workspace. These are separate from business and invoice settings.</p>
    </div>
</section>

<section class="account-page" aria-label="Application preferences">
    <article class="card account-card">
        <header class="card__header">
            <div>
                <h3 class="card__title">Appearance</h3>
                <p class="card__subtitle">Choose a comfortable theme and content density.</p>
            </div>
        </header>
        <div class="settings-list">
            <label class="settings-row" for="theme-choice">
                <span><strong>Colour theme</strong><small>Applies across the workspace in this browser.</small></span>
                <select class="select settings-select" id="theme-choice" name="theme">
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="system">Match device</option>
                </select>
            </label>
            <label class="settings-row" for="compact-choice">
                <span><strong>Compact layout</strong><small>Reduce card and section spacing to show more at once.</small></span>
                <input class="settings-switch" type="checkbox" id="compact-choice" name="compact">
            </label>
            <label class="settings-row" for="motion-choice">
                <span><strong>Reduce interface motion</strong><small>Minimize decorative transitions and entrance effects.</small></span>
                <input class="settings-switch" type="checkbox" id="motion-choice" name="reduceMotion">
            </label>
        </div>
    </article>
    <article class="card account-card">
        <header class="card__header">
            <div>
                <h3 class="card__title">Notifications</h3>
                <p class="card__subtitle">Control the demo notification indicators.</p>
            </div>
        </header>
        <div class="settings-list">
            <label class="settings-row" for="notifications-choice">
                <span><strong>Show notification badge</strong><small>Show the unread count beside the header bell.</small></span>
                <input class="settings-switch" type="checkbox" id="notifications-choice" name="notifications">
            </label>
        </div>
    </article>
    <p class="account-note">Preferences are stored locally in this browser only. They do not change business records or connect to a service.</p>
</section>