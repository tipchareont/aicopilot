# Frontend 4.8.2 — Historical Filter Performance

## Root Cause

Historical data increased the number of rows processed by the browser.
The Dashboard recalculated and sorted the complete date coverage from inside
the row filter, so changing one date preset repeated the same full-data work
many times.

## Fix

- Parse every Dashboard row date only once after API hydration.
- Calculate earliest and latest date only once.
- Reuse one active date range for the complete render cycle.
- Cache filtered Account, Campaign, and Creative arrays inside one render cycle.
- Render lightweight KPI content first and charts/tables on the next frame.
- Cancel obsolete renders when the user changes filters rapidly.
- Disable Chart.js animation during filter changes.
- Campaign and Creative pages precompute date coverage once.
- Search boxes use a 120 ms debounce instead of rendering on every keystroke.

## Data Logic

No metric formula, aggregation rule, Campaign Status, or date-range definition
was changed.
