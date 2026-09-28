# Public invitation demos

The user needs two deployed URLs that customers can open without an account. Existing `/preview` is intentionally restricted to active hosts and their assigned template, and must retain that policy.

Publish only `/demo/graduation-floral-01` and `/demo/graduation-editorial-01`. Use an explicit public allowlist, separate from the registry of customer templates. Render the existing entrance and invitation in preview mode using a fixed illustrative event for Mai Hoa and the existing sample artwork. Do not read a host event, a guest token, cookies or Supabase data. Do not enable host audio. RSVP remains the existing client-only mock with its visible explanation that responses are not saved.

Generate both pages at build time and reject all other demo slugs. Ignore query parameters, including template and guest overrides. Skip session refresh for the demo URL subtree. Retain noindex and no-referrer headers for shared samples. Supply a distinct page title for each template.

Validation: allowlist and fixture isolation unit tests; production build; anonymous HTTP and browser checks for both routes, opening the envelope, distinct template markers, gallery, mock RSVP and absence of API requests; unknown demos and private previews must return 404. Deploy through the already authorized main branch and verify the final production URLs before delivering them.
