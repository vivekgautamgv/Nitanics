# Nitanics — one-minute narrated walkthrough

Format: exactly 60 seconds, 1920 × 1080, 30 fps. English narration, synchronized burned-in captions, an original restrained electronic score, and the real product UI. The previous 22-second teaser is preserved in its original folder.

Angle: explain who Nitanics helps and take a new viewer from documents to a reusable graph, without assuming they know what a knowledge graph is. Research papers and reports are the main use case; technical documentation is a second example.

Highlights: two ways to ingest sources; collection/bridge exploration; inspecting original evidence. The finance example uses the existing Federal Reserve bridge across three documents, not invented demo results. UI upload is presented as an input workflow, not a recording of completed extraction. API extraction sends source text to the chosen provider; local agents need repository, command, and database access.

Identity: the live UI, native three-node logo, blue #2563eb, neutral backgrounds, and the Windows Segoe UI font. Informative, calm, clear. Minimal callouts beside the product; substantive voice-over explains the context.

| Time | Scene | Context and real screen |
|---|---|---|
| 0–8 | What and who | Home; papers, reports, and notes; researchers, analysts, students, technical teams |
| 8–16 | Web UI + API | Add documents; accepted formats; provider/API key; pipeline steps |
| 16–26 | Local coding agent | Actual agent guide and copyable prompt; clone, attach full sources, validate, upload |
| 26–32 | Shared local workspace | Meaningful flow diagram joins both routes into local Neo4j/Docker and the actual Documents view |
| 32–40 | Explore and compare | Actual Graph Studio then Bridges; Federal Reserve links three finance sources |
| 40–48 | Source evidence | Actual inspector with document roles, then the original source reader; verify AI claims |
| 48–54 | Reuse | Actual collection Export control; portable JSON and optional MCP; local storage/provider distinction |
| 54–60 | Get started | Actual graph, source-backed quick-start commands, repository URL, and brand tagline |

Narration is generated using the installed Microsoft Mark voice, with sentence-level WAV stems. Captions follow those sentence boundaries. Speech is trimmed and gently time-adjusted only when needed to fit a scene; the background score stays below narration. Each scene and transition is inspected before rendering, then encoded frames, the full decode, duration, audio levels, and poster/frame-0 consistency are checked.

Deliverables: brag.mp4, brag.jpg, share-copy.txt, narration.txt, captions.srt. All intermediates and reproducible scripts are in work/. No application source or graph data is changed.

Verified export: exactly 60.00 seconds, 1,800 frames at 30 fps, 1920 × 1080 H.264/yuv420p, and AAC stereo at 48 kHz. Full decode passed. The final mix measures -15.8 LUFS with -3.6 dBFS true peak; narration remains at least 19.63 dB above the score during spoken sentences. All 15 narration/caption sentences are present. Encoded scene stills were inspected; frame 0 matches the JPEG poster within expected compression loss. Size: 6,043,647 bytes. Details are in work/verification.json.

To reproduce on this Windows machine, run work/make_narration.ps1 in the current PowerShell runtime, then use the bundled Python runtime for work/render_walkthrough.py --render and work/verify_walkthrough.py. The FFmpeg runtime is reused from the earlier teaser's work/deps folder. To rebuild visuals without regenerating audio, add --reuse-audio to the renderer.
