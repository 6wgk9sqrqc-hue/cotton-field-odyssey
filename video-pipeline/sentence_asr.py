"""Sentence-level ASR of a finished video's audio vs. the scripted narration (run inside a video dir).
usage: python3 sentence_asr.py qa/final16k.wav <asr_model_dir>  -> prints and writes qa/sentence_asr.txt"""
import json
import os
import re
import sys
import wave

import numpy as np
import sherpa_onnx

sys.path.insert(0, os.getcwd())
from content import HOOK_VO, OUTRO_VO, TIPS  # noqa: E402

d = sys.argv[2]
rec = sherpa_onnx.OfflineRecognizer.from_whisper(
    encoder=f"{d}/base.en-encoder.int8.onnx", decoder=f"{d}/base.en-decoder.int8.onnx",
    tokens=f"{d}/base.en-tokens.txt", language="en", task="transcribe", num_threads=2)
w = wave.open(sys.argv[1])
sr = w.getframerate()
x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
tl = json.load(open("timeline.json"))


def asr(a, b):
    s = rec.create_stream()
    s.accept_waveform(sr, x[int(max(0, a) * sr):int(b * sr)])
    rec.decode_stream(s)
    return s.result.text.strip()


def norm(s):
    s = s.lower().replace("%", " percent").replace("&", " and ")
    nums = {"1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "30": "thirty", "100": "hundred"}
    words = [t.strip("'") for t in re.findall(r"[a-z0-9']+", s)]
    homophones = {"clawed": "claude", "clod": "claude", "anthropic's": "anthropic"}
    return [homophones.get(t, nums.get(t, t)) for t in words if t]


rows = [("hook", HOOK_VO, tl["hook"])]
for k, (tip, tt) in enumerate(zip(TIPS, tl["tips"])):
    for key in ("intro", "head", "detail"):
        rows.append((f"tip{k + 1}.{key}", tip["vo"][key], tt[key]))
rows.append(("outro", OUTRO_VO, tl["outro_vo"]))
out = []
for name, script, (a, b) in rows:
    heard = asr(a - 0.15, b + 0.2)
    sw, hw = norm(script), norm(heard)
    missing = [t for t in sw if t not in hw]
    out.append(f"{name:12s} [{a:6.2f}-{b:6.2f}] script: {script}\n{'':12s} heard : {heard}\n{'':12s} script words not heard: {missing}")
txt = "\n".join(out)
open("qa/sentence_asr.txt", "w").write(txt)
print(txt)
