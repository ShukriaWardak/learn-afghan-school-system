# Phase 7: Role-scoped branch CSV export — local test checklist

The CSV export is part of the development-only authenticated portal. There is **no new SQL migration**. Do not export real student, staff, HR, medical or financial information during development.

## Preparation
1. Start XAMPP Apache and MySQL and use the `learn_afghan` database.
2. Switch to `feature/php-mysql-portal-20261030`, and use only approved test branch records.
3. Log in at `http://localhost/learn-afghan-school-system/portal.html` with an authorized test account.

## Manual cases

| Check | Expected result |
| --- | --- |
| Super Admin clicks **Export authorized CSV** | All available branch records are downloaded |
| Zone Admin clicks Export | Only records in assigned zone are exported |
| Branch Admin clicks Export | Only assigned branch is exported |
| Department User requests `backend/api/branch_export.php` | HTTP 403; no CSV |
| Unauthenticated request | HTTP 401; no CSV |
| Empty authorized directory | Header-only CSV |
| Branch name includes comma or quotation mark | CSV values remain in correct columns |
| Non-Latin branch name | UTF-8 characters appear correctly |
| Branch name starts with `=`, `+`, `-`, or `@` | Export prefixes a single quote so spreadsheet software does not interpret it as a formula |
| User signs out and retries export | HTTP 401 |
| Compare branch list and export under same account | Export contains the same authorized branch set, not another role's records |

The export deliberately downloads **all server-authorized branches**, not only rows matching the current browser search/zone filter. The filename is `learn-afghan-authorized-branches.csv`.

## Local PHP syntax checks
```powershell
C:\xampp\php\php.exe -l backend\branch_directory.php
C:\xampp\php\php.exe -l backend\api\branches.php
C:\xampp\php\php.exe -l backend\api\branch_export.php
```

## Production warning
Do not deploy yet. The CSV exporter has basic spreadsheet formula mitigation, but privacy policy, export logging requirements, application threat modeling, rate limiting and role-permission sign-off are still required. This checklist describes expected results, **not verified end-to-end test results**.
