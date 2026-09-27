#!/usr/bin/env bash
# Build "What's Worth Building" end to end:
#   narration -> timeline + frames -> score & mix -> final MP4.
set -euo pipefail
cd "$(dirname "$0")/.."
WORKERS="${WORKERS:-4}"

echo "== 1/4 narration";   python3 tools/narrate.py
echo "== 2/4 frames";      rm -rf build/frames && node tools/render.mjs --workers "$WORKERS"
echo "== 3/4 soundtrack";  python3 tools/score.py
echo "== 4/4 encode";      bash tools/encode.sh
