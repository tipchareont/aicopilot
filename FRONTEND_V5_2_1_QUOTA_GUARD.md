# Frontend V5.3.3 — Quota Guard

- Replaced overlapping `setInterval` polling with single-flight recursive `setTimeout`.
- Polls every 30 seconds only after the previous request finishes.
- Pauses while the browser tab is hidden.
- Uses exponential backoff and stops after repeated API failures.
- Validates null/empty API responses before reading `repair_request` or `system_status`.
- Prevents duplicate Start Repair and duplicate Overview refresh calls.
- Persists active request ID and resumes safely after page reload.
