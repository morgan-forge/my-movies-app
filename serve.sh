#!/usr/bin/env bash
# Serve My Movies over local network (Mac + iPhone on same Wi‑Fi).
set -e
cd "$(dirname "$0")"
PORT="${MY_MOVIES_PORT:-8000}"

IP=$(ipconfig getifaddr en0 2>/dev/null) || \
  IP=$(ifconfig | awk '/inet .* broadcast/ { print $2; exit }')
if [ -z "$IP" ]; then
  echo "Could not detect local IP. Connect Mac to Wi‑Fi and try again."
  exit 1
fi

STANDALONE_URL="http://${IP}:${PORT}/standalone.html"
echo "My Movies – local server"
echo "================================"
echo "On iPhone (Safari), open:"
echo "  ${STANDALONE_URL}"
echo ""
echo "Then: Share → Add to Home Screen"
echo "The app will work OFFLINE after that."
printf '%s' "$STANDALONE_URL" | pbcopy
echo "(URL copied to clipboard)"
echo ""
echo "Tip: if you added new movies, run:"
echo "  python3 build.py   ← rebuild offline file"
echo "  then reload in Safari to cache new data"
echo ""
echo "Press Ctrl+C to stop."
echo "================================"

exec python3 -m http.server "$PORT" --bind 0.0.0.0
