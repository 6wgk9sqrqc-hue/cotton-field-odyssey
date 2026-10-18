"""Check the 5 finished videos against the poster spec and write posting_plan.md.

usage: python3 make_plan.py <out_dir> v1:file1.mp4 v2:file2.mp4 ... (5 items, in posting order)
Spec: MP4, 9:16, 55-62 s; caption '…3 <topic> tricks: a, b, c <emoji>⚡️', under 100 chars, no hashtags.
Exits non-zero and writes nothing if anything is off.
"""
import importlib.util
import json
import os
import re
import subprocess
import sys

TIMES = ["05:00", "09:30", "14:00", "18:30", "23:00"]
CAP_RE = re.compile(r"^…3 [^:#]+ tricks: [^,#]+, [^,#]+, [^,#]+ \S+⚡️$")

out_dir, items = sys.argv[1], sys.argv[2:]
if len(items) != 5:
    sys.exit("need exactly 5 videos")
rows, errors = [], []
for item, when in zip(items, TIMES):
    vdir, mp4 = item.split(":", 1)
    spec = importlib.util.spec_from_file_location("c", os.path.join(vdir, "content.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    cap = getattr(m, "CAPTION", "")
    if not CAP_RE.match(cap):
        errors.append(f"{mp4}: caption not in '…3 <topic> tricks: a, b, c <emoji>⚡️' form: {cap!r}")
    if len(cap) >= 100:
        errors.append(f"{mp4}: caption is {len(cap)} chars (must be under 100)")
    if "#" in cap:
        errors.append(f"{mp4}: caption contains a hashtag")
    pr = json.loads(subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration,format_name:stream=width,height,codec_type",
         "-of", "json", os.path.join(vdir, mp4)], capture_output=True, text=True, check=True).stdout)
    dur = float(pr["format"]["duration"])
    v = [s for s in pr["streams"] if s["codec_type"] == "video"][0]
    if not 55.0 <= dur <= 62.0:
        errors.append(f"{mp4}: duration {dur:.1f}s outside 55-62s")
    if v["width"] * 16 != v["height"] * 9:
        errors.append(f"{mp4}: {v['width']}x{v['height']} is not 9:16")
    if "mp4" not in pr["format"]["format_name"]:
        errors.append(f"{mp4}: not an MP4 container")
    rows.append((mp4, when, cap, dur))
if errors:
    print("SPEC CHECK FAILED:\n- " + "\n- ".join(errors))
    sys.exit(1)
lines = ["# Posting plan (Instagram Reels, times Asia/Jerusalem)", ""]
for mp4, when, cap, _ in rows:
    lines += [f"## {when} — {mp4}", "", f"- File: {mp4}", f"- Post time: {when} Asia/Jerusalem", f"- Caption: {cap}", ""]
with open(os.path.join(out_dir, "posting_plan.md"), "w") as f:
    f.write("\n".join(lines))
for mp4, when, cap, dur in rows:
    print(f"OK {when} {mp4} {dur:.1f}s {len(cap)} chars: {cap}")
