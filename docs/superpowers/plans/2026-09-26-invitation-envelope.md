# Invitation envelope implementation plan

**Goal:** Implement the approved centered navy envelope mockup on the existing invitation URL.

**Architecture:** A client-side `InvitationEntrance` wraps the existing server-rendered invitation as children. Its stages are checking, closed, opening, opened, leaving, and invitation. CSS Modules draw and animate paper layers; no new image or animation dependency is needed. Existing token validation, RSVP, audio and private headers remain in their current components.

**Constraints:** Two deliberate clicks: `Mở thư` reveals the personalized letter; `Xem thư mời` reveals event details. Store completion only after the second click, per invitation in the browser. Preview never writes completion. Preserve existing uncommitted map work. Respect reduced motion, keyboard focus, 255-character names and 500-character notes.

- [x] Add behavior tests in `tests/invitation-entrance.test.mjs`, run with `node --test tests/invitation-entrance.test.mjs`. Verify first visit, two clicks, ignored duplicate clicks, repeat visits, replay and denied storage.
- [x] Add `src/features/guest/entrance-state.ts` with a pure transition function and fail-safe browser memory helpers. Run the same tests until passing.
- [x] Add `InvitationEntrance.tsx` and `invitation-entrance.module.css`: ivory framed canvas, engraved line decorations, graduation emblem, centered folded navy envelope, personalized cream letter, staged flap/letter animation and changing button. Keep long text scrollable on the letter. Move focus into letter after opening and into invitation after entering. Offer replay.
- [x] Wrap the validated guest page in `src/app/invite/[token]/page.tsx`. Use a SHA-256 digest of the invitation token for memory identity. Wrap the existing `/preview` page without persistence so the interaction is reviewable using the same component and access guards.
- [x] Verify with `node node_modules/typescript/bin/tsc --noEmit`, `node node_modules/next/dist/bin/next build` and real browser checks on desktop/mobile. Check closed/open/detail stages, keyboard, reduced motion, long text, storage denial and URL stability. Capture screenshots and review layout.

## Baseline

TypeScript passes. Existing map tests pass 5/6; the network-dependent shortened Google Maps URL test already fails before this change. The system npm launcher references a missing global npm installation, so invoke the installed project binaries directly. No map changes are in scope.

## Verification results

- All 5 entrance state/storage tests pass.
- Production build and TypeScript pass; `git diff --check` passes.
- Playwright against the existing local dev server passes: separate open/view actions, duplicate keyboard input, focus transfer, stable URL, preview reload, RSVP draft retained on replay, actual silent audio paused on replay (including delayed playback), 320/390/768px layouts, 255-character names, 500-character note layout and keyboard scrolling, reduced motion, denied localStorage, and no browser exceptions.
- Screenshots reviewed in `test-results/invitation-entrance/`. No new packages or public routes added.
- Independent review identified hidden audio playback on replay; fixed and regression-tested. Re-review found no additional actionable issues.
- Persistence is covered by state/storage unit tests; browser checks use the existing preview with sample data and do not submit real guest responses.
