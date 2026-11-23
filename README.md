# DokanFlow
FULL WORKING SITE IS LIVE AT dokanflow.site.je
#### Made with Code Blender

<sub>Made by Souhardya &amp; Debartha</sub>

---

**DokanFlow** is a digital back office for Indian micro and small businesses. It brings everyday business records—customers, orders, invoices, payments, expenses, reminders, and cash-flow views—into one workspace.

Built around the hackathon problem statement **“The One-Person Back Office,”** DokanFlow aims to help a shop owner or service provider manage routine business operations without a large team or complicated software.

> **Current implementation note:** Registration, login, logout, password recovery, and owner profile operations use the PHP/MySQL backend. Most day-to-day workspace sections still use browser demo data and are not yet persisted to MySQL. The payment collection panel is disabled; no real payment is processed.

## Features

- Business overview dashboard with sample metrics and charts.
- Customer, orders and services, invoices, payments, expenses, cash-flow, reminders, and reports interfaces.
- Owner registration and business workspace creation.
- Email-and-password login and logout with PHP sessions.
- Password hashing, CSRF protection, login throttling, and one-time password-recovery codes.
- Owner profile updates saved to the database.
- Responsive interface with search, filters, dialogs, notifications, and browser-side demo interactions.

## Technology

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | PHP 8.2+ |
| Database | MySQL or MariaDB |
| Database access | PDO / PDO MySQL |
| Local server | XAMPP (Apache + MySQL/MariaDB) |
| Database administration | phpMyAdmin |
| Optional email | PHPMailer + SMTP |

## Requirements

1. XAMPP with **PHP 8.2 or newer**.
2. Apache and MySQL/MariaDB enabled in the XAMPP Control Panel.
3. PHP extensions: `pdo`, `pdo_mysql`, `openssl`, and `bcmath`.
4. Composer, to install PHPMailer.
5. A modern web browser.

The database migrations use `utf8mb4_unicode_ci`, a collation supported by common MySQL and MariaDB versions distributed with XAMPP. This avoids the MySQL-8-only `utf8mb4_0900_ai_ci` collation that can prevent migrations from running on MariaDB.

## Install and run with XAMPP

These instructions are for Windows and assume the project folder is named `DokanFlow`.

### 1. Install and start XAMPP

1. Install XAMPP with PHP 8.2+.
2. Open **XAMPP Control Panel**.
3. Click **Start** next to **Apache**.
4. Click **Start** next to **MySQL**.
5. Make sure both services are running.

Resolve any port conflict shown by XAMPP before continuing.

### 2. Put the project in `htdocs`

1. Download this repository as a ZIP and extract it (or clone the repository).
2. Copy the project folder to:

   ```text
   C:\xampp\htdocs\DokanFlow\
   ```

3. Confirm that `index.php`, `login.php`, `register.php`, `app/`, `config/`, `database/`, and `assets/` are directly inside that folder.

Avoid accidentally nesting the project, such as `C:\xampp\htdocs\DokanFlow\DokanFlow\index.php`.

### 3. Verify PHP extensions

Open XAMPP Shell and run:

```bat
C:\xampp\php\php.exe -v
C:\xampp\php\php.exe -m
```

Confirm PHP is 8.2+ and the module list contains `PDO`, `pdo_mysql`, `openssl`, and `bcmath`.

If an extension is disabled, open `C:\xampp\php\php.ini`, enable its extension directive (remove the leading `;` if present), save, and restart Apache. The PHP CLI must also load these extensions if you use the optional migration or seed commands; importing the SQL in phpMyAdmin does not require the PHP CLI.

### 4. Create the database schema with phpMyAdmin

1. Visit [http://localhost/phpmyadmin](http://localhost/phpmyadmin).
2. Open the **Import** tab from the phpMyAdmin server home page.
3. Choose `database/dokanflow.sql` from the project folder and click **Import** (or **Go**).

The script creates the `dokanflow` database and all tables using `utf8mb4_unicode_ci`. You do not need to create the database manually or run multiple SQL files. Importing the SQL creates the database schema; it does not configure the PHP application's connection settings. Import this file into a fresh local database.

A default local XAMPP installation often uses database user `root` with a blank password. If yours differs, use your actual credentials in `.env`. For a shared or production server, create a dedicated database user with only the required database privileges.

### 5. Install PHP dependencies

Open XAMPP Shell or Command Prompt and run:

```bat
cd C:\xampp\htdocs\DokanFlow
composer install
```

This installs PHPMailer and creates the `vendor/` directory. If `composer` is not recognised, install Composer for Windows, configure it to use `C:\xampp\php\php.exe`, then reopen the terminal.

### 6. Create and configure your local `.env` file

In the project root, copy `.env.example` to `.env`:

```bat
copy .env.example .env
```

The example is configured for a typical local XAMPP setup:

```dotenv
APP_ENV=local
APP_DEBUG=true
APP_URL=http://localhost/DokanFlow
APP_TIMEZONE=Asia/Kolkata
APP_FORCE_HTTPS=false
APP_KEY=PASTE_A_GENERATED_KEY_HERE

DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=dokanflow
DB_USER=root
DB_PASS=

MAIL_HOST=smtp-relay.brevo.com
MAIL_PORT=587
MAIL_ENCRYPTION=tls
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_FROM=
MAIL_FROM_NAME=DokanFlow
```

Generate a unique application key from the project directory:

```bat
C:\xampp\php\php.exe -r "echo bin2hex(random_bytes(32)), PHP_EOL;"
```

Copy the 64-character output into `APP_KEY`. Do not leave the placeholder value in place. If your MySQL account has a password, set `DB_PASS` accordingly. The current application accepts `DB_PASS`; existing local configurations using `DB_PASSWORD` continue to work as a fallback.

**Never upload `.env` to GitHub.** It can contain database passwords, SMTP credentials, and the application key. This repository contains `.env.example` only; each person must create their own local `.env`.

### 7. Open DokanFlow and test registration/login

With Apache and MySQL running, open:

- **Application:** [http://localhost/DokanFlow/](http://localhost/DokanFlow/)
- **Registration:** [http://localhost/DokanFlow/register.php](http://localhost/DokanFlow/register.php)
- **Login:** [http://localhost/DokanFlow/login.php](http://localhost/DokanFlow/login.php)

Register with your name, business name, email, and password. Registration creates the owner account, business workspace, membership, and business settings in MySQL. After successful registration, sign in with the same email and password on the login page. If you already have an account, test login directly.

## Optional email setup

Email delivery is required for password-recovery OTP emails. To enable it, configure a valid SMTP account in `.env`:

```dotenv
MAIL_HOST=smtp-relay.brevo.com
MAIL_PORT=587
MAIL_ENCRYPTION=tls
MAIL_USERNAME=YOUR_BREVO_SMTP_LOGIN
MAIL_PASSWORD=YOUR_BREVO_SMTP_KEY
MAIL_FROM=YOUR_VERIFIED_SENDER_EMAIL
MAIL_FROM_NAME=DokanFlow
```

Use the SMTP login and SMTP key provided by Brevo—not your normal account password. The sender address must be verified. Keep these values private. If SMTP is blank or unreachable, password-recovery email delivery will not work; registration and login can still be tested locally.

## Project structure

```text
DokanFlow/
├── app/                      Authentication, database and support classes
├── assets/                   CSS, JavaScript, images and icons
├── bin/                      Migration and development server scripts
├── config/                   App, database, mail and security configuration
├── database/
│   ├── dokanflow.sql         One-file XAMPP schema import
│   ├── migrations/           Numbered PHP database migrations
│   ├── seeds/                Optional demo data
│   └── infinityfree-auth-schema.sql
├── includes/                 Shared page components
├── pages/                    Dashboard workspace sections
├── .env.example              Safe environment template
├── .gitignore                Git exclusions
├── composer.json             PHP dependencies
├── index.php                 Authenticated dashboard entry point
├── login.php                 Login page
├── register.php              Registration page
└── README.md                 Setup and project documentation
```

## Security notes

- Passwords are hashed using PHP password-hashing functions.
- Database access uses PDO prepared statements.
- Account forms use CSRF protection.
- Authentication uses PHP sessions and session regeneration.
- Login attempts are throttled.
- Password-recovery codes are stored as hashes and expire.
- Keep `.env`, SMTP credentials, database passwords, and application keys private.
- Use HTTPS and `APP_DEBUG=false` for a real production deployment.
- Do not expose internal configuration files or error details on a public server.

## Current limitations

Please distinguish working backend features from frontend demonstrations.

**Connected to MySQL:**
- Owner registration and business workspace creation.
- Login and logout.
- Password-recovery OTP storage and verification (email delivery requires SMTP configuration).
- Owner profile updates.
- Database migrations for identity, customers/orders, invoices/items, finance/security, and recovery-related tables.

**Currently browser/demo-side:**
- Overview, Customers, Orders & Services, Invoices, Payments, Expenses, Cash Flow, Reminders, and Reports & Settings interactions.
- Operational records are stored in account-namespaced browser `sessionStorage`; they are not saved to MySQL or shared across devices.
- Reports and cash-flow values use demo/sample data; CSV export is generated in the browser.
- Appearance and notification preferences are stored locally in the browser.

**Not implemented as live integrations:**
- Payment collection is disabled; no real payment is processed.
- WhatsApp reminders are message drafts/links; the application does not send WhatsApp messages itself.
- Team invitations and role-specific action policies are not implemented.

## Troubleshooting

### Missing `pdo_mysql` / `could not find driver`

Enable `pdo_mysql` in the PHP configuration used by XAMPP and verify it with:

```bat
C:\xampp\php\php.exe -m
```

Restart Apache after changing `php.ini`.

### Database connection error

- Confirm MySQL is running in XAMPP.
- Check `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASS` in `.env` (`DB_PASSWORD` is also supported for older local configurations).
- Confirm the `dokanflow` database exists in phpMyAdmin.

### Missing `APP_KEY`

Generate a key using the command in Step 6 and set it in `.env`.

### Missing PHPMailer or `vendor/autoload.php`

Run `composer install` in the project root and confirm the `vendor/` folder was created.

### Password-recovery email is not arriving

Check SMTP credentials, sender verification, port 587 connectivity, and spam/junk folders. Email recovery cannot deliver messages until SMTP is configured.

### Apache shows 403 or 404

Check that the folder is `C:\xampp\htdocs\DokanFlow`, Apache is running, and the browser URL contains `/DokanFlow/`.

---

**DokanFlow — The One-Person Back Office.**
