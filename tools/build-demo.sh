#!/bin/sh
# Regenerate the site's demo from the app, end to end.
#
#   1. compile the real Flutter app for web (the web-target-experiment target)
#   2. screenshot its screens as WebP posters, from the real running app
#   3. vendor the live build next to the posters, for the "Try it live" frame
#
# The app is the only source of truth. Change a colour, a label or a menu in the
# app repo, re-run this script, and the site follows. Nothing here is hand-copied.
#
# Usage: sh tools/build-demo.sh [--app DIR] [--skip-build]
set -eu

APP="${ZITOUNA_APP_DIR:-/home/mohamed/Desktop/Github/Zitouna}"
SKIP_BUILD=""
PORT=8099

while [ $# -gt 0 ]; do
  case "$1" in
    --app) APP="$2"; shift 2 ;;
    --skip-build) SKIP_BUILD=1; shift ;;
    --port) PORT="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
SRC="$HERE/../src"
POSTERS="$SRC/demo-posters"
VENDORED="$SRC/flutter-demo"

say() { printf '\n=== %s\n' "$1"; }

# ---------------------------------------------------------------- 1. build
if [ -z "$SKIP_BUILD" ]; then
  say "building the app for web (Flutter, in $APP)"
  # --no-web-resources-cdn is a hard requirement: it keeps CanvasKit and the
  # fonts on our own origin. With it off, the page would reach out to gstatic
  # and the footer's "loads nothing from other websites" promise would break.
  ( cd "$APP" && flutter build web \
      --target=lib/main_web_demo.dart \
      --release \
      --no-web-resources-cdn )
else
  say "skipping the Flutter build (--skip-build)"
fi

# ------------------------------------------------------------- 2. posters
say "capturing screens from the real app"
# Serve the build the same way the site will, so the capture sees real URLs.
python3 -m http.server "$PORT" --directory "$APP/build/web" >/dev/null 2>&1 &
SERVER=$!
# shellcheck disable=SC2064
trap "kill $SERVER 2>/dev/null || true" EXIT INT TERM

# Wait for the server rather than sleeping a fixed amount.
i=0
while [ "$i" -lt 50 ]; do
  if curl -sf "http://127.0.0.1:$PORT/" -o /dev/null; then break; fi
  i=$((i + 1))
  sleep 0.2
done

rm -rf "$POSTERS"
node "$HERE/capture-demo.mjs" --base "http://127.0.0.1:$PORT" --out "$POSTERS"

kill "$SERVER" 2>/dev/null || true
trap - EXIT INT TERM

# -------------------------------------------------------------- 3. vendor
say "vendoring the live build"
# NOTICES is 1.4MB of licence text that the app only reads when a licence page is
# opened. It is never fetched on first load (verified in the request log), so it
# is dropped from the deploy rather than served to every visitor.
rm -rf "$VENDORED"
mkdir -p "$VENDORED"
cp -r "$APP/build/web/." "$VENDORED/"
rm -f "$VENDORED/assets/NOTICES"

# The engine picks its CanvasKit variant at runtime by feature-sniffing in
# flutter_bootstrap.js. Reading that logic:
#   hasChromiumBreakIterators && hasImageCodecs ? (preferWebParagraph && hasTextCluster
#     ? webparagraph/ : chromium/)  :  canvaskit.wasm (root)
# So all THREE are reachable: the two directories for modern browsers, and the
# root build for anything older that lacks those APIs. Deleting the root build
# would 404 exactly those visitors. skwasm and wimp are never selected by this
# configuration and are safe to drop (13MB).
find "$VENDORED/canvaskit" -maxdepth 1 \( -name 'skwasm*' -o -name 'wimp*' \) -delete

printf '\n=== done\n'
printf 'posters: %s\n' "$POSTERS"
printf 'live build: %s\n' "$VENDORED"
du -sh "$POSTERS" "$VENDORED" 2>/dev/null || true