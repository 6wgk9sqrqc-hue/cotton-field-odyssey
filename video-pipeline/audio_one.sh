#!/usr/bin/env bash
# Stage 1 for one video: narration -> music bed -> loudness-normalized mix_final.wav (run sequentially).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE/$1"
python3 "$HERE/voice.py" "$HERE/models/kokoro" af_heart 2>&1 | grep -vi warn > timeline.log || true
test -s timeline.json
python3 "$HERE/bed.py" -21 > /dev/null
I=$(ffmpeg -hide_banner -i mix.wav -af ebur128=framelog=quiet -f null - 2>&1 | awk '/ I:/{v=$2} END{print v}')
G=$(python3 -c "print(round(-14.0 - float('$I'), 2))")
ffmpeg -v error -y -i mix.wav -af "volume=${G}dB,alimiter=limit=0.78:attack=3:release=60:level=disabled" -ar 48000 mix_final.wav
echo "$1 audio ok gain=${G}dB total=$(python3 -c "import json;print(json.load(open('timeline.json'))['total'])")s"
