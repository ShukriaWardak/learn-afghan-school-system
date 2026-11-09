# Finance code review — 9 November 2026

Branch: `feature/finance-dashboard-20261109`.

Base: the navigation fixes from PR 15, commit `1dbe6f755b8712bc9b8c9a5fc56ea796236b0f07`. This includes the shared working branch's latest reference dashboard, graduation photo and authenticated modules. The earlier Finance draft was integrated into this source in an isolated branch, preserving the reference totals, navigation fixes, login IDs, password verification and CSRF/session contracts. The Finance review is stacked on PR 15; neither PR is merged by these changes.

## Changes ready for review

- Migration 007 adds an AFN income/expense ledger without seeding accounts or transactions.
- Finance department members can add/edit within existing branch/zone assignments. Super administrators read all Finance entries; other roles are denied. No deletion is provided.
- Filters, 50-row pagination, exact decimal totals, creator/editor names, optional notes and correction reasons are available in the interface.
- Submission UUIDs protect create retries. Version checks reject stale edits. Each save and its audit event commit or roll back together.
- Finance forms and records clear immediately on session expiry or navigation. The existing branded sign-in is retained.
- Scoped light-theme styles keep the Finance heading, table, filters and dialog readable without changing other modules. Browser checks cover 390px mobile page/dialog fit and the super-admin return to the reference dashboard.

## Checks completed

The complete suite passed in an isolated Linux environment on 9 November 2026, using PHP 8.4.27 with PDO MySQL, MariaDB 11.8.6, Node.js and Chromium headless shell 156.0.8078.79 through Playwright 1.62.1. Database fixtures and accounts were synthetic and disposable. After visual review identified a light-theme table-text issue, the scoped color correction received a focused Finance API/browser recheck.

| Check group | Result |
| --- | --- |
| PHP syntax | 38 application source files passed |
| Frontend syntax | All 10 JavaScript entry points passed |
| Isolated behavior | Branch CSV, live reports, registry, students, approvals and Finance passed |
| API/CLI integration | Personnel, setup diagnostics, students, password recovery, first-admin enrollment, Finance, student attendance, personnel attendance, reports and branch approvals passed |
| Browser integration | Dashboard navigation, students/sign-in, student attendance, personnel attendance, reports, branch approvals and Finance passed |
| Finance presentation | Heading, table-cell and form label/error contrast checked; desktop register and mobile form inspected; 390px-wide page/dialog fit, scrolling, Cancel and drawer navigation checked |
| Patch whitespace | `git diff --check` passed |

Finance integration checks cover all five synthetic Finance accounts, denied roles, super-admin read-only access, branch/zone boundaries, active/membership changes, decimal precision (`0.10 + 0.20` and large totals), invalid fields, persistence, required edit reasons, stale updates, repeat submissions, transactional audit rollback and pagination. Browser checks also cover escaped Unicode/text, native form validation, reload/edit, filtered totals, conflict recovery, keyboard dismissal and immediate session cleanup.

The GitHub Actions workflow includes Finance and navigation checks alongside existing regressions, using a disposable MySQL 8.0 service. Consult the Finance PR's checks for the exact commit's CI result; local MariaDB results do not by themselves establish MySQL compatibility. The team's Windows/macOS XAMPP installations remain unverified. No real Finance accounts, database migrations on the team's installations, merges or deployments were performed.

## Reproduce with a disposable development database

Run frontend behavior checks from the project root:

```bash
node tests/branch-export.cjs
node tests/live-reports.cjs
node tests/registry.cjs
node tests/students.cjs
node tests/approvals.cjs
node tests/finance.cjs
```

The complete PHP/database/browser test sequence is in `.github/workflows/syntax.yml`. Its setup scripts intentionally create synthetic accounts and perform fault-injection checks. Use only a separate disposable database with `LEARN_INTEGRATION_TEST=1`, never a working school installation. Do not copy test fixture accounts into a working database.

For installation and manual acceptance, follow [database/FINANCE_SETUP.md](database/FINANCE_SETUP.md). Migration 007, approved account provisioning, the final field review and XAMPP acceptance must be handled before introducing real Finance records. Payroll, budgets, bank reconciliation, financial approvals, attachments and Finance exports remain outside this increment.
