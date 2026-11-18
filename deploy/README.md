# Deployment (filled in at Stage 8)

Same pattern as DailyCalendarShop: Nginx (TLS, /uploads, proxy) → `sunsteel-api.service` (127.0.0.1:5290)
and `sunsteel-ssr.service` (127.0.0.1:4130, env API_BASE_URL, SITE_URL, ALLOWED_HOSTS). Write
`/config.js` per environment with the same API_BASE_URL / SITE_URL.

`deploy.sh` publishes the API **self-contained** (linux-x64), so the VPS needs no .NET runtime of its own; other sites on the
same server keep using theirs. `DOMAIN` must always be passed: the shared VPS also hosts other projects.

## Backups

`deploy.sh` installs `backup-sunsteel.sh` as `/usr/local/sbin/sunsteel-backup.sh` and a cron entry (`/etc/cron.d/sunsteel-backup`)
that runs it every night at 02:30. It also runs the backup once at the end of each deploy, so a broken setup shows up there.

- Writes to `/var/backups/sunsteel/` (root-only; the files hold customer data): `db-YYYY-MM-DD-HHMM.sql.gz` (the `sunsteel` database)
  and `files-YYYY-MM-DD-HHMM.tar.gz` (`uploads/` and `lead-files/`). Files older than 14 days are deleted.
- Log: `/var/log/sunsteel/backup.log`. A failed run exits non-zero and leaves no half-written file.
- These are on the same server, so they cover mistakes and bad deploys, not losing the VPS. Copy `/var/backups/sunsteel/` off the
  server (or turn on Hostinger's VPS backups) for that.

Restore the database (stop the API first so nothing writes during the import):

```bash
systemctl stop sunsteel-api
gunzip -c /var/backups/sunsteel/db-YYYY-MM-DD-HHMM.sql.gz | mysql sunsteel
systemctl start sunsteel-api
```

Restore the files: `tar -xzf /var/backups/sunsteel/files-YYYY-MM-DD-HHMM.tar.gz -C /var/www/sunsteel && chown -R www-data:www-data /var/www/sunsteel/uploads /var/www/sunsteel/lead-files`.

## Security headers

`sunsteel-security.conf` (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Strict-Transport-Security` for 30 days) is installed to
`/etc/nginx/snippets/` on every deploy and included in `location /` and `location /admin`. It is not included for `/api/`, which sends its own.
New installs get the two `include` lines from `nginx-sunsteel.conf`; on an older install `deploy.sh` adds them once to the live site file
(backup at `/root/sunsteel.nginx.pre-headers.bak`) and puts the file back if `nginx -t` fails. There is no Content-Security-Policy yet:
Google Analytics and the inline scripts need one written and tested first.
