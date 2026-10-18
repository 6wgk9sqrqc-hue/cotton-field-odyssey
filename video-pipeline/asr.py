import sys, wave
import numpy as np
import sherpa_onnx

d = sys.argv[2]
rec = sherpa_onnx.OfflineRecognizer.from_whisper(
    encoder=f"{d}/base.en-encoder.int8.onnx", decoder=f"{d}/base.en-decoder.int8.onnx",
    tokens=f"{d}/base.en-tokens.txt", language="en", task="transcribe", num_threads=4)
w = wave.open(sys.argv[1]); sr = w.getframerate()
x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
hop = int(0.01 * sr)
rms = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2)) for i in range(0, len(x) - hop, hop)])
db = 20 * np.log10(rms + 1e-9)
thr = np.percentile(db, 25) + 4
quiet = db < thr
# pause = run of quiet frames >= 15 (150ms); split in its middle
cuts, i = [0], 0
while i < len(quiet):
    if quiet[i]:
        j = i
        while j < len(quiet) and quiet[j]:
            j += 1
        if j - i >= 15:
            cuts.append((i + j) // 2)
        i = j
    else:
        i += 1
cuts.append(len(quiet))
print(f"floor {np.percentile(db,10):.1f} dB, speech p90 {np.percentile(db,90):.1f} dB, thr {thr:.1f}")
for a, b in zip(cuts, cuts[1:]):
    if b - a < 20:
        continue
    seg = x[a * hop:b * hop]
    if 20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-9) < thr:
        continue
    s = rec.create_stream(); s.accept_waveform(sr, seg); rec.decode_stream(s)
    print(f"[{a/100:6.2f}-{b/100:6.2f}] {s.result.text.strip()}")
