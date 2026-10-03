# Nitanics launch film

Format: 1920 × 1080, 30 fps, 22 seconds. Tone: polished, with clean cuts and soft electronic music. No narration.

Nitanics turns papers, reports, and notes into a local knowledge graph for researchers. Users add documents with an extraction API key or a coding agent, explore concepts shared across sources, and inspect original evidence. The visual hook moves from actual source rows to the app's actual graph.

Identity: reuse the live React UI, its blue #2563eb, neutral #fafafa/#18181b, Segoe UI system font, and the repository's three-node logo geometry. Real finance sample data only. No invented upload completion, user quotes, or savings claims.

| Time | Scene | Screen material and motion | Settled copy |
|---|---|---|---|
| 0–2.5 | Hook | Actual document rows slide alongside the hook | All those papers. / Find the thread. |
| 2.5–5.5 | Reveal | Actual Home UI rises into a framed product view | Nitanics / Your knowledge, connected. |
| 5.5–9.5 | Two ways in | Actual API upload UI switches to the actual agent option, with a visible pointer | Upload here. Or use your agent. |
| 9.5–14.5 | Connections | Actual collection Graph and Bridges views, with a gentle camera push | Find what your sources share. |
| 14.5–18.5 | Evidence | Actual graph inspector with document roles, then the original source reader | Follow the evidence. |
| 18.5–22 | Outro | Actual graph remains behind brand mark; title and repository CTA settle | Nitanics / Your knowledge, connected. / Clone. Connect. Explore. |

Sound: original instrumental in C minor, 108 BPM. Soft pad, rounded bass, restrained kick/hat, plucked arpeggio. Interface accents share the same key and ambience. Final fade, no harsh peaks.

Transitions: outgoing view dips to a clean background before the next view arrives. The API-to-agent radio change is a direct cut. Actual captured states are cut in sequence, with cursor emphasis and framing. The camera pushes in slowly while captions stay fixed.

QA: inspect settled frames from all six scenes plus transition frames; verify duration, frame count, dimensions, audio stream, and full decode. The strongest settled graph frame becomes brag.jpg and replaces frame 0 of brag.mp4.

Verified export: 22.00 seconds, 660 frames at 30 fps, 1920 × 1080 H.264/yuv420p, AAC stereo at 48 kHz. Full audio/video decode passed. Integrated loudness is -16.5 LUFS; true peak is -2.3 dBFS. Encoded scene stills were inspected, and frame 0 matches the saved poster within expected compression loss. Export size: 4,685,778 bytes. Detailed checks: work/verification.json.

Reproduce using the bundled Python runtime: run work/render_video.py --render, then work/verify_video.py. FFmpeg is scoped to work/deps; music and effects are original synthesis. No product source or graph data was changed.
