# Frontend V4.5.0 — Scale Up Advisor V2

## Added

- New `Scale Advisor` page
- Shows `SCALE_READY`, `TEST_SCALE`, `HOLD`, `HOLD_REVIEW`, `DO_NOT_SCALE`, and `INSUFFICIENT_DATA`
- Displays recommended budget step, reasons, risks, monitoring metrics, and stop guardrails
- Uses `scale_up_advisor_latest` from Dashboard API
- Added Scale question to AI Chat suggested prompts

## Important

- Recommendation only; no automatic budget changes
- Campaign Status remains sourced from AI Intelligence Builder / Scoring_Rules + Benchmark Percentiles

## Test order

Save → Publish / Active → Execute → inspect Execution → confirm `scale_up_advisor_latest` → deploy frontend → Ctrl + Shift + R
