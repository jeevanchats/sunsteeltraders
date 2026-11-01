#!/usr/bin/env bash
# Build locally, ship to the VPS, (re)start. Idempotent.
#   DOMAIN=example.com SCHEME=http ./deploy/deploy.sh      # before TLS
#   DOMAIN=example.com SCHEME=https ./deploy/deploy.sh     # after certbot
# DOMAIN has no default on purpose: the VPS hosts other sites, so a wrong default would rewire this one.
# First run also creates the DB + user, generates secrets into /etc/sunsteel/api.env,
# and installs the Nginx site. Later runs never touch those.
set -euo pipefail
HOST="${HOST:-root@62.72.59.84}"
DOMAIN="${DOMAIN:?Set DOMAIN, e.g. DOMAIN=example.com ./deploy/deploy.sh}"
SCHEME="${SCHEME:-https}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$(mktemp -d)"; trap 'rm -rf "$OUT"' EXIT
R=/var/www/sunsteel

echo "==> build API";  dotnet publish "$ROOT/sunsteel.api" -c Release -r linux-x64 --self-contained true -o "$OUT/api" --nologo -v q
echo "==> build web";  (cd "$ROOT/sunsteel.web" && npm ci --silent && npx ng build >/dev/null)
cp -r "$ROOT/sunsteel.web/dist/sunsteel-web" "$OUT/web"
cat > "$OUT/web/browser/config.js" <<CFG
window.__APP_CONFIG__ = { apiBaseUrl: '$SCHEME://$DOMAIN/api', siteUrl: '$SCHEME://$DOMAIN' };
CFG
mkdir -p "$OUT/mig"; cp "$ROOT"/database/migrations/0*.sql "$OUT/mig/"
render() { sed -e "s#__DOMAIN__#$DOMAIN#g" -e "s#__SCHEME__#$SCHEME#g" "$1"; }
render "$ROOT/deploy/sunsteel-ssr.service"  > "$OUT/sunsteel-ssr.service"
render "$ROOT/deploy/nginx-sunsteel.conf"  > "$OUT/nginx-sunsteel.conf"
cp "$ROOT/deploy/sunsteel-api.service" "$OUT/"

echo "==> upload"
tar -C "$OUT" -czf - . | ssh "$HOST" "rm -rf /tmp/ss-release && mkdir /tmp/ss-release && tar -xzf - -C /tmp/ss-release"

echo "==> install"
ssh "$HOST" DOMAIN="$DOMAIN" SCHEME="$SCHEME" R="$R" bash -s <<'REMOTE'
set -euo pipefail
S=/tmp/ss-release
mkdir -p $R/uploads $R/lead-files /var/log/sunsteel /etc/sunsteel /var/cache/nginx/sunsteel
chown -R www-data:www-data $R/uploads $R/lead-files /var/log/sunsteel

if [ ! -f /etc/sunsteel/api.env ]; then
  echo "   first run: creating database + secrets"
  DBPW=$(openssl rand -hex 16); JWT=$(openssl rand -base64 48 | tr -d '\n'); ADM=$(openssl rand -base64 12 | tr -d '/+=\n')A1!
  mysql -e "CREATE DATABASE IF NOT EXISTS sunsteel CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
            CREATE USER IF NOT EXISTS 'sunsteel'@'localhost' IDENTIFIED BY '$DBPW';
            ALTER USER 'sunsteel'@'localhost' IDENTIFIED BY '$DBPW';
            GRANT ALL ON sunsteel.* TO 'sunsteel'@'localhost';"
  umask 077
  cat > /etc/sunsteel/api.env <<ENV
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_URLS=http://127.0.0.1:5290
ConnectionStrings__Default=Server=localhost;Database=sunsteel;Uid=sunsteel;Pwd=$DBPW;CharSet=utf8mb4;
Jwt__Key=$JWT
Admin__DefaultPassword=$ADM
Cors__Origins__0=$SCHEME://$DOMAIN
Cors__Origins__1=$SCHEME://www.$DOMAIN
Media__UploadPath=$R/uploads
Leads__FilePath=$R/lead-files
Serilog__WriteTo__1__Args__path=/var/log/sunsteel/sunsteel-.log
ENV
  chmod 640 /etc/sunsteel/api.env; chgrp www-data /etc/sunsteel/api.env
else
  # keep CORS in step with SCHEME on later runs
  sed -i "s#^Cors__Origins__0=.*#Cors__Origins__0=$SCHEME://$DOMAIN#; s#^Cors__Origins__1=.*#Cors__Origins__1=$SCHEME://www.$DOMAIN#" /etc/sunsteel/api.env
fi

echo "   migrations"
for f in $(ls $S/mig/0*.sql | sort); do mysql sunsteel < "$f"; done

systemctl stop sunsteel-api sunsteel-ssr 2>/dev/null || true
rm -rf $R/api $R/web; mkdir -p $R/api $R/web
cp -r $S/api/. $R/api/; cp -r $S/web/. $R/web/
chmod +x $R/api/sunsteel.api   # self-contained: the VPS needs no shared .NET runtime
chown -R www-data:www-data $R/api $R/web
cp $S/sunsteel-api.service $S/sunsteel-ssr.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now sunsteel-api sunsteel-ssr

if [ ! -f /etc/nginx/sites-available/sunsteel ]; then
  cp $S/nginx-sunsteel.conf /etc/nginx/sites-available/sunsteel
  ln -sf /etc/nginx/sites-available/sunsteel /etc/nginx/sites-enabled/sunsteel
fi
nginx -t && systemctl reload nginx

sleep 4
echo "   api: $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5290/api/health)   ssr: $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4130/)"
rm -rf $S
REMOTE
echo "==> done"
