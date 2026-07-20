# Frontend V4.7.0 — Creative UX & Asset Fix

- Creative and Creative Weekly now receive real Thumbnail URLs from Meta_Raw_Data via Builder Cache.
- Weekly results are grouped into collapsible Winner / Promising / Watch / Loser sections.
- Each Creative is collapsed by default and opens into an action-focused detail view.
- Added actual Creative image, asset gallery, next-action steps, compact reasons, risks and variation plan.
- Dashboard cache namespace bumped to V7 to prevent stale no-thumbnail payloads.
- Google Sheets reads in Dashboard API retry transient 502 errors up to five times.
