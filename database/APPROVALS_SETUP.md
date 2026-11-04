# Pending branch approval queue

This development feature handles **branch activation review**. It uses the existing `branches.status` and `audit_events` tables; there is no new migration and no automatic import or account creation. The full working branch also includes student/personnel attendance and school reporting from PRs 7–9, plus the Windows helper from PR 5.

## Behavior

- A super administrator creates a branch through the existing form; its initial status is `pending`.
- **Approvals** lists the first 200 pending branches, with code/name/zone/location search and an explicit truncation notice.
- Approve changes `pending` to `active`. Reject changes `pending` to `inactive` and requires a review note of at most 500 characters. Approval notes are optional.
- The branch update and audit event commit together. Audit failure rolls the branch status back.
- A review version fingerprints all shown branch fields. Changes to a branch after the dialog opens, including changes within the same timestamp second, cause a 409 conflict. The dialog preserves the note and offers an explicit close-and-refresh action.
- Only a currently pending branch can be decided; replayed decisions are refused. The queue shows the latest 50 approval/rejection events with notes and reviewer names.
- Other roles receive 403 from both endpoints and a denied-access screen. The queue/history are cleared on navigation, sign-out or session expiry. They are not saved to browser storage.

## Scope

This adds a review queue within the super administrator's existing branch-edit permissions. It does not impose a new organization-wide approval policy: the existing branch editor remains available to super administrators, and a branch can be returned to pending there for another review. This is not two-person approval, a finance approval flow, or a general departmental-submission system. No additional account privileges are introduced.

## Automated verification

`tests/approvals.cjs` checks search, escaping, role gates, error recovery and session isolation. Disposable MySQL tests check persistence, role/CSRF/origin enforcement, required rejection notes, stale/replayed decisions, audit rollback and the queue limit. Chromium tests cover real approve/reject flows, escaped notes, conflict recovery, the branch-screen status cache, persistence after reload and session cleanup. The report CSV integration check reads raw bytes so Fetch's text decoder cannot consume the BOM before it is tested.

## One local acceptance pass after automated checks

Use an existing configured development installation and synthetic data. Do not reimport or reset a populated database. Add a synthetic pending branch, approve it, confirm its active status after reload and inspect the audit entry. Repeat with a rejection note and check inactive status. Open a review, change the branch in a second session and confirm the first review is refused. Confirm zone/branch/department accounts cannot open or call the approval endpoints. Local XAMPP and organizational review remain separate from the automated CI result.
