# AI Marketing Copilot Frontend V2

## Complete frontend scope
- Dashboard menu is active and links to Campaign and Creative.
- Campaign page: filters, remembered filters, KPI summary, ranking chart, status summary, sortable table, pagination, detail drawer.
- Creative page: filters, remembered filters, KPI summary, ranking chart, thumbnail coverage, real thumbnail support, placeholder fallback, sortable table, pagination, detail drawer.
- Dashboard Creative Summary supports real thumbnail URLs and pagination.
- Today's Action remains intentionally deferred until AI Decision Engine backend is ready.
- Shared frontend design system added in `assets/css/product.css`.
- Shared Dashboard API/cache adapter added in `assets/js/product-data.js`.
- Cache-busting query strings added to frontend assets.

## No backend changes
This package uses the existing `AI Ads Copilot - Dashboard API` endpoint.
