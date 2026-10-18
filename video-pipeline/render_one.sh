#!/usr/bin/env bash
# Stage 2 for one video: render frames + mux mix_final.wav. usage: render_one.sh <vdir> <out.mp4>
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE/$1"
python3 "$HERE/render2.py" video "$2" mix_final.wav 2>&1 | grep -vi warn | tail -1
LOUD=$(ffmpeg -hide_banner -i "$2" -af ebur128=peak=true:framelog=quiet -f null - 2>&1 | grep -E " I:| Peak:" | tr -s ' ' | tr '\n' ' ')
echo "$1 $2 duration=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$2")s $LOUD"
