# Frontend V4.5.0 — AI Chat MVP

## Added

- AI Chat page at `ai-chat/index.html`
- New `AI_CHAT_URL` in `assets/js/config.js`
- Game and Account scope selector
- Suggested demo questions
- Evidence cards and source data date
- Session-aware navigation and redirect handling

## Backend dependency

Import and publish `AI Ads Copilot - Dashboard API - AI Chat MVP.json`.
The workflow adds `POST /webhook/ai-marketing-copilot/chat` to the existing Dashboard API workflow.

## Access policy

- ADMIN: all active cached Meta data
- Non-admin: requires ACTIVE rows in `User_Access`
- Chat filters cache data before it is sent to Gemini

## Test order

Save → Publish / Active → Execute or Test → inspect Execution → deploy frontend → Ctrl + Shift + R
