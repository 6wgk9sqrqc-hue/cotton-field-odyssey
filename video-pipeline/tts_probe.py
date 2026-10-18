import sys, numpy as np
from kokoro_onnx import Kokoro
import sherpa_onnx
from scipy.signal import resample_poly
import os
M = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
k = Kokoro(f"{M}/kokoro/kokoro-v1.0.onnx", f"{M}/kokoro/voices-v1.0.bin")
d = f"{M}/asr/sherpa-onnx-whisper-base.en"
rec = sherpa_onnx.OfflineRecognizer.from_whisper(encoder=f"{d}/base.en-encoder.int8.onnx", decoder=f"{d}/base.en-decoder.int8.onnx",
                                                 tokens=f"{d}/base.en-tokens.txt", language="en", task="transcribe", num_threads=4)
speed = float(sys.argv[1])
for line in sys.stdin.read().strip().splitlines():
    s, sr = k.create(line, voice="af_heart", speed=speed, lang="en-us")
    x = resample_poly(np.asarray(s, np.float64), 16000, sr).astype(np.float32)
    st = rec.create_stream(); st.accept_waveform(16000, x); rec.decode_stream(st)
    print(f"{len(s)/sr:5.2f}s | {line}\n        -> {st.result.text.strip()}")
