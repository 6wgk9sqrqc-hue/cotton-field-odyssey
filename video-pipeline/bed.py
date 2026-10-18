"""Synthwave ambient bed (bass-heavy pad like the original) + UI sfx, ducked under the voice,
mixed with voice.wav into mix.wav."""
import json
import sys

import numpy as np
import soundfile as sf
from scipy.signal import butter, lfilter, sosfilt

SR = 48000
tl = json.load(open("timeline.json"))
TOTAL = tl["total"]
N = int(TOTAL * SR)
rng = np.random.default_rng(11)


def midi(m):
    return 440 * 2 ** ((m - 69) / 12)


def filt(x, kind, f, order=2):
    return sosfilt(butter(order, f, kind, fs=SR, output="sos"), x)


def saw(f, n, phase=0.0):
    t = np.arange(n) / SR
    return 2 * ((t * f + phase) % 1) - 1


BPM = 84
BAR = 4 * 60 / BPM
# i - VI - III - VII in A minor, long and dreamy
CHORDS = [(45, [57, 60, 64, 67]), (41, [53, 57, 60, 64]), (48, [55, 60, 64, 67]), (43, [55, 59, 62, 66])]
nb = int(np.ceil(TOTAL / BAR)) + 1
pad = np.zeros(int((nb + 1) * BAR * SR) + SR)
sub = np.zeros_like(pad)
arp = np.zeros_like(pad)
for b in range(nb):
    t0 = b * BAR
    root, notes = CHORDS[b % 4]
    n = int((BAR + 0.6) * SR)
    t = np.arange(n) / SR
    env = np.minimum(1, t / 0.6) * np.clip((BAR + 0.6 - t) / 0.6, 0, 1)
    x = sum(saw(midi(m + d), n, rng.random()) for m in notes for d in (-0.08, 0.08)) / (len(notes) * 2)
    i = int(t0 * SR)
    pad[i:i + n] += x * env
    s = np.sin(2 * np.pi * midi(root - 12) * t) + 0.25 * np.sin(2 * np.pi * midi(root) * t)
    sub[i:i + n] += s * env
    # soft 8th-note arp, two octaves up, with decay
    step = 60 / BPM / 2
    pat = [0, 2, 1, 3, 2, 1, 3, 2]
    for k in range(8):
        f = midi(notes[pat[k]] + 12)
        m = int(0.5 * SR)
        tt = np.arange(m) / SR
        tone = (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * 2 * f * tt)) * np.exp(-tt / 0.16) * np.minimum(1, tt / 0.004)
        j = int((t0 + k * step) * SR)
        arp[j:j + m] += tone
pad = filt(pad, "lowpass", 2500)
pad = pad[:N]
sub = sub[:N]
arp = filt(arp, "lowpass", 3500)[:N]
d = int(60 / BPM * 0.75 * SR)
arp_l = arp.copy()
arp_r = arp.copy()
arp_r[d:] += 0.45 * arp[:-d]
arp_l[2 * d:] += 0.25 * arp[:-2 * d]

L = 0.45 * pad + 0.30 * sub + 0.18 * arp_l
R = 0.45 * pad + 0.30 * sub + 0.18 * arp_r


# ---- sfx
def add(sig, t, g, pan=0.0):
    i = int(t * SR)
    if i >= N:
        return
    sig = sig[:N - i]
    L[i:i + len(sig)] += sig * g * (1 - max(0, pan))
    R[i:i + len(sig)] += sig * g * (1 + min(0, pan))


def whoosh(dur=0.7):
    n = int(dur * SR)
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    ch = 1024
    for i in range(0, n, ch):
        p = i / n
        fc = 300 + 4000 * p
        seg = noise[max(0, i - 4096):i + ch]
        out[i:i + ch] = filt(seg, "bandpass", [fc * 0.6, fc * 1.5])[-len(noise[i:i + ch]):]
    tt = np.arange(n) / SR
    return out * np.sin(np.pi * tt / dur) ** 2


def blip(f0=1200, f1=2400, dur=0.12):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = np.linspace(f0, f1, n)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.04) * np.minimum(1, tt / 0.002)


def shimmer(dur=1.6):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    x = sum(np.sin(2 * np.pi * midi(m) * tt) for m in (81, 84, 88, 93)) / 4
    return x * np.exp(-tt / 0.5) * np.minimum(1, tt / 0.01)


for k, tip in enumerate(tl["tips"]):
    card_in = tip["intro"][0] - 0.3
    add(blip(900, 1800), card_in, 0.10)
    add(blip(1500, 2600, 0.08), card_in + 0.12, 0.06, pan=0.3)
    add(whoosh(0.8), tip["detail"][1] + 0.05, 0.10)
add(shimmer(), tl["outro_vo"][0] - 0.35, 0.10)

music = np.stack([L, R], 1)
music /= np.max(np.abs(music))

# ---- duck the bed under the voice
voice, vsr = sf.read("voice.wav")
assert vsr == SR
voice = voice[:N]
if len(voice) < N:
    voice = np.pad(voice, ((0, N - len(voice)), (0, 0)))
a = np.exp(-1 / (0.25 * SR))
venv = np.sqrt(lfilter([1 - a], [1, -a], voice.mean(1) ** 2))
duck = 1 - 0.45 * np.clip(venv / 0.08, 0, 1)
music *= duck[:, None]

bed_db = float(sys.argv[1]) if len(sys.argv) > 1 else -17.0  # bed level relative to voice
mix = voice + music * 10 ** (bed_db / 20) * 0.9
fade = np.ones(N)
fs = int((TOTAL - 1.0) * SR)
fade[fs:] = np.linspace(1, 0, N - fs)
mix *= fade[:, None]
fi = int(0.05 * SR)
mix[:fi] *= np.linspace(0, 1, fi)[:, None]
mix /= np.max(np.abs(mix)) / 0.95
sf.write("mix.wav", mix, SR, subtype="PCM_16")
print("mix.wav", TOTAL)
