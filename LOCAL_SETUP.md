# Check your local LEARN Afghan installation

Open `check-setup.php` using the same browser URL prefix as your project's `index.html`.

For the previously supplied nested project folder, the link is:

http://localhost/learn_afghan_school/learn-afghan-school-system/check-setup.php

The page shows the exact project directory being served and checks PHP, PDO MySQL, `backend/config.local.php`, the database connection, the eight application tables and their required columns, and whether an active administrator exists. It performs no database writes. Credentials and account names are excluded from its output.

The page is restricted to direct localhost requests. You can also run it from the project folder with XAMPP's PHP executable:

Windows PowerShell (adjust the XAMPP folder if yours differs):

```powershell
& "C:\xampp\php\php.exe" "check-setup.php"
```

macOS with native XAMPP (adjust the installation path if needed):

```bash
"/Applications/XAMPP/xamppfiles/bin/php" check-setup.php
```

Command-line output is JSON with a `ready` flag and individual checks. A pass confirms basic prerequisites, not that every module or a production deployment is approved. The checker can run on PHP 8.0 to explain the application's PHP 8.1-or-newer requirement.

## What to do with a failed check

| Check | Next step |
| --- | --- |
| PHP version | Use the PHP version required by the application; check Apache's version as well as the terminal executable. |
| PDO driver | Enable `pdo_mysql` in the PHP configuration used by this server and restart Apache. |
| Configuration missing | Place `config.local.php` beside `backend/bootstrap.php`, using exactly that filename. Use the project directory displayed on this page. |
| Configuration invalid | Compare the PHP syntax and the five setting keys with `backend/config.example.php`. |
| Connection | Start MySQL/MariaDB and verify the configured host, port, database name and credentials locally. |
| Table missing | Apply the indicated schema/migration file in order: schema, 002, 003, then 004. |
| Columns missing | Compare the existing table's Structure with the indicated source file before modifying it. `CREATE TABLE IF NOT EXISTS` does not upgrade an incompatible existing table. |
| First administrator missing | Run the existing first-admin CLI helper using the instructions in `backend/README.md`. |
| Existing administrators inactive | Review the existing account; the first-admin helper does not replace existing administrator records. |

## Apply the setup-screen update

For an existing downloaded copy, copy `check-setup.php`, `reference-layout.css` and `live.js` from this revision into the matching locations in your project. Keep your existing `backend/config.local.php`. Refresh the browser after copying the updated files. The sign-in and server-error cards now have dark text on a white background and a **Check local setup** link.

For a Git checkout, preserve local work first, then fetch/pull `feature/student-registry` with `--ff-only`. The checker does not create accounts or reset passwords. After the basic checks pass, sign in with the administrator account created on that installation, add a synthetic student, reload and verify persistence.

Automated checks cover missing/malformed configuration, missing PDO driver, unknown database, missing tables/columns, administrator states, localhost restrictions, output redaction, read-only behavior and sign-in text contrast. See the GitHub Actions result for the exact commit. The team's own XAMPP installation still needs local verification.
