# System Admin UI Redesign Implementation Plan

> **For agentic workers:** Execute inline in this session with small review checkpoints. Do not add or run tests unless the user asks for testing or verification.

**Goal:** Redesign all five `/system-admin` tabs to follow the approved mockups, improve scanability and task-focused controls, and make every resource figure clearly distinguish measured usage from published plan quotas.

**Architecture:** Keep the existing server page, client shell, tab views, API routes, and CRUD handlers. Rework the shared shell and CSS Module, then refine each view in place. The resources view will show API/database measurements separately from source-backed Free plan references, with unavailable values shown as unavailable rather than zero.

**Tech Stack:** Next.js 16 App Router, React 19 client components, TypeScript, CSS Modules, existing Brevo/Supabase metrics services.

## Global Constraints

- Preserve `/system-admin` authorization and all existing API contracts and mutation flows.
- Never invent usage, status, trend, or percentage values; render null measurements as `—` and label their source.
- Keep published plan quotas separate from measured usage and link each quota to an official source with a checked date.
- Do not show an integration as healthy unless an existing measurement supports that status.
- Keep the five tabs and make their current selection and primary action easy to identify.
- Do not add or run tests unless the user asks for testing or verification; use TypeScript/build checks if needed.

## Files and Responsibilities

- `src/features/admin/components/AdminShell.tsx`: shared admin frame, tab navigation, page heading, and logout identity.
- `src/features/admin/components/OverviewView.tsx`: accurate system summary and latest-event list.
- `src/features/admin/components/HostsView.tsx`: searchable host table and existing account actions.
- `src/features/admin/components/EventsView.tsx`: searchable event table and existing guest/template/create actions.
- `src/features/admin/components/MetricsView.tsx`: measured API metrics, daily email ledger, and source-backed quota references.
- `src/features/admin/components/MetricCard.tsx`: accurate metric formatting and measurement context.
- `src/features/admin/components/OperationsView.tsx`: reconciliation and maintenance tables with existing actions.
- `src/features/admin/components/admin.module.css`: shared visual system, responsive behavior, table/card/form states.
- `src/features/admin/metrics/reference.ts`: verified official Free plan limits and source dates.

## Tasks

### Task 1: Make resource figures truthful and easier to read

Update `reference.ts` from the official sources checked on 2026-09-27. Correct Netlify to a single 300-credit monthly limit and remove obsolete separate bandwidth/function quotas. Keep GitHub Actions minutes and artifact/Packages storage distinct from Git LFS. Clarify Supabase cached and uncached egress, database size versus filesystem size, and that the app does not currently measure Storage quota usage. Rebuild `MetricsView` provider summaries around source labels: API/database readings, the app's own daily email ledger, documented plan quotas, and direct dashboard links must be separate. Null readings remain `—`; no provider gets a positive health badge without supporting data. Update `MetricCard` text so measured filesystem usage is not presented as a Free tier quota percentage.

### Task 2: Redesign shared admin shell and overview

Update `AdminShell` to match the approved mockups: persistent dark navy sidebar, teal selected state, five clearly labeled tabs, readable page header, and logout identity. Remove duplicate global create buttons so each action lives with its relevant page. Restyle the overview around real database counts, RSVP/email figures with null-safe values, truthful measurement status, and the five most recent events. Do not add a historical chart because the current page data contains no history series.

### Task 3: Improve Host and event management screens

Restyle `HostsView` and `EventsView` with clear search areas, concise table headings, aligned statuses, visible create actions, and calmer destructive actions. Keep existing search behavior, creation/deletion confirmation modals, event template changes, and guest drawer intact.

### Task 4: Improve operations and shared responsive details

Restyle the two operation sections so unresolved email attempts and maintenance jobs are visually separate, statuses are easy to scan, and refresh/reconcile/retry actions are easy to locate. Add keyboard focus styles and responsive layouts without changing server or API behavior.

### Task 5: Review and verify the change

Inspect the final diff and resource wording against the cited official sources and existing fetcher fields. Run `npm run typecheck` and `npm run build` if the environment supports them. Do not run the test suite under the current instruction unless the user asks.
