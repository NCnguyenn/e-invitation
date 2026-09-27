# Response Letter Paper Implementation Plan

**Goal:** Apply the approved understated letter-paper mockup to the host responses page, including mouse-hover lift and touch press feedback.

**Architecture:** Keep `useResponses`, the polling API, authentication and dashboard navigation intact. Update the response presentation in `src/features/responses/ResponseTable.tsx`; move its dedicated styles out of the shared dashboard stylesheet into `src/features/responses/responses.css`, scoped beneath `.response-guestbook`.

**Tech Stack:** Existing Next.js 16, React 19, CSS and self-hosted fonts. No new production dependencies.

## Approved design and constraints

- Preserve the formal navy/ivory design; only faint ivory, sage, blush and blue-gray paper colors. No flowers, tape, ornaments or decorative animation.
- Compact four-column metrics, existing search/filter behavior, a collection heading, three paper columns on desktop, two on tablet and one on phones.
- Messages on faint rules; status above, handwritten guest signature and response time below. Retain full email as discreet secondary text for guest identification.
- Wrap long names and messages without clipping. Use factual empty-message labels and retain loading, stale, error and empty states.
- Hover on a fine pointer: `translateY(-4px)` with a softer deeper shadow over 200 ms. Press: `translateY(1px) scale(.99)`, returning on release/cancel. No hover on touch-only devices; respect reduced-motion preferences.
- No seeded/demo data in production, no API or authentication changes, no changes to the public invitation preview.

## Tasks

- [x] Update response markup: compact metrics, heading, accessible status filters, letter structure and factual fallbacks. Keep existing pagination/search handlers and test IDs.
- [x] Replace obsolete response-specific dashboard CSS with locally scoped styles. Reuse the existing Ephesis signature font, Playfair heading and a readable serif message face. Implement responsive grids, hover/press and reduced motion.
- [x] Run TypeScript and production build. Check the actual response component in a local browser fixture with mocked response API, using existing browser-test conventions. Verify filtering, search, refresh, pagination, long content, empty/error states, desktop hover, touch release/cancel, reduced motion, and no horizontal overflow at 320/390/768/1440 px. Save screenshots for visual inspection.
- [x] Review the final diff; keep generated fixtures under ignored `test-results` only, with no production preview routes. The test server shuts down after checks.

This is a reversible presentation change. Reuse existing validation and browser checks; do not add tests that merely assert CSS source text. The user approved the visual direction and execution in this chat.

## Verification and findings

- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- `node D:/nodejs/node_modules/npm/bin/npm-cli.js run build`: passed. Used the installed npm CLI directly because the system npm shim resolves to a missing roaming-profile installation.
- `node tests/responses.browser.mjs`: passed all interaction and layout checks with local Edge and the existing Playwright runtime selected through `BROWSER_EXECUTABLE` and `PLAYWRIGHT_MODULE`. The script creates its own isolated Next fixture and intercepts API requests with synthetic data; no real account or server writes are used.
- The pagination check initially reproduced a pre-existing issue: the synchronization effect watched local `page` and immediately reverted navigation using old response data. It now synchronizes only when response data changes; the same browser check passes.
- Independent review found low timestamp contrast on tinted paper. Changed `#727477` to `#65696d`; calculated contrast exceeds 5:1 on all paper backgrounds.
- Screenshots: `test-results/responses/desktop.png`, `desktop-hover.png`, `width-390.png`, `long-mobile.png`, and `touch-pressed.png`.
- Scope of verification: real components/CSS and real browser interactions with mocked API, plus production compilation; no live authenticated Supabase session was exercised.

## Follow-up: soften the paper silhouette

The user found the straight border and right-angle corners too similar to a UI card. Removed the visible enclosing border; the paper surface now has softly irregular edges, faint grain and a small folded corner on every letter, including a single response. Shaped only the background pseudo-element, preserving full text and native interactions. Shadow follows the paper silhouette. Browser checks and production build passed again; close-up screenshot: `test-results/responses/paper-detail.png`.
