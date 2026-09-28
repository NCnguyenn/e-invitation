# Graduation mockup alignment

**Goal:** Match the supplied hero and memory references in `graduation-editorial-01`.

**Design:** Keep the cream/burgundy palette and use a background-removed derivative of the customer portrait. Build the hero from oversized condensed live text, an outlined event year, a blush shape and a transparent portrait. Retain the existing chapter navigation. Replace the straight line behind the memory cards with an SVG coral thread and three visible milestone pins. Use compact landscape photos with staggered placement. Retain the existing invitation, gallery, audio and RSVP contracts.

**Mobile corrections:** Keep the portrait beside the title at every width. Anchor the portrait at the top of its stage so the cap and face sit beside the heading. Reserve the right side for the outlined year, prevent title/year collisions and remove the duplicated year under the image. The portrait may overlap the decorative year as in the supplied reference.

**Scope:** `GraduationEditorial01.tsx`, its cover asset reference, its scoped CSS, one new transparent portrait asset and the existing browser verification.

- [x] Inspect existing layout, source photographs and installed Next.js CSS/image guidance.
- [x] Prepare and inspect a transparent portrait on the cream background.
- [x] Implement layered hero with readable Vietnamese type at desktop and narrow container widths.
- [x] Implement the curved SVG thread and compact staggered milestone cards.
- [x] Update the existing geometry check for the layered composition and capture both changed sections.
- [x] Run typecheck, existing browser interactions and inspect desktop/mobile screenshots; fix observed issues.

**Verification:** `node node_modules/typescript/bin/tsc --noEmit` (the global npm launcher is broken); `node tests/graduation-editorial.browser.mjs` using the installed browser/runtime at 1440, 768, 620, 430, 390 and 320 pixels. Check the face, hat and Vietnamese accents visually, the transparent asset and year stacking, overflow, milestone connections, reduced motion, gallery keyboard controls, both mock RSVP outcomes and isolation of the existing template. Do not add implementation-mirroring unit tests for CSS.
