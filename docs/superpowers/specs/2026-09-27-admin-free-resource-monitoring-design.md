# Admin Free Resource Monitoring Design

## Goal

Make `/system-admin` show every documented Free-plan resource required by the project specification without inventing account usage, and preserve the last successful API measurement when a later refresh fails.

## Design

The resources tab keeps three visibly separate sources: provider API measurements, official Free-plan references, and internal application counters. Published references are documentation only; they never become a usage percentage or a remaining balance. Resources without a verified quota API remain dashboard-only and link to the official provider dashboard.

The reference registry covers Netlify credits and credit pricing, Supabase database, Storage, cached and uncached egress, MAU, Realtime messages and concurrent connections, Brevo daily email and contacts plus Free branding, and GitHub Actions minutes, artifact/Packages storage and Actions cache. Each row has an official URL, checked date, and notes explaining scope or unavailable measurement.

When a provider refresh returns an error or a null measurement, the synchronizer keeps the previous value, limit, remaining value, source and successful fetch time. It changes the status to `stale`, records the latest attempt and sanitized error code, and only replaces the value after a valid successful response. A provider with no previous snapshot still shows the null error state.

## Verification

Add regression tests for the complete reference registry and snapshot merge behavior. Run the metric tests, TypeScript, and production build. Live account usage remains dependent on configured provider credentials and is labeled accordingly; documentation alone never proves live usage.
