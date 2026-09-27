# Invitation performance implementation plan

**Goal:** Implement the optimization package approved in chat: usable mobile preview controls, a lightweight dashboard cover, smaller invitation images and safe long-lived static caching.

**Architecture:** Keep the existing invitation appearance and host/guest contracts. Share the hero between a separately loaded cover and the full template. Encode existing artwork as WebP at appropriate display resolutions; import assets and font URLs through Next so emitted filenames contain content hashes and receive its immutable cache policy. Full preview loads when opened. Private pages and API responses remain no-store.

**Tech stack:** Next 16.3.6, React 19.3, TypeScript, existing Sharp 0.35.4 from the installed Next dependency, Playwright with local Edge.

## Constraints and decisions

- User selected the proposed optimization package. No API polling, schema, email, RSVP or hosting-plan changes in this patch.
- Preserve all pre-existing and concurrent edits, especially dashboard response styles and admin resource work. The user subsequently authorized committing this optimization package and merging it into local `main` after verification. No deployment, push or unrelated commit.
- Read the installed Next image, lazy-loading and headers guides before implementation (done).
- Keep source artwork under `images/` untouched. Generated optimized files are committed; the encoder is a reproducible development script, not a request-time service.
- Long cache applies only to content-hashed assets under `/_next/static/`; replacing artwork automatically changes its URL. Do not add immutable headers to mutable public paths or private routes.
- Preserve fail-closed behavior for unknown template keys. Both existing registered keys retain the same design.

## Tasks

- [x] 1. Add a production fixture browser regression in `tests/invitation-performance.browser.mjs`. Import actual components with synthetic data; intercept all APIs. Assert cover has no RSVP/gallery/countdown, mobile Close receives pointer input at 320/390/768 px, draft preview stays correct, Escape/focus/device switch works, guest flow and image loading work. Record transferred asset bytes and screenshots. Observe baseline failures before editing source.
- [x] 2. Fix modal positioning in the existing `dashboard.css` preview block. Scope selectors strongly enough to override late template CSS; isolate the scroll area below its header. Verify both close and music controls are reachable.
- [x] 3. Extract `WeddingFloral01Hero.tsx` and add `WeddingFloral01Cover.tsx` plus a client cover loader. Extend the template registry with cover loaders keyed by the same validated keys. `EventEditor` uses the cover and dynamically loads its full `PreviewModal` only when open. Preserve memoization and saved/draft semantics.
- [x] 4. Add `scripts/optimize-template-assets.mjs`. Resize decorative assets at 2x–3x their maximum rendered width, backgrounds at 900 px and photos at up to 1200 px; encode WebP with alpha preserved. Generate a typed asset map with static imports. Reference backgrounds with CSS module-resolved relative URLs; use one output for each pair of identical backgrounds. Rewrite self-hosted font URLs to relative imports and update their existing preparation script consistently.
- [x] 5. Run the regression fixture and inspect screenshots, immutable cache headers and measured bytes. Check no source PNG or below-cover photo is fetched by the dashboard. Run typecheck/build and relevant existing tests. Review scope and document exact outcomes and remaining deployment-only limitations.

## Verification criteria

- Dashboard cover image payload below 1 MB; rendered guest template image payload below 2 MB in cold contexts (baseline 7.6 MB / 15.2 MB).
- Cover DOM contains the hero only; no hidden interactive widgets or their timers.
- Close button clickable without forced clicks at all tested widths, before/after scrolling and device changes.
- Full preview displays draft title/date/location; saved cover remains based on saved data.
- Optimized images and font responses use content-hashed URLs with `max-age=31536000, immutable` in production.
- No hydration exceptions in the isolated production fixture. Live Netlify hydration issue is not claimed fixed without a new deployment and verification.

## Results

Verified locally on 2026-09-28. Release review covers the exact staged optimization package independently of concurrent working changes. Deployment remains outside this local integration.

| Cold image response bodies | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Dashboard saved cover | 7,643,869 B | 274,712 B | 96.4% |
| Guest closed envelope | 5,609,761 B | 230,304 B | 95.9% |
| Guest full invitation | 15,185,699 B | 1,566,146 B | 89.7% |

These are image payload measurements from isolated local production fixtures, not measured reductions in live page-load time. Every guest image was loaded before the full-template measurement. The generated artwork totals 1,557,368 B across 20 WebP files.

- Production fixture: 13/13 checks passed. Baseline failures were observed for hidden cover widgets, oversized payloads, mobile Close overlap and unversioned assets before source fixes.
- Review caught music scrolling away inside an `overflow: hidden` ancestor. Added regression assertions, reproduced failure at all four widths, then fixed with `overflow: clip` and a control stacking level inside the isolated scroll area. Final checks pass before/after scrolling, after device switching and near the bottom at 320/390/768/1440 px.
- Saved cover and full preview share the original hero; title/date/time/venue/address draft behavior is browser-tested. Unknown templates retain fail-closed behavior.
- Release review reproduced guest-name truncation at all four preview widths. Scoped the table's `.guest-name` rule to `.guest-info .guest-name`; the preview name now wraps and remains fully readable. Regression assertions passed at all four widths after the fix.
- Image/font responses use hashed build paths and `max-age=31536000, immutable`. Private route and API caching was not modified.
- `npm run build`, `npm run typecheck`, `node --test tests/*.test.mjs` (68/68 in the shared workspace) and `git diff --check` passed during implementation. Before commit, exported only the staged files over their committed baseline: production build, typecheck, all 51 tests present in that baseline and all 13 browser checks passed independently. The extra 17 tests belong to concurrent admin work and are not included in this commit.
- Existing `tests/invitation-entrance.browser.mjs` and `tests/responses.browser.mjs` passed: envelope sequencing, keyboard/focus, mobile layouts, retained RSVP draft, reduced motion, response controls and error states. No browser exceptions in these runs.
- Visually inspected dashboard, 320/390 px preview and the full mobile guest invitation. Review found no remaining blocking issues in the revised patch.
- Release evidence: ignored `test-results/invitation-release/snapshot/test-results/invitation-performance/report.json` and screenshots beside it. Browser commands support `PLAYWRIGHT_MODULE` and `BROWSER_EXECUTABLE` for an existing local Playwright/Edge runtime.

Remaining limits: the deployed Netlify site has not received this patch. A React hydration error seen on deployed login remains unverified after deployment; local production fixtures did not reproduce it. API request waterfalls/polling and hosting cold-start latency were not changed. These results establish code-level overhead, not a conclusion that the free hosting tier causes the remaining delay.
