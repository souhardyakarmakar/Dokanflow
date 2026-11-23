# DokanFlow

DokanFlow is a business-management application for Indian micro-businesses. The PHP 8.2+/MySQL foundation includes account registration, password login, secure PHP sessions, owner workspaces, database migrations, and local demo seeding. Password recovery verifies a five-minute email OTP sent with PHPMailer through Brevo SMTP. OTPs are HMAC-hashed at rest, and reset authorization is bound to the server-side session and hashed in the database.

## Run locally

From this directory, start PHP's built-in development server:

```powershell
php -S 127.0.0.1:8000 -t . bin/dev-server-router.php
```

Open `http://127.0.0.1:8000/`. Chart.js is loaded from its public CDN for the overview charts; the remaining sections continue to work if it is unavailable.

## Backend foundation setup

The authentication backend requires PHP 8.2+, MySQL, and the PHP `pdo_mysql`, `bcmath`, and `openssl` extensions. Composer is not required on shared hosting, but install dependencies locally and upload `vendor/` because PHPMailer is used for SMTP.

1. Install the project autoloader and PHPMailer with `composer install --no-dev --optimize-autoloader`. If this is the first Composer install, commit the generated `composer.lock` so future deployments use the same dependency versions.
2. As a MySQL administrator, create the local database and a dedicated account. Replace the password placeholder before running this SQL, and use the same credentials in `.env`:

   ```sql
   CREATE DATABASE dokanflow
       CHARACTER SET utf8mb4
       COLLATE utf8mb4_0900_ai_ci;

   CREATE USER 'dokanflow'@'127.0.0.1'
       IDENTIFIED BY 'REPLACE_WITH_A_UNIQUE_PASSWORD';

   GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
       ON dokanflow.*
       TO 'dokanflow'@'127.0.0.1';
   ```

   These schema-creation privileges are for local development. Use a separate, least-privilege runtime account in a production deployment.
3. Copy `.env.example` to `.env` and set the database connection values. Generate a unique application key with `php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"`; put the output in `APP_KEY`. Set the Brevo SMTP host, port `587`, encryption `tls`, SMTP login, SMTP key, and a sender address verified in Brevo. Keep `APP_ENV=local` and `APP_DEBUG=true` only on a local machine. Never commit `.env` or send secret values through chat.
4. Run `php bin/migrate.php` to apply the checksummed schema migrations. Migration 006 removes the old optional email-verification schema; migration 007 adds the password-recovery OTP table.
5. In `APP_ENV=local` or `APP_ENV=test` only, set `DEMO_OWNER_NAME`, `DEMO_OWNER_EMAIL`, and a unique `DEMO_OWNER_PASSWORD` of 6-72 characters, then run `php bin/seed.php` to create the demo owner and sample ledger records. The seed is idempotent and does not reset an existing password.
6. Open `register.php` to create an owner account and a separate business workspace. Registration inserts the user, business, owner membership, business settings, and audit record in a database transaction, then signs the user in with a PHP session. Login uses email and password; the authenticated session stores the database user ID.

## Deploy to InfinityFree

1. Create a MySQL database in the InfinityFree control panel. Use the exact database host, database name, and username shown there; the host is often not `localhost`.
2. On your own computer, run `composer install` from the project directory and upload the generated `vendor/` folder along with the application. Composer is not required on the host; `app/bootstrap.php` loads `vendor/autoload.php`.
3. Upload the project files to the website's document root. Keep the existing `.htaccess`; it denies web access to `.env`, `database/`, `app/`, `config/`, `vendor/`, and other private paths.
4. Copy `.env.example` to `.env` in the DokanFlow project root on the host. Set `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL` to the site's HTTPS URL, `APP_FORCE_HTTPS=true`, the `DB_*` values from the hosting control panel, and the SMTP settings described below. Keep the Brevo SMTP key private in `.env`; use a sender address verified by Brevo. The SMTP relay uses authenticated STARTTLS on port 587 only.
5. In InfinityFree phpMyAdmin, select the newly created empty database and import `database/infinityfree-auth-schema.sql` from your local project copy. It includes the OTP recovery table. For an existing installation, execute the `CREATE TABLE password_recovery_otps` statement from migration 007 in phpMyAdmin. Do not run `bin/migrate.php` after importing the full schema.
6. Confirm the selected PHP version is 8.2+, and `pdo_mysql` and `openssl` are enabled. Verify InfinityFree permits outbound SMTP connections to Brevo on port 587. Then open the HTTPS site, create an account, and sign in.

### Brevo SMTP settings

Store these values in the protected project-root `.env` (never in PHP source, HTML, JavaScript, or a public repository):

```dotenv
MAIL_HOST=smtp-relay.brevo.com
MAIL_PORT=587
MAIL_ENCRYPTION=tls
MAIL_USERNAME=your-brevo-smtp-login
MAIL_PASSWORD=your-private-brevo-smtp-key
MAIL_FROM=your-verified-sender@example.com
MAIL_FROM_NAME=DokanFlow
```

The sender must be verified in the Brevo account, and `MAIL_USERNAME`/`MAIL_PASSWORD` must be the SMTP credentials from Brevo, not the account password or an API key. `config/mail.php` enforces STARTTLS on port 587. Rotate any SMTP key that has been shared or exposed, then put only the replacement in `.env`.

To inspect applied migrations and database relationships after migration, run:

```sql
SELECT migration_name, status, applied_at
FROM schema_migrations
ORDER BY migration_name;

SELECT TABLE_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'dokanflow'
  AND REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY TABLE_NAME, CONSTRAINT_NAME;
```

Do not expose `.env`, `config/`, `app/`, `database/`, `bin/`, or `vendor/` through a production web document root. Configure equivalent access restrictions in the web server; `.htaccess` applies only to Apache. The local PHP built-in server command above uses a router to block these paths and is not suitable for production deployment.

## Project map

```text
index.php                 Dashboard shell and allow-listed section routing
profile.php               Signed-in owner profile route
settings.php              Browser-only application preferences
auth-page.php             Shared registration/login controller and OTP recovery screens
login.php                 Database-backed sign-in screen
register.php              Database-backed registration and workspace creation
forgot-password.php       Email OTP request, verification, and password reset
reset-password.php        Legacy route redirected to restart OTP recovery
logout.php                CSRF-protected session logout
app/Auth/                 Authentication, OTP recovery, SMTP mail delivery and workspace checks
database/migrations/007_password_recovery_otp.php OTP challenge and short-lived authorization storage
database/infinityfree-auth-schema.sql Tables needed for shared-host SQL account setup
includes/                 Shared header, sidebar, navigation, footer and script loading
pages/                    Nine workspace sections plus profile and application settings
assets/css/               Design tokens, account pages, components, motion, responsive and polish layers
assets/js/app.js          Navigation, layers, dropdowns, keyboard and toast behavior
assets/js/auth-form.js    Client-side password strength and confirmation feedback
assets/js/global-search.js Cross-section search suggestions and filtered result routes
assets/js/preferences.js  Browser-local appearance and notification preferences
assets/js/profile.js      Session-scoped demo owner profile editing
assets/js/sections.js     Section state, tables, forms, reports and calculations
assets/js/dashboard.js    Overview calculations and charts
assets/js/data/           Deterministic mock records and account-namespaced demo state
assets/js/utils/          Formatting and date helpers
```

## Frontend behavior

- The nine workspace sections are Overview, Customers, Orders & Services, Invoices, Payments, Expenses, Cash Flow, Reminders, and Reports & Settings.
- Customer, order, invoice, payment and expense edits are stored in account-namespaced `sessionStorage`, so one signed-in account does not load another account's browser demo edits. Closing the tab ends that demo data session; server persistence for these operational records is not yet integrated.
- Invoice totals apply discount before GST and round tax per item to paise. Payment entry cannot exceed the remaining invoice balance.
- Cash-flow figures are estimates derived from sample ledger data and are labeled as such.
- Global search suggests matching customers, orders, invoices, payments and expenses from demo data, and opens the corresponding filtered section.
- Profile name, email and phone edits are saved to the authenticated MySQL account and business records. Application appearance, density and notification preferences remain local browser preferences.
- Reports provide monthly, yearly and custom date ranges, revenue/expense/outstanding analytics and a browser-generated CSV export.
- The payment collection panel is intentionally disabled and labeled as not connected. No real payment is initiated or reported as successful.
- Registration and sign-in use database-backed password hashes, secure PHP sessions, CSRF tokens, login throttling, and a new business workspace per account. Passwords require at least 6 characters and the registration screen shows a strength meter. Successful registration signs in the new database user immediately.
- Password recovery uses a cryptographically generated six-digit OTP, HMAC-hashed at rest, expiring after five minutes. It enforces five wrong attempts per code, a 30-second resend cooldown, and three sends per email in 15 minutes. A verified OTP grants a ten-minute reset authorization stored in the PHP session and database; successful password changes consume it and invalidate outstanding OTPs and legacy reset links.

## Motion system

- `assets/css/animations.css` documents 90 motion opportunities across route changes, navigation, dashboard data, forms, tables, dialogs, toasts and account screens.
- Section content is staggered only on its initial render; typing into search and filters does not replay the entrance sequence. Dashboard charts and KPI counters keep their existing data-aware animations.
- Motion is primarily limited to opacity, transforms and color/shadow transitions. The global `prefers-reduced-motion` rules minimize transitions and disable decorative keyframes; chart and counter animations also respect that preference.

## Manual validation checklist

- [ ] Visit all nine dashboard sections and confirm the active navigation state.
- [ ] Search and filter customer, order, invoice, payment and expense lists.
- [ ] Use header global search from any route and follow a filtered result to its section.
- [ ] Create/edit/view/delete demo records and confirm dialogs/toasts.
- [ ] Verify invoice line totals, discount, GST, partial/full payment and remaining balance.
- [ ] Check order status updates, reminder message copy/WhatsApp draft, and invoice print preview.
- [ ] Save business preferences and confirm reports/forecast values update where relevant.
- [ ] Save owner profile details; toggle application settings and confirm browser-local persistence.
- [ ] Check monthly, yearly and custom report ranges and download the demo CSV.
- [ ] Register two accounts and confirm each receives its own SQL business workspace and authenticated session.
- [ ] Sign in with valid and invalid credentials; verify protected routes redirect to sign-in.
- [ ] Request password recovery for both registered and unregistered addresses; confirm the response does not reveal account existence.
- [ ] Receive a Brevo OTP, test incorrect/expired codes, five-attempt lockout, the 30-second resend cooldown, and the three-per-15-minute send limit.
- [ ] Verify a correct OTP, reject direct reset access, change the password, confirm code/authorization reuse fails, and sign in only with the new password.
- [ ] Confirm missing/invalid CSRF tokens are rejected and SMTP failures never expose credentials or SMTP diagnostics.
- [ ] Check route transitions, first-render stagger, keyboard field feedback and modal/toast motion.
- [ ] Check reduced-motion behavior, mobile drawer, tables and modals at narrow widths.
- [ ] Confirm the browser console has no errors and the PHP templates pass `php -l`.

## Current backend boundaries

- Signup and login store account identity and business membership in MySQL. The current development environment has no configured `.env`, MySQL server, or PDO MySQL driver, so a live SQL insert could not be tested here. InfinityFree setup uses its phpMyAdmin import file and control-panel database settings.
- The nine operational sections still use browser demo state. Their changes are not written to MySQL yet; the normalized schema is present for the next API integration stage.
- The current account roles are stored and membership is rechecked on protected workspace requests; team invitations and role-specific action policies are not implemented.
- SMTP delivery requires valid Brevo SMTP credentials, a verified sender, PHPMailer installed locally and uploaded in `vendor/`, plus outbound port 587 and PHP OpenSSL support on the host. SMTP delivery could not be exercised without those external credentials and host access. No payment gateway or real reminder delivery is enabled.
- Production hosting must point its document root at the application public files and deny access to internal directories. Configure equivalent restrictions in Apache, Nginx, or IIS; `.htaccess` only applies to Apache.
- The authentication hero uses a decorative office photo from Unsplash (`photo-1497366754035-f200968a6e72`) as a free demonstration asset. Replace it with a locally licensed/hosted image if external image requests are not desired.
