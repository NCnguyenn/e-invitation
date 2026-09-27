# Admin Free Resource Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Make `/system-admin` display complete, source-backed Free resources and preserve valid measurements across failed refreshes.

**Architecture:** Keep provider API snapshots and published Free references as separate data paths. Add a pure snapshot merge helper so failed provider responses retain the last successful value while exposing a stale/error state.

**Tech Stack:** Next.js 16.3.6, React 19, TypeScript, Node test runner, Supabase metrics adapters.

**Completion record (2026-09-27):** Code and local verification completed: 34/34 focused tests, browser fixture (360/1440px, zero/missing/stale/partial, failure/timeout, visibility refresh), TypeScript and production build pass. Independent review found no additional high-impact correctness issues. Additional hardening includes environment/scope filtering, mapping version 2.0 and fenced persistence RPC. Apply migration `202609270003_provider_metric_integrity.sql` before deploying; remote migration and provider-account verification have not been performed. See `docs/admin-resource-sources.md` for operating boundaries and evidence.

## Global Constraints

- Never infer provider usage, quota, percentage, or remaining balance from application business data.
- Published limits are documentation references with official URLs and checked dates, not account measurements.
- Null provider measurements remain unavailable; no missing value becomes zero.
- Preserve the existing admin authorization and API contracts.

### Task 1: Protect successful snapshots during failed refreshes

**Files:**
- Create: `src/features/admin/metrics/snapshot-merge.ts`
- Modify: `src/features/admin/metrics/sync.ts`
- Test: `tests/admin-metrics.test.mjs`

- [ ] Add a failing test that merges an existing successful snapshot with an unavailable refresh and expects the old value plus `stale` status and the new error code.
- [ ] Run `node --test tests/admin-metrics.test.mjs` and confirm the new test fails because the merge helper does not exist.
- [ ] Implement a pure merge function keyed by provider, scope, and metric. Preserve old measurements on non-success statuses and only replace them after a valid success.
- [ ] Use the helper in `getOrSyncMetrics`; calculate cached time from the newest snapshot and advance `lastSyncedAt` only when at least one provider snapshot is successful.
- [ ] Re-run the focused test and the complete metric test file.

### Task 2: Complete the documented Free resource registry

**Files:**
- Modify: `src/features/admin/metrics/reference.ts`
- Modify: `tests/admin-metrics.test.mjs`

- [ ] Add failing assertions for Supabase MAU, cached/uncached egress, Realtime messages/connections, Brevo contacts/branding, Netlify credit model, and GitHub Actions cache.
- [ ] Run the focused test and confirm the assertions fail with the current registry.
- [ ] Add only source-backed rows, with scope notes that distinguish plan references from live usage and dashboard-only resources.
- [ ] Re-run the test and confirm every expected resource ID has an official HTTPS source and the current checked date.

### Task 3: Make the UI wording explicit

**Files:**
- Modify: `src/features/admin/components/MetricsView.tsx`
- Modify: `src/features/admin/components/MetricCard.tsx`

- [ ] Add source wording for documentation/dashboard-only references and display snapshot scope and measurement period where available.
- [ ] Ensure no percentage bar is rendered when the API did not provide a matching limit.
- [ ] Run typecheck and production build.

### Task 4: Final verification

- [ ] Run `node --test tests/admin-metrics.test.mjs`.
- [ ] Run `node node_modules/typescript/bin/tsc --noEmit`.
- [ ] Run `node node_modules/next/dist/bin/next build`.
- [ ] Inspect `git diff` and report any live-credential limitation explicitly.
