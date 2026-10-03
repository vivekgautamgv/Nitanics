"""Nitanics launch film. All product footage is captured from the running app.

Creates an original soundtrack, preview stills, a JPEG poster, and an H.264 MP4.
No application files or data are modified.
"""
from pathlib import Path
import argparse
import math
import subprocess
import sys
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

WORK = Path(__file__).resolve().parent
OUT = WORK.parent
sys.path.insert(0, str(WORK / "deps"))
import imageio_ffmpeg

W, H, FPS, DURATION = 1920, 1080, 30, 22
BLUE = (37, 99, 235)
INK = (24, 24, 27)
GRAY = (82, 82, 91)
FONT_DIR = Path("C:/Windows/Fonts")
FONTS = {}


def font(size, weight="regular"):
    key = (size, weight)
    if key not in FONTS:
        name = {"regular": "segoeui.ttf", "bold": "segoeuib.ttf", "light": "segoeuisl.ttf"}[weight]
        FONTS[key] = ImageFont.truetype(str(FONT_DIR / name), size)
    return FONTS[key]


def smooth(x):
    x = max(0., min(1., x))
    return x * x * (3 - 2 * x)


def ease(x):
    return 1 - (1 - max(0., min(1., x))) ** 3


def text(im, xy, value, size, color=INK, weight="regular", anchor=None):
    ImageDraw.Draw(im).text(xy, value, font=font(size, weight), fill=color, anchor=anchor)


def icon(im, x, y, size=64):
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((x, y, x + size, y + size), radius=size * .25, fill=BLUE)
    s = size / 32
    ox, oy = x + 4 * s, y + 4 * s
    coords = [(6, 6), (18, 9), (9, 18)]
    for a, b in [(0, 1), (0, 2), (1, 2)]:
        d.line((ox + coords[a][0] * s, oy + coords[a][1] * s,
                ox + coords[b][0] * s, oy + coords[b][1] * s), fill="white", width=max(2, round(1.5 * s)))
    for cx, cy in coords:
        cx, cy, r = ox + cx * s, oy + cy * s, 2.5 * s
        d.ellipse((cx-r, cy-r, cx+r, cy+r), fill=BLUE, outline="white", width=max(2, round(1.6*s)))


# Subtle blue light follows the product's native blue and neutral palette.
yy, xx = np.mgrid[0:H, 0:W]
glow = np.exp(-(((xx - 1720) / 1000) ** 2 + ((yy - 230) / 850) ** 2))
bg = np.zeros((H, W, 3), dtype=np.float32)
for ch, (a, b) in enumerate(zip((249, 250, 252), (232, 240, 255))):
    bg[:, :, ch] = a + (b-a) * glow
BG = Image.fromarray(bg.astype(np.uint8)).convert("RGB")

SHOTS = {p.stem: Image.open(p).convert("RGB") for p in WORK.glob("*.png")}
PREPARED = {}


def frame_asset(name, width, crop=None):
    key = (name, width, crop)
    if key in PREPARED:
        return PREPARED[key]
    shot = SHOTS[name]
    if crop:
        shot = shot.crop(crop)
    height = round(shot.height * width / shot.width)
    shot = shot.resize((width, height), Image.Resampling.LANCZOS).convert("RGBA")
    mask = Image.new("L", shot.size)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, width-1, height-1), 18, fill=255)
    shot.putalpha(mask)
    shadow = Image.new("RGBA", (width + 100, height + 120))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((50, 55, 50+width, 55+height), 20, fill=(20, 40, 90, 36))
    shadow = shadow.filter(ImageFilter.GaussianBlur(24))
    PREPARED[key] = (shot, shadow)
    return shot, shadow


def screen(im, name, x=192, y=181, width=1536, crop=None, alpha=1.):
    shot, shadow = frame_asset(name, width, crop)
    if alpha >= .999:
        im.paste(shadow, (round(x)-50, round(y)-40), shadow)
        im.paste(shot, (round(x), round(y)), shot)
    else:
        layer = Image.new("RGBA", (W, H))
        layer.paste(shadow, (round(x)-50, round(y)-40), shadow)
        layer.paste(shot, (round(x), round(y)), shot)
        layer.putalpha(layer.getchannel("A").point(lambda a: round(a * alpha)))
        im.paste(layer, (0, 0), layer)
    return (x, y, width / 1280)


def cursor(im, position, click_age=None):
    x, y = position
    d = ImageDraw.Draw(im)
    if click_age is not None and 0 <= click_age <= .4:
        r = 12 + 52 * click_age / .4
        pulse = Image.new("RGBA", im.size)
        pd = ImageDraw.Draw(pulse)
        pd.ellipse((x-r, y-r, x+r, y+r), outline=BLUE + (round(180 * (1-click_age/.4)),), width=4)
        im.paste(pulse, (0, 0), pulse)
    pts = [(x, y), (x+1, y+34), (x+10, y+26), (x+19, y+43), (x+26, y+39), (x+18, y+23), (x+31, y+23)]
    d.polygon(pts, fill="white", outline=INK, width=2)


def top(im, heading, subtitle=None):
    text(im, (130, 49), heading, 56, weight="bold")
    if subtitle:
        text(im, (132, 121), subtitle, 24, GRAY)
    icon(im, 1718, 61, 50)
    text(im, (1780, 63), "Nitanics", 25, INK, "bold")


def main_screen(im, name, u, heading, subtitle=None, position=None, click_at=None):
    top(im, heading, subtitle)
    entry = ease(u/.55)
    # A slow two-percent push keeps the real product view in motion after entry.
    width = 1536 + 2 * round(16 * smooth((u-.55)/2.6))
    x = (W-width)/2
    y = 181 + 34 * (1-entry) - (width-1536)*.28125
    box = screen(im, name, x=x, y=y, width=width)
    if position:
        x, y, scale = box
        sx, sy = position
        p = smooth((u-.65)/.8)
        px = x + (sx - 140 + 140*p)*scale
        py = y + (sy + 65 - 65*p)*scale
        cursor(im, (px, py), None if click_at is None else u-click_at)


def hook(t):
    im = BG.copy()
    icon(im, 132, 78, 58)
    text(im, (205, 82), "Nitanics", 31, weight="bold")
    text(im, (132, 246), "All those", 99, weight="bold")
    text(im, (132, 354), "papers.", 99, weight="bold")
    q = ease((t-.55)/.65)
    text(im, (132, 531 + 26*(1-q)), "Find the", 99, BLUE, "bold")
    text(im, (132, 639 + 26*(1-q)), "thread.", 99, BLUE, "bold")
    # The document titles, classifications, and source controls are actual UI pixels.
    screen(im, "documents", x=865 + 85*(1-ease(t/.65)), y=266, width=935,
           crop=(274, 230, 1260, 700))
    text(im, (872, 196), "FROM YOUR DOCUMENTS", 24, BLUE, "bold")
    text(im, (132, 909), "PAPERS   /   REPORTS   /   NOTES", 25, GRAY)
    return im


def outro(t):
    im = BG.copy()
    q = ease(t/.6)
    icon(im, 133, 244 + 22*(1-q), 104)
    text(im, (132, 392 + 22*(1-q)), "Nitanics", 106, weight="bold")
    text(im, (135, 549), "Your knowledge,", 45, GRAY, "light")
    text(im, (135, 607), "connected.", 58, BLUE, "bold")
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((134, 756, 678, 829), radius=16, fill=BLUE)
    text(im, (406, 791), "Clone. Connect. Explore.", 29, "white", "bold", anchor="mm")
    text(im, (135, 868), "github.com/vivekgautamgv/nitanics", 23, GRAY)
    screen(im, "graph-closing", x=824 + 48*(1-q), y=219, width=992)
    text(im, (826, 836), "A local knowledge graph for your research.", 26, GRAY)
    return im


def render(t, poster=False):
    if poster:
        return outro(1.2)
    if t < 2.5:
        im = hook(t)
    elif t < 5.5:
        im = BG.copy()
        main_screen(im, "home", t-2.5, "Your knowledge, connected.",
                    "A local research workspace.", (394, 322), 2.86)
    elif t < 7.5:
        im = BG.copy()
        main_screen(im, "upload-api", t-5.5, "Upload here. Or use your agent.",
                    "Two ways into the same knowledge graph.", (883, 244), 1.9)
    elif t < 9.5:
        im = BG.copy()
        main_screen(im, "upload-agent", t-7.5, "Upload here. Or use your agent.",
                    "Attach full documents in your coding agent’s chat.")
        if t < 7.84:
            cursor(im, (192+883*1.2, 181+244*1.2), t-7.5)
    elif t < 12:
        im = BG.copy()
        main_screen(im, "graph-closing", t-9.5, "Find what your sources share.",
                    "Explore the graph.")
    elif t < 14.5:
        im = BG.copy()
        main_screen(im, "bridges", t-12, "Find what your sources share.",
                    "Compare concepts across documents.")
    elif t < 16.5:
        im = BG.copy()
        main_screen(im, "graph-evidence", t-14.5, "Follow the evidence.",
                    "Inspect connections and document roles.")
    elif t < 18.5:
        im = BG.copy()
        main_screen(im, "source-reader", t-16.5, "Follow the evidence.",
                    "Read the original source.")
    else:
        im = outro(t-18.5)
    # UI changes dip through the clean background, keeping small text legible.
    for boundary in [2.5, 5.5, 9.5, 12, 14.5, 16.5, 18.5]:
        dt = abs(t-boundary)
        if dt < .13:
            im = Image.blend(BG, im, smooth(dt/.13))
            break
    return im


def soundtrack():
    rate = 48000
    n = DURATION * rate
    mix = np.zeros((n, 2), dtype=np.float64)
    rng = np.random.default_rng(1818)
    beat = 60 / 108

    def add(when, signal, gain=1., pan=0.):
        start = round(when * rate)
        if start >= n:
            return
        count = min(len(signal), n-start)
        if count <= 0:
            return
        left, right = math.cos((pan+1)*math.pi/4), math.sin((pan+1)*math.pi/4)
        mix[start:start+count, 0] += signal[:count]*gain*left
        mix[start:start+count, 1] += signal[:count]*gain*right

    def tone(midi, length, pluck=True):
        tt = np.arange(round(length*rate))/rate
        hz = 440 * 2**((midi-69)/12)
        wavelet = np.sin(2*np.pi*hz*tt) + .24*np.sin(2*np.pi*2*hz*tt) + .08*np.sin(2*np.pi*3*hz*tt)
        if pluck:
            env = (1-np.exp(-tt*140))*np.exp(-tt*5.5)
        else:
            env = np.minimum(tt/.35, 1.) * np.minimum((length-tt)/.5, 1.)
        return wavelet*env

    chords = [[48,55,63], [44,51,60], [46,53,62], [43,50,58]]
    bars = math.ceil(DURATION/(beat*4))
    for bar in range(bars):
        chord = chords[bar % 4]
        when = bar*beat*4
        for j, note in enumerate(chord):
            add(when, tone(note+12, beat*4+.3, False), .018, (j-1)*.45)
        for step in range(8):
            when = bar*beat*4 + step*beat/2
            note = chord[step % 3] + 24
            add(when, tone(note, .8), .073, (-.35 if step%2==0 else .35))
            add(when+.23, tone(note, .8), .017, (.45 if step%2==0 else -.45))
        for step in range(4):
            when = bar*beat*4 + step*beat
            tt = np.arange(round(.28*rate))/rate
            phase = 2*np.pi*(43*tt + (102-43)*.035*(1-np.exp(-tt/.035)))
            kick = np.sin(phase)*np.exp(-tt*19)*(1-np.exp(-tt*260))
            add(when, kick, .19)
            add(when, tone(chord[0]-12, .45), .085)
            if when > 2.5:
                ht = np.arange(round(.08*rate))/rate
                noise = rng.normal(0, 1, len(ht))
                noise = noise-np.convolve(noise, np.ones(8)/8, "same")
                add(when+beat/2, noise*np.exp(-ht*75), .018, .2)
            if step in [1, 3] and when > 5.5:
                st = np.arange(round(.14*rate))/rate
                add(when, rng.normal(0, 1, len(st))*np.exp(-st*30), .024, -.12)
    # Matched clean sweeps and click tones sit in the same final audio mix.
    for when in [2.5, 5.5, 9.5, 12, 14.5, 16.5, 18.5]:
        tt = np.arange(round(.28*rate))/rate
        env = np.sin(np.pi*tt/.28)**2
        sw = rng.normal(0, 1, len(tt))
        sw = np.convolve(sw, np.ones(12)/12, "same")
        add(when-.17, sw*env, .045, -.1)
    for when in [5.36, 7.4, 14.3, 16.36]:
        tt = np.arange(round(.065*rate))/rate
        click = np.sin(2*np.pi*1250*tt)*np.exp(-tt*88)
        add(when, click, .055, .12)
    # A resolved C-minor chord carries the final brand hold.
    for j, note in enumerate([48,55,60,63,67]):
        add(18.6+j*.035, tone(note+12, 3.4, False), .026, (j-2)*.2)
    tt = np.arange(n)/rate
    mix *= np.minimum(tt/.22, 1.)[:, None]
    mix *= np.minimum((DURATION-tt)/.65, 1.)[:, None]
    mix = np.tanh(mix*1.2)
    peak = np.max(np.abs(mix))
    mix *= .79/max(peak, .001)
    pcm = (mix*32767).astype("<i2")
    with wave.open(str(WORK/"soundtrack.wav"), "wb") as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(rate)
        f.writeframes(pcm.tobytes())
    print(f"Original stereo soundtrack: {DURATION}s, peak {20*math.log10(.79):.1f} dBFS", flush=True)


def previews():
    times = [1.8, 3.9, 6.5, 8.5, 10.8, 13.5, 15.6, 17.4, 20.2,
             2.43, 9.43, 18.57]
    sheet = Image.new("RGB", (1600, 1320), "#e8edf5")
    for i, t in enumerate(times):
        still = render(t)
        still.save(WORK/f"preview-{t:05.2f}.png")
        thumb = still.resize((512,288), Image.Resampling.LANCZOS)
        x, y = 16+(i%3)*528, 14+(i//3)*328
        sheet.paste(thumb, (x,y))
        ImageDraw.Draw(sheet).text((x+5,y+293), f"{t:.2f}s", font=font(21), fill=INK)
    sheet.save(WORK/"contact-sheet.jpg", quality=95)
    render(19.7, poster=True).save(OUT/"brag.jpg", quality=96, subsampling=0)
    print("Preview stills, contact sheet, and poster created.", flush=True)


def video():
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    soundtrack()
    # Decode the saved JPEG for frame 0, ensuring it is the exact poster image.
    poster = Image.open(OUT/"brag.jpg").convert("RGB")
    cmd = [ff, "-y", "-hide_banner", "-loglevel", "warning", "-f", "rawvideo",
           "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "pipe:0",
           "-i", str(WORK/"soundtrack.wav"), "-map", "0:v:0", "-map", "1:a:0",
           "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p",
           "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
           "-t", str(DURATION), "-movflags", "+faststart", str(OUT/"brag.mp4")]
    with (WORK/"encode.log").open("w", encoding="utf-8") as log:
        process = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=log)
        try:
            for i in range(FPS*DURATION):
                frame = poster if i==0 else render(i/FPS)
                process.stdin.write(frame.tobytes())
                if i % 90 == 0:
                    print(f"Rendered {i}/{FPS*DURATION} frames", flush=True)
            process.stdin.close()
            code = process.wait()
        except BaseException:
            process.kill()
            raise
    if code:
        raise RuntimeError((WORK/"encode.log").read_text())
    print(f"Video ready: {OUT/'brag.mp4'}", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--render", action="store_true")
    args = parser.parse_args()
    previews()
    if args.render:
        video()
