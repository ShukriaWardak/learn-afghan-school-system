# Recover a local XAMPP sign-in

The website checks `users.password_hash` with PHP's `password_verify()`. It has no built-in website username/password. MySQL's `root` account and its password are database connection settings, separate from website accounts. The login error also covers an unknown username or inactive account.

Save `reset-local-login.php` in the project root beside `index.html`. It uses the existing `backend/config.local.php`. Run it with the XAMPP PHP executable from a terminal; browser requests receive 404.

First run `--list` to see existing website usernames, roles and account status. It displays no hashes or passwords. An inactive account needs its owner's review; this helper does not activate accounts or create new ones. If no account exists, use `backend/cli/first_admin.php` as documented in `backend/README.md`.

For Windows PowerShell, adjust the XAMPP path if needed:

```powershell
cd "C:\xampp\htdocs\learn_afghan_school\learn-afghan-school-system"
& "C:\xampp\php\php.exe" ".\reset-local-login.php" --list
$env:LEARN_RESET_USERNAME = Read-Host "Enter an active website username shown above"
$env:LEARN_RESET_PASSWORD = Read-Host "Choose a new password (12-72 bytes)"
try {
    & "C:\xampp\php\php.exe" ".\reset-local-login.php"
} finally {
    Remove-Item Env:LEARN_RESET_USERNAME, Env:LEARN_RESET_PASSWORD -ErrorAction SilentlyContinue
}
```

For macOS native XAMPP, use `/Applications/XAMPP/xamppfiles/bin/php` from the project folder. Run `--list`, then set `LEARN_RESET_USERNAME` and `LEARN_RESET_PASSWORD` in the terminal's environment before invoking the helper without arguments. Clear both variables with `unset` afterwards. Choose a password of 12-72 bytes.

Only the selected existing active account's hash is updated. Roles, account status and other records are preserved. A local CLI audit event is recorded without passwords/hashes; if auditing fails the password change rolls back. Existing sessions are not revoked by this helper. It does not clear login throttling: after a Too many attempts response, wait 15 minutes.

After the command reports success, use the selected username and new password at your project's `index.html` URL. Do not rerun first-admin enrollment to reset an account; it refuses when a super administrator already exists.
