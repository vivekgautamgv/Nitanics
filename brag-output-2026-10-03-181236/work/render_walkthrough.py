"""One-minute Nitanics explainer using actual UI captures and local narration."""
from pathlib import Path
import argparse
import importlib.util
import json
import math
import re
import subprocess
import sys
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont

WORK = Path(__file__).resolve().parent
OUT = WORK.parent
ROOT = OUT.parent
sys.path.insert(0, str(WORK / "deps"))
import imageio_ffmpeg

spec = importlib.util.spec_from_file_location("visual_helpers", WORK / "visual_helpers.py")
v = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v)
FF = imageio_ffmpeg.get_ffmpeg_exe()
W, H, FPS, DURATION, RATE = 1920, 1080, 30, 60, 48000
STORY = json.loads((WORK / "story.json").read_text(encoding="utf-8"))
FOCUSED_CONTEXT = json.loads((WORK / "verified-focused-context.json").read_text(encoding="utf-8"))
CAPTIONS = []
TIMING = []
BLUE, INK, GRAY = v.BLUE, v.INK, v.GRAY


def write_wav(path, samples):
    with wave.open(str(path), "wb") as f:
        f.setnchannels(1 if samples.ndim == 1 else samples.shape[1])
        f.setsampwidth(2)
        f.setframerate(RATE)
        f.writeframes((np.clip(samples, -.999, .999) * 32767).astype("<i2").tobytes())


def read_wav(path):
    with wave.open(str(path), "rb") as f:
        assert f.getsampwidth() == 2 and f.getframerate() == RATE
        a = np.frombuffer(f.readframes(f.getnframes()), dtype="<i2").astype(np.float64) / 32768
        return a.reshape(-1, f.getnchannels()).mean(axis=1)


def trim(a):
    occupied = np.flatnonzero(np.abs(a) > .0045)
    assert len(occupied), "Narration is silent"
    first = max(0, occupied[0] - round(.04 * RATE))
    last = min(len(a), occupied[-1] + round(.07 * RATE))
    return a[first:last]


def audio():
    voice = np.zeros(DURATION * RATE)
    for scene in STORY:
        sentences = re.split(r"(?<=[.!?])\s+", scene["narration"])
        parts = [trim(read_wav(WORK / f"voice-{scene['id']}-s{i+1:02d}.wav")) for i in range(len(sentences))]
        gap = .16
        source_length = sum(len(a) / RATE for a in parts) + gap * (len(parts)-1)
        available = scene["duration"] - .55
        tempo = max(1., source_length / available)
        assert tempo < 1.22, (scene["id"], tempo)
        at = scene["start"] + .25
        scene_parts = []
        for i, (sentence, part) in enumerate(zip(sentences, parts)):
            raw = WORK / f"trimmed-{scene['id']}-s{i+1:02d}.wav"
            processed = WORK / f"processed-{scene['id']}-s{i+1:02d}.wav"
            write_wav(raw, part)
            filters = (f"highpass=f=75,lowpass=f=12000,atempo={tempo:.7f},"
                       "acompressor=threshold=0.12:ratio=2:attack=8:release=100:makeup=1.25")
            subprocess.run([FF, "-y", "-hide_banner", "-loglevel", "error", "-i", str(raw),
                            "-af", filters, "-ar", str(RATE), "-ac", "1", str(processed)], check=True)
            a = read_wav(processed)
            peak = np.max(np.abs(a))
            a *= .69 / max(.001, peak)
            start = round(at * RATE)
            voice[start:start+len(a)] += a
            end = at + len(a)/RATE
            CAPTIONS.append({"start": at, "end": end+.06, "text": sentence})
            scene_parts.append({"sentence":sentence, "start":round(at,3), "end":round(end,3)})
            at = end + gap/tempo
        assert at - gap/tempo <= scene["start"] + scene["duration"] - .2
        TIMING.append({"scene":scene["id"], "time_adjustment":round(tempo,4), "sentences":scene_parts})
    write_wav(OUT / "narration.wav", voice)
    (OUT / "narration.txt").write_text("\n\n".join(s["narration"] for s in STORY)+"\n", encoding="utf-8")
    (WORK / "speech-timing.json").write_text(json.dumps(TIMING, indent=2), encoding="utf-8")

    def stamp(t):
        ms = round(t*1000)
        return f"{ms//3600000:02d}:{(ms//60000)%60:02d}:{(ms//1000)%60:02d},{ms%1000:03d}"

    srt = "\n\n".join(f"{i+1}\n{stamp(c['start'])} --> {stamp(c['end'])}\n{c['text']}" for i,c in enumerate(CAPTIONS))
    (OUT / "captions.srt").write_text(srt+"\n", encoding="utf-8")

    # Original C-minor score, restrained under the voice rather than competing with it.
    music = np.zeros((DURATION*RATE, 2))
    rng = np.random.default_rng(60148)
    beat = .6  # 100 BPM
    chords = [[48,55,63], [44,51,60], [46,53,62], [43,50,58]]

    def add(when, a, gain, pan=0.):
        i = round(when*RATE)
        if i < 0 or i >= len(music):
            return
        count = min(len(a), len(music)-i)
        theta = (pan+1)*math.pi/4
        music[i:i+count,0] += a[:count]*gain*math.cos(theta)
        music[i:i+count,1] += a[:count]*gain*math.sin(theta)

    def note(midi, length, pluck=False):
        t = np.arange(round(length*RATE))/RATE
        hz = 440*2**((midi-69)/12)
        tone = np.sin(2*np.pi*hz*t)+.16*np.sin(2*np.pi*hz*2*t)
        env = (1-np.exp(-t*95))*np.exp(-t*5) if pluck else np.minimum(t/.5,1)*np.minimum((length-t)/.7,1)
        return tone*env

    for bar in range(math.ceil(DURATION/(beat*4))):
        chord = chords[bar%4]
        for j,n in enumerate(chord):
            add(bar*beat*4, note(n+12,beat*4+.5), .024, (j-1)*.45)
        for step in range(8):
            add(bar*beat*4+step*beat/2, note(chord[step%3]+24,.8,True), .05, -.3 if step%2==0 else .3)
        for step in range(4):
            tt = np.arange(round(.22*RATE))/RATE
            phase = 2*np.pi*(42*tt+50*.03*(1-np.exp(-tt/.03)))
            add(bar*beat*4+step*beat, np.sin(phase)*np.exp(-tt*22)*(1-np.exp(-tt*200)), .05)
            add(bar*beat*4+step*beat, note(chord[0]-12,.4,True), .034)
    for at in [6,14,23,27,30.4,35,38.1,43,46,54]:
        t = np.arange(round(.3*RATE))/RATE
        noise = rng.normal(0,1,len(t))
        noise = np.convolve(noise,np.ones(14)/14,"same")
        add(at-.12, noise*np.sin(np.pi*t/.3)**2, .024, -.15)
    for at in [19.3,30.4,38.1,46.0]:
        t = np.arange(round(.08*RATE))/RATE
        add(at,np.sin(2*np.pi*1046.5*t)*np.exp(-t*72),.027,.1)

    time = np.arange(len(music))/RATE
    envelope = np.minimum(time/.65,1)*np.minimum((DURATION-time)/.65,1)
    # The score stays quieter throughout speech; gaps get a small lift.
    duck = np.full(len(music), .68)
    for c in CAPTIONS:
        i,j = round(c['start']*RATE),round(c['end']*RATE)
        duck[i:j] = .43
    duck = np.convolve(duck, np.ones(2400)/2400, "same")
    music *= (envelope*duck)[:,None]
    write_wav(WORK / "music-and-effects.wav", music)
    mixed = music + voice[:,None]*.86
    write_wav(WORK / "mix-before-master.wav", mixed)
    subprocess.run([FF, "-y", "-hide_banner", "-loglevel", "error", "-i", str(WORK/"mix-before-master.wav"),
                    "-af", "loudnorm=I=-16:TP=-1.5:LRA=8", "-ar", str(RATE), "-ac", "2",
                    str(WORK/"final-audio.wav")], check=True)
    print("Narration, captions, original score, and final audio mix are ready.", flush=True)


def wrapped(value, size, width, weight="regular"):
    draw = ImageDraw.Draw(v.BG)
    lines, line = [], ""
    for word in value.split():
        candidate = (line+" "+word).strip()
        if draw.textlength(candidate,font=v.font(size,weight)) > width and line:
            lines.append(line)
            line = word
        else:
            line = candidate
    if line:
        lines.append(line)
    return lines


def paragraph(im,x,y,value,size,width,color=GRAY,weight="regular",gap=8):
    for line in wrapped(value,size,width,weight):
        v.text(im,(x,y),line,size,color,weight)
        y += size+gap
    return y


def top(im,scene,index):
    v.text(im,(105,42),scene['chapter'],24,BLUE,"bold")
    v.text(im,(103,92),scene['heading'],52,INK,"bold")
    v.icon(im,1690,54,54)
    v.text(im,(1758,59),"Nitanics",27,INK,"bold")
    v.text(im,(1760,107),f"{index+1:02d} / 08",22,GRAY)


def points(im,scene,u,remark=None):
    y = 265
    for i,point in enumerate(scene['points']):
        q = v.ease((u-.15-i*.12)/.5)
        layer = Image.new("RGBA",(W,H))
        d = ImageDraw.Draw(layer)
        d.ellipse((107,y+8,143,y+44),fill=BLUE)
        v.text(layer,(125,y+25),str(i+1),22,"white","bold",anchor="mm")
        bottom = paragraph(layer,165,y+14*(1-q),point,30,340,INK,gap=8)
        layer.putalpha(layer.getchannel('A').point(lambda x:round(x*q)))
        im.paste(layer,(0,0),layer)
        y = max(y+110,bottom+44)
    if remark:
        d = ImageDraw.Draw(im)
        d.rounded_rectangle((107,713,516,875),18,fill=(232,240,255))
        paragraph(im,128,732,remark,24,365,GRAY,gap=6)


def product(im,name,u,crop=None):
    # Subtle camera push, using only real captured UI pixels.
    width = 1200+2*round(8*v.smooth(u/7))
    x,y = 584-(width-1200)/2,196-6*v.smooth(u/7)
    v.screen(im,name,x=x,y=y+22*(1-v.ease(u/.55)),width=width,crop=crop)
    return x,y,width


def intro(im,u):
    v.icon(im,110,58,60)
    v.text(im,(185,64),"Nitanics",32,INK,"bold")
    v.text(im,(108,246),"Your research.",90,INK,"bold")
    v.text(im,(108,356),"Connected.",90,BLUE,"bold")
    paragraph(im,112,500,"Read across papers, reports, and notes.",37,540,GRAY,gap=10)
    v.text(im,(113,687),"MADE FOR",23,BLUE,"bold")
    paragraph(im,112,733,"Researchers, analysts, students, and technical teams.",32,550,INK,gap=9)
    v.screen(im,"home",x=756+40*(1-v.ease(u/.7)),y=259,width=1050,crop=(274,72,1260,515))
    v.text(im,(761,795),"Real documents. Shared concepts. Source evidence.",27,GRAY)


def local_flow(im,u):
    d = ImageDraw.Draw(im)
    for y,title,desc in [(275,"Web UI + API","Full files + extraction key"),(499,"Local coding agent","Repo + complete attachments")]:
        d.rounded_rectangle((108,y,548,y+152),22,fill="white",outline=(211,224,248),width=2)
        v.text(im,(135,y+27),title,35,INK,"bold")
        v.text(im,(135,y+84),desc,25,GRAY)
    d.line((548,351,738,459),fill=(151,181,240),width=4)
    d.line((548,575,738,489),fill=(151,181,240),width=4)
    d.polygon([(738,449),(738,505),(765,477)],fill=BLUE)
    d.rounded_rectangle((773,381,1110,579),25,fill=BLUE)
    v.text(im,(941,435),"Neo4j",48,"white","bold",anchor="mm")
    v.text(im,(941,515),"Docker · local graph",25,"white",anchor="mm")
    d.line((1110,477,1164,477),fill=(151,181,240),width=4)
    d.polygon([(1163,460),(1163,494),(1187,477)],fill=BLUE)
    v.screen(im,"documents",x=1206,y=339,width=593,crop=(274,230,1260,700))
    v.text(im,(1207,661),"Documents · Graph · Bridges",25,INK,"bold")
    for offset in [0,.6]:
        q=((u+offset)%1.8)/1.8
        x=548+(738-548)*q
        y=351+(459-351)*q if offset==0 else 575+(489-575)*q
        d.ellipse((x-5,y-5,x+5,y+5),fill=BLUE)
    v.text(im,(109,784),"Full sources → extraction artifacts → validation → your graph",30,GRAY)


def token_reuse(im,u):
    d=ImageDraw.Draw(im)
    v.text(im,(622,190),"AI WORKFLOW · ILLUSTRATION",22,GRAY,"bold")
    d.rounded_rectangle((621,232,1787,341),19,fill="white",outline=(211,224,248),width=2)
    v.text(im,(647,247),"A QUESTION AFTER INGESTION",22,BLUE,"bold")
    v.text(im,(647,284),"How is the Federal Reserve connected?",35,INK,"bold")
    d.line((905,343,905,370),fill=(151,181,240),width=4)
    d.polygon([(893,369),(917,369),(905,388)],fill=BLUE)
    q=(u%1.6)/1.6
    py=347+26*q
    d.ellipse((901,py-4,909,py+4),fill=BLUE)
    # Actual graph pixels, alongside actual source references from the verified local query.
    v.screen(im,"graph-closing",x=620,y=399,width=554)
    v.text(im,(625,733),"Stored knowledge · Neo4j",27,INK,"bold")
    d.line((1175,566,1201,566),fill=(151,181,240),width=4)
    d.polygon([(1200,552),(1200,580),(1217,566)],fill=BLUE)
    px=1175+31*((u+.6)%1.6)/1.6
    d.ellipse((px-4,562,px+4,570),fill=BLUE)
    d.rounded_rectangle((1227,399,1788,751),20,fill="white",outline=(211,224,248),width=2)
    v.text(im,(1251,417),"FOCUSED GRAPH CONTEXT",21,BLUE,"bold")
    v.text(im,(1251,464),FOCUSED_CONTEXT[0]['entity'],36,INK,"bold")
    v.text(im,(1252,523),"Entity roles + source references",25,GRAY)
    y=578
    for row in FOCUSED_CONTEXT:
        d.ellipse((1252,y+11,1262,y+21),fill=BLUE)
        y=paragraph(im,1281,y,row['source'],23,477,INK,gap=4)+15
    d.rounded_rectangle((621,788,1788,872),17,fill=(232,240,255))
    v.text(im,(1204,827),"Less repeated full-document reading",32,BLUE,"bold",anchor="mm")


def outro(im,u,poster=False):
    v.icon(im,110,194,92)
    v.text(im,(107,343),"Nitanics",100,INK,"bold")
    v.text(im,(111,492),"Your knowledge,",43,GRAY,"light")
    v.text(im,(110,552),"connected.",57,BLUE,"bold")
    d=ImageDraw.Draw(im)
    d.rounded_rectangle((110,685,704,760),18,fill=BLUE)
    v.text(im,(407,721),"Clone. Connect. Explore.",31,"white","bold",anchor="mm")
    v.text(im,(113,802),"github.com/vivekgautamgv/nitanics",26,GRAY)
    v.screen(im,"graph-closing",x=818,y=176,width=983)
    d.rounded_rectangle((818,762,1801,917),20,fill=(23,37,69))
    v.text(im,(844,778),"QUICK START · IN THE CLONED REPOSITORY",20,(164,193,252),"bold")
    v.text(im,(844,815),"bun install                 bun run nlp:setup",25,"white")
    v.text(im,(844,854),"bun run neo4j:ensure        bun run dev",25,"white")
    if poster:
        v.text(im,(113,887),"Connected research. Reusable AI context.",25,GRAY)
    else:
        v.text(im,(113,883),"Configure Neo4j using the README first.",24,GRAY)


def captions(im,t):
    for cue in CAPTIONS:
        if cue['start'] <= t <= cue['end']:
            lines=wrapped(cue['text'],32,1555)
            assert len(lines)<=2,(cue,lines)
            d=ImageDraw.Draw(im)
            d.rounded_rectangle((143,945,1777,1051),18,fill=(24,31,46))
            y=965 if len(lines)==2 else 982
            for line in lines:
                v.text(im,(960,y),line,32,"white",anchor="mt")
                y+=42
            break


def render(t,poster=False):
    im=v.BG.copy()
    if poster:
        outro(im,2,True)
        return im
    index=next(i for i,s in enumerate(STORY) if s['start']<=t<s['start']+s['duration'])
    scene=STORY[index]
    u=t-scene['start']
    if index==0:
        intro(im,u)
    elif index==7:
        outro(im,u)
    else:
        top(im,scene,index)
        if index==1:
            points(im,scene,u,"API extraction sends source text to your chosen provider.")
            product(im,"upload-api",u,(260,52,1272,667))
        elif index==2:
            points(im,scene,u,"Uses your agent’s model. Local file, command, and Neo4j access are required.")
            name="upload-agent" if u<5.3 else "agent-prompt"
            product(im,name,u,(260,52,1270,660) if u<5.3 else (366,180,1170,575))
        elif index==3:
            local_flow(im,u)
        elif index==4:
            points(im,scene,u,"Sample: Federal Reserve is shared by three documents in this collection.")
            if u<3.4:
                product(im,"graph-closing",u)
            else:
                x,y,width=product(im,"bridges",u,(276,216,1259,690))
                # Emphasize the existing Federal Reserve row, including its real source chips.
                if u>5.0:
                    scale=width/983
                    d=ImageDraw.Draw(im)
                    d.rounded_rectangle((x+6*scale,y+(518-216)*scale,x+974*scale,y+(595-216)*scale),12,outline=BLUE,width=4)
        elif index==5:
            points(im,scene,u,"A shared mention does not prove agreement. Check the original evidence.")
            if u<3.1:
                product(im,"graph-evidence",u)
            else:
                product(im,"source-reader",u,(260,138,1260,710))
        elif index==6:
            points(im,scene,u,"Initial extraction uses tokens. Savings depend on your questions and retrieval scope.")
            if u<3:
                product(im,"graph-evidence",u)
            else:
                token_reuse(im,u)
    # Clear dip transitions; narration is not faded during scene changes.
    boundaries=[6,14,23,27,30.4,35,38.1,43,46,54]
    for boundary in boundaries:
        dt=abs(t-boundary)
        if dt<.15:
            im=Image.blend(v.BG,im,v.smooth(dt/.15))
            break
    captions(im,t)
    ImageDraw.Draw(im).rectangle((0,1074,round(W*t/DURATION),1079),fill=BLUE)
    return im


def previews():
    times=[3.5,10.5,17,21,25,29,33,36.5,40.5,44.5,47.5,51.5,57.5,45.93,53.93]
    sheet=Image.new("RGB",(1600,1650),"#e8edf5")
    for i,t in enumerate(times):
        im=render(t)
        im.save(WORK/f"preview-{t:05.2f}.png")
        x,y=16+(i%3)*528,14+(i//3)*328
        sheet.paste(im.resize((512,288),Image.Resampling.LANCZOS),(x,y))
        v.text(sheet,(x+5,y+293),f"{t:.2f}s",21,INK)
    sheet.save(WORK/"contact-sheet.jpg",quality=95)
    render(57,True).save(OUT/"brag.jpg",quality=96,subsampling=0)
    print("Scene and transition previews are ready.",flush=True)


def encode():
    poster=Image.open(OUT/"brag.jpg").convert("RGB")
    command=[FF,"-y","-hide_banner","-loglevel","warning","-f","rawvideo","-pix_fmt","rgb24",
             "-s",f"{W}x{H}","-r",str(FPS),"-i","pipe:0","-i",str(WORK/"final-audio.wav"),
             "-map","0:v:0","-map","1:a:0","-c:v","libx264","-preset","fast","-crf","18",
             "-pix_fmt","yuv420p","-c:a","aac","-b:a","192k","-ar",str(RATE),"-ac","2",
             "-t",str(DURATION),"-movflags","+faststart",str(OUT/"brag.mp4")]
    with (WORK/"encode.log").open("w",encoding="utf-8") as log:
        p=subprocess.Popen(command,stdin=subprocess.PIPE,stderr=log)
        try:
            for i in range(FPS*DURATION):
                p.stdin.write((poster if i==0 else render(i/FPS)).tobytes())
                if i%180==0:
                    print(f"Rendered {i}/{FPS*DURATION} frames",flush=True)
            p.stdin.close()
            code=p.wait()
        except BaseException:
            p.kill()
            raise
    assert code==0,(WORK/"encode.log").read_text()
    print(f"One-minute narrated video ready: {OUT/'brag.mp4'}",flush=True)


if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--render",action="store_true")
    parser.add_argument("--reuse-audio",action="store_true")
    args=parser.parse_args()
    if args.reuse_audio:
        for item in json.loads((WORK/"speech-timing.json").read_text(encoding="utf-8")):
            for sentence in item['sentences']:
                CAPTIONS.append({'start':sentence['start'],'end':sentence['end']+.06,'text':sentence['sentence']})
    else:
        audio()
    previews()
    if args.render:
        encode()
