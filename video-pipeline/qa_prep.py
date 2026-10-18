"""Extract QA material from the finished video: frames at key moments (from the encoded mp4, not the
renderer), an ASR transcript of the final audio, and loudness stats. Writes qa/ + qa/summary.json."""
import json
import os
import subprocess
import sys

video = sys.argv[1]
asr_model = sys.argv[2]
os.makedirs("qa/frames", exist_ok=True)
tl = json.load(open("timeline.json"))

moments = {"hook_mid": (tl["hook"][0] + tl["hook"][1]) / 2}
for k, tp in enumerate(tl["tips"]):
    n = k + 1
    moments[f"tip{n}_intro_spoken"] = tp["intro"][0] + 0.3
    moments[f"tip{n}_headline_done"] = tp["head"][1] + 0.1
    moments[f"tip{n}_detail_done"] = tp["detail"][1] - 0.1
    moments[f"tip{n}_transition"] = tp["detail"][1] + 0.5
moments["outro_mid"] = (tl["outro_vo"][0] + tl["outro_vo"][1]) / 2
moments["final_second"] = tl["total"] - 1.2

frames = {}
for name, t in moments.items():
    out = f"qa/frames/{t:06.2f}_{name}.png"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.3f}", "-i", video, "-frames:v", "1", out], check=True)
    frames[name] = {"t": round(t, 2), "file": os.path.abspath(out)}

subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", video, "-vn", "-ac", "1", "-ar", "16000", "qa/final16k.wav"], check=True)
asr = subprocess.run([sys.executable, "-I", os.path.join(os.path.dirname(os.path.abspath(__file__)), "asr.py"), "qa/final16k.wav", asr_model],
                     capture_output=True, text=True).stdout
loud = subprocess.run(["ffmpeg", "-hide_banner", "-i", video, "-af", "ebur128=peak=true:framelog=quiet", "-f", "null", "-"],
                      capture_output=True, text=True).stderr
loud = "\n".join(l.strip() for l in loud.splitlines() if any(k in l for k in (" I:", "LRA:", "Peak:")))
probe = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration,size:stream=codec_name,width,height,r_frame_rate",
                        "-of", "compact", video], capture_output=True, text=True).stdout
summary = dict(video=os.path.abspath(video), timeline=tl, frames=frames, asr_transcript=asr, loudness=loud, probe=probe)
json.dump(summary, open("qa/summary.json", "w"), indent=1)
print(json.dumps({k: v for k, v in summary.items() if k != "frames"}, indent=1)[:3000])
print(len(frames), "frames")
