from pathlib import Path
import json
import re
import subprocess
import sys
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont

WORK=Path(__file__).resolve().parent
OUT=WORK.parent
sys.path.insert(0,str(WORK/'deps'))
import imageio_ffmpeg
ff=imageio_ffmpeg.get_ffmpeg_exe()
video=OUT/'brag.mp4'
meta=subprocess.run([ff,'-hide_banner','-i',str(video)],capture_output=True,text=True).stderr
(WORK/'metadata.log').write_text(meta,encoding='utf-8')
for expected in ['1920x1080','30 fps','Video: h264','yuv420p','Audio: aac','stereo','Duration: 00:01:00.00']:
    assert expected in meta,(expected,meta)
decoded=subprocess.run([ff,'-hide_banner','-nostats','-i',str(video),'-af','ebur128=peak=true',
                        '-progress','pipe:1','-f','null','-'],capture_output=True,text=True)
(WORK/'decode.log').write_text(decoded.stderr,encoding='utf-8')
assert decoded.returncode==0,decoded.stderr
frames=re.findall(r'^frame=(\d+)$',decoded.stdout,re.M)
assert frames and int(frames[-1])==1800,decoded.stdout
lufs=float(re.findall(r'I:\s+(-?[\d.]+) LUFS',decoded.stderr)[-1])
peak=float(re.findall(r'Peak:\s+(-?[\d.]+) dBFS',decoded.stderr)[-1])
assert -19<lufs<-13,lufs
assert peak<-.5,peak

indices=[0,105,315,510,630,750,870,990,1095,1215,1335,1425,1545,1725]
select='+'.join(f'eq(n\\,{i})' for i in indices)
extract=subprocess.run([ff,'-y','-hide_banner','-loglevel','error','-i',str(video),'-vf',f'select={select}',
                        '-fps_mode','vfr',str(WORK/'encoded-%02d.png')],capture_output=True,text=True)
assert extract.returncode==0,extract.stderr
poster=np.asarray(Image.open(OUT/'brag.jpg').convert('RGB'),dtype=np.float32)
first=np.asarray(Image.open(WORK/'encoded-01.png').convert('RGB'),dtype=np.float32)
mae=float(np.mean(np.abs(poster-first)))
assert mae<2,mae
sheet=Image.new('RGB',(1600,1650),'#e8edf5')
label_font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',21)
for j,index in enumerate(indices):
    im=Image.open(WORK/f'encoded-{j+1:02d}.png').convert('RGB')
    assert np.std(np.asarray(im))>20,index
    x,y=16+(j%3)*528,14+(j//3)*328
    sheet.paste(im.resize((512,288),Image.Resampling.LANCZOS),(x,y))
    ImageDraw.Draw(sheet).text((x+5,y+293),f'{index/30:.2f}s',font=label_font,fill='#18181b')
sheet.save(WORK/'encoded-contact-sheet.jpg',quality=95)

def read_wav(path):
    with wave.open(str(path),'rb') as f:
        assert f.getnframes()/f.getframerate()==60
        return np.frombuffer(f.readframes(f.getnframes()),dtype='<i2').astype(np.float64).reshape(-1,f.getnchannels())/32768

voice=read_wav(OUT/'narration.wav')[:,0]
music=read_wav(WORK/'music-and-effects.wav').mean(axis=1)
speech=json.loads((WORK/'speech-timing.json').read_text(encoding='utf-8'))
ratios=[]
sentence_count=0
for scene in speech:
    for s in scene['sentences']:
        sentence_count+=1
        a,b=round(s['start']*48000),round(s['end']*48000)
        vrms=float(np.sqrt(np.mean(voice[a:b]**2)))*.86
        mrms=float(np.sqrt(np.mean(music[a:b]**2)))
        assert vrms>.02,(scene,s)
        ratios.append(20*np.log10(vrms/max(1e-7,mrms)))
        assert s['end']<60,s
assert min(ratios)>12,ratios
assert sentence_count==16,sentence_count
assert (OUT/'captions.srt').read_text(encoding='utf-8').count('-->')==16
result={'duration_seconds':60,'frames':1800,'fps':30,'dimensions':[1920,1080],
        'video_codec':'H.264','pixel_format':'yuv420p','audio':'AAC stereo, 48 kHz',
        'narration':'Microsoft Mark, locally generated','spoken_sentences':sentence_count,
        'captions':'burned-in, plus external SRT','integrated_loudness_lufs':lufs,'true_peak_dbfs':peak,
        'minimum_narration_above_music_db':round(min(ratios),2),
        'poster_frame0_mean_absolute_error':round(mae,3),'full_decode':'passed','bytes':video.stat().st_size}
(WORK/'verification.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result,indent=2))
