# Frontend V4.7.1 — Direct URL Session Guard

## Fixed

- Fixed `creative-weekly/index.html` reloading itself when opened directly without a session.
- Added `creative-weekly` to the protected-route list.
- Added one global session guard in `auth.js` for all protected routes:
  - dashboard
  - campaign
  - creative
  - creative-weekly
  - scale-advisor
  - ai-chat
- Protected pages now redirect to the root Login page before requesting Dashboard Cache.
- Added redirect-loop protection for future routes.
- Updated static asset cache-busting version to `4.7.1`.

## Expected behavior

Opening any protected page directly in Incognito or without `session_token` redirects to:

`../index.html`

No Backend or n8n workflow change is required.
