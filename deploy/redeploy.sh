#!/usr/bin/env bash
# گزارش‌یار — publish the static build to the web root.
#
#   bash deploy/redeploy.sh
#
# The whole app is a single self-contained index.html (fonts inlined, no
# external requests), so "deploying" is a pull plus a copy. Only the published
# artifacts are copied: the web root must never contain .git/ or the build
# tooling.

set -euo pipefail

SRC_DIR="${SRC_DIR:-/var/www/gozaresh-yar-src}"
WEB_DIR="${WEB_DIR:-/var/www/rep.academyr.ir}"
BRANCH="${BRANCH:-main}"

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

cd "$SRC_DIR"

log "Pulling $BRANCH"
git fetch --prune origin
git reset --hard "origin/$BRANCH"

log "Publishing to $WEB_DIR"
mkdir -p "$WEB_DIR"
install -m 644 index.html "$WEB_DIR/index.html"
# Starter files shipped next to the app (the README points people at them).
for f in "قوانین-پیش‌فرض.json" "نمونه-ورودی-گزارش‌یار.xlsx"; do
  [ -f "$f" ] && install -m 644 "$f" "$WEB_DIR/$f"
done
chmod -R a+rX "$WEB_DIR"

log "Published"
ls -lh "$WEB_DIR" | sed -n '2,6p'
printf '\nHealth check: curl -sS -o /dev/null -w "%%{http_code}\\n" https://rep.academyr.ir/\n'
