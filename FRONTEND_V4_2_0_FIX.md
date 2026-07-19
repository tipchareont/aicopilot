# Frontend v4.2.0

- Dashboard no longer rejects a session from the browser clock before calling n8n.
- Backend Dashboard API is the source of truth for session validity.
- Dashboard API is always called when a session token exists.
- 401/403 responses clear the session and return to Login.
- AI Daily Intelligence panel reads `dashboard.ai_summary`.
- Cache namespace bumped to v5 and static assets to v4.2.0.
- Console diagnostics added for Login storage and Dashboard API calls.
