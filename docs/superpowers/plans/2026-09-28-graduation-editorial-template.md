# Graduation Editorial Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the approved editorial graduation invitation as an isolated `graduation-editorial-01` template without changing `wedding-floral-01`.

**Architecture:** Add a dedicated server/client template component pair, dedicated stylesheet, content and asset namespace, and registry loaders. Reuse the existing invitation primitives for calendar, countdown, gallery, RSVP preview, audio, and map behavior while keeping all visual selectors scoped to the new root class.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS modules-free scoped stylesheet, existing invitation primitives, Node test runner.

## Global Constraints

- Existing `wedding-floral-01` preview behavior and assets must remain unchanged.
- New preview key is `graduation-editorial-01`.
- New template uses the approved burgundy, blush, ivory editorial direction and the existing `TemplateProps` contract.
- All map links remain HTTPS Google Maps URLs validated by the existing event data path.
- The new template must support both preview and guest modes, including existing RSVP and audio controls.

### Task 1: Registry contract and failing tests

**Files:**
- Modify: `src/features/template/resolve-key.ts`
- Modify: `tests/admin-access.test.mjs`
- Modify: `tests/preview-access.test.mjs`

- [ ] Add assertions for `graduation-editorial-01` registration and development preview selection.
- [ ] Run `node --test tests/admin-access.test.mjs tests/preview-access.test.mjs` and observe failure because the key is not registered.
- [ ] Add the new key to the registered key tuple and keep existing keys unchanged.
- [ ] Re-run the two tests and confirm they pass.

### Task 2: Dedicated assets, content, and loader

**Files:**
- Create: `src/features/template/graduation-editorial-content.ts`
- Create: `src/features/template/templates/GraduationEditorial01.tsx`
- Create: `src/features/template/templates/GraduationEditorial01Cover.tsx`
- Modify: `src/features/template/registry.ts`
- Create: `public/templates/graduation-editorial-01/` asset copies from the existing graduation image bundle

- [ ] Add content helpers that resolve assets under `/templates/graduation-editorial-01/`.
- [ ] Implement the full page sections with `TemplateProps`, existing `Countdown`, `Gallery`, `MockRsvpForm`, `AudioPlayer`, `HostAudioPreviewControl`, and map URL guard.
- [ ] Add a compact cover component for dashboard/template selection using the same scoped visual system.
- [ ] Register separate full-template and cover loaders; do not point the new key at wedding loaders.
- [ ] Run `npm run typecheck` and fix type errors.

### Task 3: Editorial visual system

**Files:**
- Create: `src/features/template/graduation-editorial.css`

- [ ] Style the isolated `.graduation-editorial-template` root with burgundy, blush, ivory, coral, editorial typography, chapter rail, ticket card, asymmetric gallery, RSVP panel, responsive layout, and reduced-motion rules.
- [ ] Ensure selectors cannot affect `.invitation-template` or `wedding-floral-01` styles.
- [ ] Run `npm run typecheck` after CSS/component integration.

### Task 4: Route and browser verification

**Files:**
- None unless fixes are required.

- [ ] Start the existing dev server or use the running server and request `/preview?template=graduation-editorial-01`.
- [ ] Verify the HTML contains the new template markers and `/templates/graduation-editorial-01/` assets.
- [ ] Request `/preview?template=wedding-floral-01` and verify its existing marker/assets remain present.
- [ ] Run `npm run typecheck` and the focused node tests before reporting completion.
