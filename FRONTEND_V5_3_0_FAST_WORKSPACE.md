# Frontend V5.3.1 — Fast Workspace

- Data Management is nested under My Workspace in the sidebar.
- My Workspace renders immediately from the signed-in session and a short-lived local cache.
- Profile and My Access are refreshed in the background instead of blocking the whole page.
- Data Health and Repair Activity are loaded lazily only when opened.
- Refresh bypasses the server cache for the active section.
- Repair authorization remains enforced by the backend on every Preview and Start request.
