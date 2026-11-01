# Deployment (filled in at Stage 8)

Same pattern as DailyCalendarShop: Nginx (TLS, /uploads, proxy) → `sunsteel-api.service` (127.0.0.1:5290)
and `sunsteel-ssr.service` (127.0.0.1:4130, env API_BASE_URL, SITE_URL, ALLOWED_HOSTS). Write
`/config.js` per environment with the same API_BASE_URL / SITE_URL.

`deploy.sh` publishes the API **self-contained** (linux-x64), so the VPS needs no .NET runtime of its own; other sites on the
same server keep using theirs. `DOMAIN` must always be passed: the shared VPS also hosts other projects.
