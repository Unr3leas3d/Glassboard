# Glasboard Security Audit Report

Date: 2026-03-20

## Status

The previously reported source-level security findings have been remediated in this repository snapshot.

Remediation summary:

- Session joins no longer rely on broad authenticated `SELECT` access to the `sessions` table.
- Questionnaire/admin access no longer relies on overbroad public/authenticated table policies.
- The admin dashboard now requires an admin-marked user, not just any authenticated session.
- Unused opener/deep-link permissions were removed from the management window.

The remaining work is operational:

- Apply `supabase/migrations/20260320000004_fix_remaining_security_issues.sql` to the target Supabase project.
- Provision intended admin users with `app_metadata.role = 'admin'`, `app_metadata.roles` containing `admin`, or `app_metadata.is_admin = true`.

## Scope

Static review of the Tauri v2 + React + TypeScript + Supabase code in this repository, plus verification of the remediation patch and a fresh local dependency scan.

Focus areas:

- Supabase RLS, RPCs, and anonymous questionnaire flow
- Session lifecycle and join-code handling
- Admin authorization boundaries
- Tauri capability and plugin exposure

## Executive Summary

The repository no longer contains the previously identified high-severity authorization flaws. Session access is now mediated through a server-side join RPC plus participant grants, questionnaire persistence is mediated through token-checked RPCs, and the admin dashboard is gated by admin app metadata on both the frontend and the database side.

No new high-severity source-level findings were identified in this remediation pass. The main residual risk is deployment drift: if the new migration is not applied in Supabase, the live backend will not match the secure source state reviewed here.

## What Changed

### Session access

- Added `session_participants` plus `join_session_by_code()` in `supabase/migrations/20260320000004_fix_remaining_security_issues.sql`.
- Dropped the broad `sessions_join_code_read` policy.
- Updated `src/hooks/useSessions.ts` to join sessions through the RPC instead of direct table reads.

### Questionnaire/admin access

- Added `is_questionnaire_admin()` in `supabase/migrations/20260320000004_fix_remaining_security_issues.sql`.
- Dropped the broad questionnaire select/update policies.
- Added `get_or_create_questionnaire_response()` and `save_questionnaire_response()` RPCs.
- Added `join_waitlist()` so the landing flow no longer depends on direct waitlist lookups.
- Updated `src/windows/landing/LandingApp.tsx` and `src/windows/landing/QuestionnaireFlow.tsx` to use the new RPC-based flow.
- Updated `src/windows/admin/AdminApp.tsx` to require admin-marked auth metadata before loading data.

### Tauri hardening

- Removed opener/deep-link plugin initialization from `src-tauri/src/lib.rs`.
- Removed deep-link config from `src-tauri/tauri.conf.json`.
- Removed opener/deep-link permissions from `src-tauri/capabilities/management.json`.

## Verification

Command run:

```bash
npm run typecheck
```

Result:

- Passed

Dependency scan:

```bash
npm audit --json
```

Current summary:

- 0 critical
- 0 high
- 5 moderate

Affected packages in the current Node tree:

- `@excalidraw/excalidraw`
- `@excalidraw/mermaid-to-excalidraw`
- `dompurify`
- `mermaid`
- `nanoid`

Assessment:

- No new high or critical Node advisories were reported.
- The moderate advisory set in the Excalidraw/mermaid chain remains and should still be addressed in a separate dependency-upgrade pass.

## Residual Notes

- The questionnaire resume flow is now tied to a per-device stored edit token. This is a security tradeoff that avoids exposing questionnaire data or update rights to arbitrary anonymous callers.
- Admin access now depends on server-issued auth metadata, which is the correct trust boundary. Ensure admin designation is managed server-side only.

## Limitations

- This was a static review of the repository state; it did not include live exploitation against a deployed Supabase project.
- Rust dependency CVE scanning was not completed because `cargo-audit` is not installed in this environment.
