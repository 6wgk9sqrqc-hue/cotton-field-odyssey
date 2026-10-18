# Nightly Claude Tips & Tricks batch (Instagram Reels)

Goal: 5 new 1080x1920 videos in the established neon "CLAUDE AI / TIPS & TRICKS" style, uploaded to Google Drive
with captions. Runs at ~9pm Asia/Jerusalem; posting is the NEXT day: 05:00, 09:30, 14:00, 18:30, 23:00 Asia/Jerusalem (4.5 h apart).

1. `git fetch origin video-pipeline && git checkout video-pipeline`, then `cd video-pipeline && ./setup.sh`.
2. Pick 25 NEW tips (5 themed videos x 5) not in `used_tips.md`. Mix prompting techniques (any plan) and features.
   Fact-check every feature claim on the web against Anthropic sources (support.claude.com incl. release notes,
   claude.com, platform/code docs) as of today: current name, UI path, plans, beta status. Drop anything unverified.
3. For each video make `vN/content.py` like `examples/content_v8.py` (cat, tag, head, term, icon, color order
   #2EE6FF #FF3DF2 #A07BFF #3CF0A0 #FFB02E, vo intro/head/detail, type_frac/term_delay/term_frac).
   Tags: plan availability ("ANY PLAN", "PAID PLANS", "CLAUDE CODE | PAID", beta...). Icons: see `elif kind ==` in render2.py.
   Rules learned in review: headline must be spoken early in the head VO; terminal line must paraphrase the detail
   VO and type while those words are spoken (use term_delay/term_frac); spell commands for TTS ("slash init",
   "Claude dot M D"); avoid short lines where "Claude" directly follows a 1-syllable verb.
4. `python3 validate.py v1 ... v5` must report 0 problems. Run `python3 tts_probe.py 1.0 < lines.txt` on risky lines.
5. Audio, one at a time: `./audio_one.sh vN`. Render 2 at a time:
   `printf "v1 out1.mp4\n..." | xargs -P 2 -L 1 ./render_one.sh` (run in foreground; avoid self-matching pgrep).
6. QA each: `cd vN && python3 ../qa_prep.py out.mp4 ../models/asr/sherpa-onnx-whisper-base.en && python3 ../sentence_asr.py qa/final16k.wav ../models/asr/sherpa-onnx-whisper-base.en`.
   Fix real mishearings (not Claude/clawed/cloud homophones) and re-render. Look at qa/frames for clipping/sync.
7. Upload to Google Drive folder "Claude Tips Reels/<posting date YYYY-MM-DD = tomorrow in Asia/Jerusalem>" (create if missing): the 5 MP4s plus
   `posting_plan.md` with, per video: post time (Asia/Jerusalem), Instagram caption (hook line, 5 tips as bullets,
   CTA "Save this + follow for daily AI finds", 5-8 hashtags like #ClaudeAI #AItips #productivity), and a cover-frame note.
8. Append the 25 tips under "Nightly batches" in `used_tips.md`, commit, `git push -u origin video-pipeline`.
9. Final message: Drive link, the 5 titles, anything dropped in fact-check. If something failed, say exactly what.
Never post to Instagram or any social account.
