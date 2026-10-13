# LEARN Afghan — Central Database (Super Admin UI)

This repository contains an **early, browser-only interface prototype** for LEARN Afghan's proposed centralized administrative database.

## Local preview (VS Code / XAMPP)
1. Open this repository's folder in VS Code.
2. Open `index.html` in a browser, or use VS Code's Live Server extension.
3. Alternatively, if hosted inside XAMPP's `htdocs`, start Apache and open the appropriate localhost URL.

## What works in the demo
- Responsive dashboard with navigable sidebar
- Navigation for zones, 25 branch records, administrators, teachers, staff, departments, reporting and audit planning
- Search/filter branch records
- Local demonstration edits to branch names, zone assignment, assigned admin and status
- CSV export of the demo branch registry

**Demo storage:** Edits are saved in the **current browser's localStorage only**. The branch names, zone assignments, statuses and metrics are placeholder values, **not authoritative LEARN Afghan records**.

## Not yet implemented
- Secure authentication, live role-based permissions and authorization
- Backend / shared database (PHP/MySQL or other stack still to be confirmed)
- Server-side validated forms, duplicate controls and approval workflow
- Audit history written on the server
- Real Excel/PDF report generation
- Scheduled server backups and tested recovery
- Formal user data, official branch names/codes, 3 zone definitions and department-specific required fields

**Do not enter real personal, student, HR, health or financial data into this demo.** Never add database passwords, API keys or private data to a public GitHub repository.

## VS Code + GitHub sync
After changes are committed to the remote main branch, update your local clone:

```bash
git status
git pull origin main
```

If `git status` shows local modifications, save/commit or otherwise handle them before pulling.

## Scope
Based on the *LEARN Afghan Central Database Development Proposal*: a secure centralized system for three zones, 25 branches, departments, forms, access controls, approved reporting and backups. Phase 1 prioritizes administrative data entry rather than advanced school-management features.
