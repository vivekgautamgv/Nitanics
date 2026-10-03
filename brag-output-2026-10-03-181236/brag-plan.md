# Nitanics — sixty-second narrated explainer with token reuse

Same blue-and-white product identity, actual Nitanics UI captures, 1080p landscape at 30 fps, synchronized captions, Microsoft Mark narration, and original music. This is a new version; both earlier videos remain preserved.

The additional highlight is the user's requested token benefit: extract and persist knowledge, then retrieve relevant graph context on later questions. The wording is conditional and includes upfront extraction cost and workload dependence. It does not imply automatic document deduplication, prompt compression, free model calls, or a fixed savings percentage.

| Time | Scene |
|---|---|
| 0–6 | Who uses Nitanics: researchers, analysts, students, technical teams |
| 6–14 | Upload complete sources through the web UI and extraction API |
| 14–23 | Clone, attach full documents in a local agent, validate and upload |
| 23–27 | Both input routes feed the same graph in Docker |
| 27–35 | Graph Studio and the real Federal Reserve bridge example |
| 35–43 | Inspect roles and verify claims against original sources |
| 43–54 | Reuse graph context to reduce repeated document reading and potentially input tokens |
| 54–60 | Repository, setup commands, and Nitanics tagline |

The token segment uses actual UI plus an explicitly labeled illustration of the AI workflow. Its source references come from a successful local read-only query. No invented token counters, prices, speedups, or percentage comparisons appear. See token-claim-check.md for the code review, live checks, and the separate recall parameter issue.

Check all scenes and transition stills before export. Then verify 60 seconds/1,800 frames, audio/caption timing, narration presence, audio levels, complete decoding, and frame 0 matching the settled JPEG poster. Intermediates and scripts stay under work/.

## Final verification

The exported MP4 passed complete audio/video decoding: 60 seconds, 1,800 frames, 1920×1080 at 30 fps, H.264/yuv420p, and AAC stereo at 48 kHz. All 16 narration sentences have synchronized captions. Integrated loudness is -15.9 LUFS; true peak is -4.2 dBFS. Narration is at least 19.64 dB above the underlying music during spoken sections. The compressed first frame matches the poster with a mean absolute pixel error of 1.356. Encoded scene frames were visually inspected for layout, readability, and source fidelity.

## Reproduction

The pinned FFmpeg helper (`imageio-ffmpeg==0.6.0`) is scoped to `work/deps`; it does not change the application's dependencies. Use the bundled Python runtime with `work/render_walkthrough.py --reuse-audio --render` to render again from the preserved narration, then run `work/verify_walkthrough.py`. Narration generation uses `work/make_narration.ps1` under PowerShell 7 with the installed Microsoft Mark voice. No application source, graph records, or service configuration was changed.
