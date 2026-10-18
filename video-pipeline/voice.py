"""Generate the narration line by line with Kokoro (af_heart), add light 'room' processing,
and write voice.wav (48 kHz stereo) + timeline.json that the renderer syncs to."""
import json
import os
import sys

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro
from scipy.signal import butter, fftconvolve, lfilter, resample_poly, sosfilt

sys.path.insert(0, os.getcwd())  # per-video content.py lives in the working directory
from content import HOOK_VO, OUTRO_VO, TIPS

MODELS = sys.argv[1]
VOICE = sys.argv[2] if len(sys.argv) > 2 else "af_heart"
SPEED = 1.0
SR = 48000

kokoro = Kokoro(f"{MODELS}/kokoro-v1.0.onnx", f"{MODELS}/voices-v1.0.bin")


def say(text):
    s, sr = kokoro.create(text, voice=VOICE, speed=SPEED, lang="en-us")
    s = resample_poly(np.asarray(s, dtype=np.float64), SR, sr)
    # trim leading/trailing near-silence so timing is exact
    env = np.abs(s) > 0.01
    idx = np.where(env)[0]
    a, b = max(0, idx[0] - int(0.02 * SR)), min(len(s), idx[-1] + int(0.06 * SR))
    return s[a:b]


FIRST = 0.9       # first words (gives the intro pose a beat, like the original)
GAP_IN = 0.22     # after "Tip one: examples."
GAP_MID = 0.30    # after the headline sentence
GAP_TIP = 0.75    # between tips (card -> chip transition happens here)

clips, timeline = [], {"tips": []}
t = 0.2
c = say(HOOK_VO)
clips.append((t, c))
timeline["hook"] = [round(t, 3), round(t + len(c) / SR, 3)]
t += len(c) / SR + 0.75  # beat before card 01 (title card holds here)
for tip in TIPS:
    rec = {}
    for key, gap in (("intro", GAP_IN), ("head", GAP_MID), ("detail", 0.0)):
        c = say(tip["vo"][key])
        clips.append((t, c))
        rec[key] = [round(t, 3), round(t + len(c) / SR, 3)]
        t += len(c) / SR + gap
    timeline["tips"].append(rec)
    t += GAP_TIP
t += 0.15
c = say(OUTRO_VO)
clips.append((t, c))
timeline["outro_vo"] = [round(t, 3), round(t + len(c) / SR, 3)]
total = max(t + len(c) / SR + 1.9, 55.6)  # poster spec 55-62 s: short scripts hold the end card longer
timeline["total"] = round(total, 3)

dry = np.zeros(int(total * SR) + SR)
for start, c in clips:
    i = int(start * SR)
    dry[i:i + len(c)] += c

# ---- light processing so it sits like a real voice-over, not a raw TTS dump
dry = sosfilt(butter(2, 75, "highpass", fs=SR, output="sos"), dry)
presence = sosfilt(butter(2, [2500, 6500], "bandpass", fs=SR, output="sos"), dry)
warmth = sosfilt(butter(2, [150, 400], "bandpass", fs=SR, output="sos"), dry)
v = dry + 0.18 * presence + 0.10 * warmth
# gentle RMS compressor (3:1 above -24 dBFS)
a = np.exp(-1 / (0.03 * SR))
env = np.sqrt(np.maximum(lfilter([1 - a], [1, -a], v ** 2), 1e-12))
lvl = 20 * np.log10(env)
over = np.maximum(lvl + 24, 0)
v = v * 10 ** (-(over * (1 - 1 / 3)) / 20)
# small-room reverb: decaying filtered noise IR, stereo
rng = np.random.default_rng(3)
n = int(0.45 * SR)
tt = np.arange(n) / SR
irs = []
for ch in range(2):
    ir = rng.standard_normal(n) * np.exp(-tt / 0.07)
    ir = sosfilt(butter(2, 5000, "lowpass", fs=SR, output="sos"), ir)
    ir[: int(0.012 * SR)] = 0
    irs.append(ir / np.sqrt(np.sum(ir ** 2)))
wetL = fftconvolve(v, irs[0])[: len(v)]
wetR = fftconvolve(v, irs[1])[: len(v)]
out = np.stack([v + 0.11 * wetL, v + 0.11 * wetR], 1)
out /= np.max(np.abs(out)) / 0.9
out = out[: int(total * SR)]
sf.write("voice.wav", out, SR, subtype="PCM_16")
json.dump(timeline, open("timeline.json", "w"), indent=1)
print(json.dumps(timeline, indent=1))
