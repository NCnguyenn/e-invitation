# Public Template Demos Implementation Plan

> **For agentic workers:** Use executing-plans to implement this focused change in the existing workspace. The user has requested customer-shareable deployed links for both templates.

**Goal:** Deliver two working anonymous production URLs for the Floral and Editorial samples.

**Architecture:** A separate public demo catalog builds illustrative invitations for two explicitly approved template keys. A statically generated Next page uses the existing invitation components in preview mode. Private host/guest routes retain their existing access rules.

**Tech Stack:** Next.js 16.3.6, React 19.3, TypeScript, node:test, existing Playwright runtime.

## Global constraints

- Read installed Next page and generateStaticParams guides before implementation.
- Use only sample content and existing artwork; no database reads, private audio, email or real RSVP writes.
- Use `/demo/graduation-floral-01` and `/demo/graduation-editorial-01`; unsupported slugs return 404.
- Demo allowlist is independent from the full customer template registry.
- Preserve `/preview` access rules and existing invitation visuals.

## Task 1: Demo catalog and routes

- [ ] Add `tests/public-demos.test.mjs`: unknown/customer keys rejected, both public samples resolve, new fixture returned on each call, music disabled.
- [ ] Run `node --test tests/public-demos.test.mjs` and observe failure before implementation.
- [ ] Add `src/features/template/public-demos.ts` with `PUBLIC_DEMO_KEYS` and `getPublicDemo(key)` returning a titled sample or null.
- [ ] Add `src/app/demo/[template]/page.tsx`: `generateStaticParams`, `dynamicParams = false`, metadata, entrance and preview-only template. Use `params: Promise<{ template: string }>` and `await params`.
- [ ] Bypass session refresh only for `/demo` and `/demo/` in `src/proxy.ts`; add demo noindex/no-referrer headers to `next.config.ts`.
- [ ] Run unit tests, typecheck and production build.

## Task 2: Customer-facing verification and release

- [ ] Add `tests/public-demos.browser.mjs` against a production server: both anonymous pages return 200, entrance opens, correct template appears, no horizontal overflow, gallery opens, both mock RSVP outcomes work, no API requests, unknown demo and anonymous private preview return 404.
- [ ] Update README with the two shareable URLs and distinction from private preview.
- [ ] Run the browser check on a production local server and inspect desktop/mobile screenshots. If Windows blocks local browser networking, report that limitation and verify the same suite on the deployed anonymous routes.
- [ ] Review the change, commit and push main, wait for the exact commit to reach ready on Netlify.
- [ ] Run production smoke and the public demo browser checks; return the two direct customer links.
