# Frontend V5.2.0 — Workspace Navigation & Permission Matrix

## Changes

- My Workspace now contains only Profile and My Access as primary tabs.
- Data Health, Data Repair and Repair Activity moved to a collapsible Data Management group in the sidebar.
- The sidebar group stays collapsed unless opened or a Data Management page is active.
- My Access now shows a full permission matrix. Current user levels are highlighted; other levels are muted gray.
- Assigned Game and Account scope remains visible below the matrix.
- Query-based workspace routing supports `?view=health`, `?view=repair`, and `?view=activity`.
- No n8n API contract or database schema changes are required.
