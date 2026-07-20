# Frontend 4.8.1 — localStorage Quota Hotfix

## Error fixed

`Failed to execute 'setItem' on 'Storage' ... exceeded the quota`

## Root cause

Historical Dashboard data is larger than the browser localStorage capacity.
The previous flow treated browser-cache writing as part of loading, so a cache
failure prevented the Dashboard from rendering.

## Fix

- Render API data before attempting to persist browser cache.
- Cache writing is now best-effort and never blocks the UI.
- Payloads larger than 1,000,000 characters are kept in memory only.
- Old Dashboard cache versions are removed automatically.
- Cache key is no longer separated by session ID.
- Network/API remains the source used for the latest Dashboard data.
