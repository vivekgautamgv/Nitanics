from pathlib import Path
import json
import re
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

WORK = Path(__file__).resolve().parent
OUT = WORK.parent
sys.path.insert(0, str(WORK/"deps"))
import imageio_ffmpeg

ff = imageio_ffmpeg.get_ffmpeg_exe()
video = OUT/"brag.mp4"
metadata = subprocess.run([ff, "-hide_banner", "-i", str(video)], capture_output=True, text=True).stderr
(WORK/"metadata.log").write_text(metadata, encoding="utf-8")
assert "1920x1080" in metadata and "30 fps" in metadata, metadata
assert "Video: h264" in metadata and "yuv420p" in metadata, metadata
assert "Audio: aac" in metadata and "stereo" in metadata, metadata
assert "Duration: 00:00:22.00" in metadata, metadata

decode = subprocess.run([ff, "-hide_banner", "-nostats", "-i", str(video),
                         "-af", "ebur128=peak=true", "-progress", "pipe:1", "-f", "null", "-"],
                        capture_output=True, text=True)
(WORK/"decode.log").write_text(decode.stderr, encoding="utf-8")
assert decode.returncode == 0, decode.stderr
frames = re.findall(r"^frame=(\d+)$", decode.stdout, re.M)
assert frames and int(frames[-1]) == 660, decode.stdout
integrated = re.findall(r"I:\s+(-?[\d.]+) LUFS", decode.stderr)[-1]
true_peak = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", decode.stderr)[-1]
assert float(true_peak) < -.5, true_peak

indices = [0, 54, 117, 195, 255, 324, 405, 468, 522, 606]
select = "+".join(f"eq(n\\,{i})" for i in indices)
extract = subprocess.run([ff, "-y", "-hide_banner", "-loglevel", "error", "-i", str(video),
                          "-vf", f"select={select}", "-fps_mode", "vfr",
                          str(WORK/"encoded-%02d.png")], capture_output=True, text=True)
assert extract.returncode == 0, extract.stderr
poster = np.asarray(Image.open(OUT/"brag.jpg").convert("RGB"), dtype=np.float32)
frame0 = np.asarray(Image.open(WORK/"encoded-01.png").convert("RGB"), dtype=np.float32)
mae = float(np.mean(np.abs(poster-frame0)))
assert mae < 2, mae

sheet = Image.new("RGB", (1600, 1330), "#e8edf5")
label_font = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 21)
for j, index in enumerate(indices):
    im = Image.open(WORK/f"encoded-{j+1:02d}.png").convert("RGB")
    assert np.std(np.asarray(im)) > 20, index
    x, y = 16+(j%3)*528, 14+(j//3)*328
    sheet.paste(im.resize((512,288), Image.Resampling.LANCZOS), (x,y))
    ImageDraw.Draw(sheet).text((x+5, y+293), f"{index/30:.2f}s", font=label_font, fill="#18181b")
sheet.save(WORK/"encoded-contact-sheet.jpg", quality=95)

result = {"duration_seconds":22, "frames":660, "fps":30, "dimensions":[1920,1080],
          "video_codec":"H.264", "pixel_format":"yuv420p", "audio":"AAC stereo, 48 kHz",
          "integrated_loudness_lufs":float(integrated), "true_peak_dbfs":float(true_peak),
          "poster_frame0_mean_absolute_error":round(mae,3), "full_decode":"passed",
          "bytes":video.stat().st_size}
(WORK/"verification.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
print(json.dumps(result, indent=2))
