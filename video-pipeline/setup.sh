#!/usr/bin/env bash
# One-time setup in a fresh container: Python deps, Kokoro TTS + Whisper ASR models (GitHub releases), fonts (npm).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
pip install -q pycairo scipy soundfile kokoro-onnx sherpa-onnx fonttools brotli 2>&1 | grep -v "Running pip" || true
mkdir -p "$HERE/models/kokoro" "$HERE/models/asr" "$HERE/fontdl"
cd "$HERE/models"
[ -s kokoro/kokoro-v1.0.onnx ] || curl -sSL --retry 3 -o kokoro/kokoro-v1.0.onnx https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
[ -s kokoro/voices-v1.0.bin ] || curl -sSL --retry 3 -o kokoro/voices-v1.0.bin https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
if [ ! -d asr/sherpa-onnx-whisper-base.en ]; then
  curl -sSL --retry 3 -o asr/w.tar.bz2 https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-base.en.tar.bz2
  tar xjf asr/w.tar.bz2 -C asr && rm asr/w.tar.bz2
fi
cd "$HERE/fontdl"
npm pack @fontsource/exo-2 @fontsource/share-tech-mono @fontsource/nunito @fontsource/orbitron @fontsource/audiowide --silent >/dev/null
for f in *.tgz; do d=${f%.tgz}; mkdir -p "$d" && tar xzf "$f" -C "$d"; done
python3 "$HERE/mkfonts.py" "$HERE/fontdl" && fc-cache -f >/dev/null
echo "setup ok: $(fc-list | grep -c /vid/) fonts"
