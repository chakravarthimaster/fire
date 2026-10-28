#!/usr/bin/env python3
"""Build the Karma Yogam movie from shots.json and the images/clips you made in Google Flow.

Free tools only:
  * ffmpeg            (video editing)        https://ffmpeg.org/download.html
  * edge-tts          (Telugu neural voices) pip install edge-tts

Put your files in assets/ named after the shot id, e.g. assets/shot_02.mp4, assets/shot_03.png.
Optional: your own recorded voice as voice/shot_04.mp3 (overrides the AI voice for that shot),
          your own music as music/<anything>.mp3 (otherwise a tanpura-style drone is generated).

  python build_movie.py              full 1080p movie -> output/karma_yoga_movie.mp4
  python build_movie.py --preview    fast 540p draft
  python build_movie.py --only s1    build just one scene (title, s1..s5, finale)
"""
import argparse
import asyncio
import json
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
FPS = 25
IMAGE_EXT = (".png", ".jpg", ".jpeg", ".webp")
VIDEO_EXT = (".mp4", ".mov", ".webm", ".mkv")

FONTS = {
    "NotoSansTelugu.ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/notosanstelugu/NotoSansTelugu%5Bwdth,wght%5D.ttf",
    "Ramaraja-Regular.ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/ramaraja/Ramaraja-Regular.ttf",
    "Cinzel.ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/cinzel/Cinzel%5Bwght%5D.ttf",
}

# Colour grade per scene look (ffmpeg colorbalance + eq), echoing the explainer page.
GRADES = {
    "title":  "eq=contrast=1.10:saturation=0.95",
    "doubt":  "colorbalance=rs=-0.10:bs=0.12:rh=0.06:bh=-0.05,eq=saturation=0.72:contrast=1.08",
    "wheel":  "colorbalance=gs=0.05:rm=0.04:rh=0.06:bh=-0.10,eq=saturation=1.10:contrast=1.05",
    "leader": "colorbalance=rs=-0.12:bs=0.15:rh=0.14:gh=0.04:bh=-0.14,eq=saturation=1.15:contrast=1.12",
    "guna":   "colorbalance=rs=0.08:bs=0.18:gm=-0.06:bh=0.05,eq=saturation=0.90:contrast=1.10",
    "fire":   "colorbalance=rs=0.15:gs=-0.05:bs=-0.12:rm=0.12:bm=-0.10,eq=saturation=1.20:contrast=1.18:gamma=0.92",
    "finale": "colorbalance=rh=0.08:gh=0.05:bh=-0.05,eq=saturation=1.0:brightness=0.02",
}
CARD_BG = {"title": "0x0a0805", "doubt": "0x06141a", "wheel": "0x0b140a", "leader": "0x160d04",
           "guna": "0x0e0a1e", "fire": "0x160403", "finale": "0x14100a"}


def run(cmd, quiet=True):
    r = subprocess.run(cmd, capture_output=quiet, text=True)
    if r.returncode != 0:
        sys.exit(f"Command failed:\n{' '.join(map(str, cmd))}\n{r.stderr[-2000:] if quiet else ''}")
    return r


def duration(path):
    r = run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)])
    return float(r.stdout.strip() or 0)


def find(folder, sid, exts):
    for ext in exts:
        p = HERE / folder / f"shot_{sid}{ext}"
        if p.exists():
            return p
    return None


def ensure_fonts():
    d = HERE / "fonts"
    d.mkdir(exist_ok=True)
    for name, url in FONTS.items():
        if not (d / name).exists():
            print(f"  downloading font {name}")
            try:
                urllib.request.urlretrieve(url, d / name)
            except Exception as e:  # subtitles still render with a system font
                print(f"  could not download {name}: {e}")


# ---------------------------------------------------------------- voice
async def edge_voice(text, cfg, out):
    import edge_tts
    await edge_tts.Communicate(text, cfg["voice"], rate=cfg["rate"], pitch=cfg["pitch"]).save(str(out))


def make_voice(shot, voices, engine, work):
    if not shot.get("te") or shot.get("speaker", "none") == "none":
        return None
    own = find("voice", shot["id"], (".mp3", ".wav", ".m4a"))
    if own:
        return own
    out = work / f"voice_{shot['id']}.mp3"
    if out.exists():
        return out
    cfg = voices[shot["speaker"]]
    if engine == "edge":
        try:
            asyncio.run(edge_voice(shot["te"], cfg, out))
            return out
        except Exception as e:
            print(f"  edge-tts failed for shot {shot['id']} ({e}); trying espeak-ng")
    if engine in ("edge", "espeak") and shutil.which("espeak-ng"):
        wav = work / f"voice_{shot['id']}.wav"
        pitch = {"narrator": "55", "krishna": "35", "arjuna": "50"}[shot["speaker"]]
        run(["espeak-ng", "-v", "te", "-s", "135", "-p", pitch, "-w", str(wav), shot["te"]])
        run(["ffmpeg", "-y", "-i", str(wav), str(out)])
        return out
    return None


# ---------------------------------------------------------------- video
def motion_filter(motion, frames, w, h):
    n = max(frames - 1, 1)
    cx, cy = "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)"
    z, x, y = {
        "push-in":   (f"1+0.14*on/{n}", cx, cy),
        "pull-out":  (f"1.14-0.14*on/{n}", cx, cy),
        "pan-left":  ("1.12", f"(iw-iw/zoom)*(1-on/{n})", cy),
        "pan-right": ("1.12", f"(iw-iw/zoom)*on/{n}", cy),
        "static":    ("1.02", cx, cy),
    }.get(motion, (f"1+0.14*on/{n}", cx, cy))
    # Upscale first so the zoompan's integer crop steps are too small to see.
    return (f"scale={w*2}:{h*2}:force_original_aspect_ratio=increase,crop={w*2}:{h*2},"
            f"zoompan=z='{z}':x='{x}':y='{y}':d={frames}:s={w}x{h}:fps={FPS}")


def finish_chain(look, dur, w, h):
    bar = round((h - w / 2.39) / 2)          # 2.39:1 cinema letterbox
    fade = min(0.5, dur / 4)
    return (f"{GRADES[look]},vignette=PI/4.6,noise=alls=6:allf=t,"
            f"drawbox=x=0:y=0:w=iw:h={bar}:color=black:t=fill,"
            f"drawbox=x=0:y=ih-{bar}:w=iw:h={bar}:color=black:t=fill,"
            f"fade=t=in:st=0:d={fade:.2f},fade=t=out:st={dur - fade:.2f}:d={fade:.2f},format=yuv420p")


def render_segment(shot, look, dur, out, w, h, preset):
    frames = round(dur * FPS)
    asset = find("assets", shot["id"], VIDEO_EXT + IMAGE_EXT)
    enc = ["-c:v", "libx264", "-preset", preset, "-crf", "20", "-an", "-r", str(FPS), "-frames:v", str(frames), str(out)]
    tail = finish_chain(look, dur, w, h)
    if asset and asset.suffix.lower() in VIDEO_EXT:
        clip = duration(asset)
        if clip >= dur:
            src, speed = ["-i", str(asset)], "setpts=PTS-STARTPTS"
        elif clip * 2.2 >= dur:          # stretch into slow motion, which reads as cinematic
            src, speed = ["-i", str(asset)], f"setpts={dur / clip:.4f}*(PTS-STARTPTS)"
        else:
            src, speed = ["-stream_loop", "-1", "-i", str(asset)], "setpts=PTS-STARTPTS"
        vf = (f"{speed},fps={FPS},scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},{tail}")
        run(["ffmpeg", "-y", *src, "-vf", vf, *enc])
    elif asset:
        vf = motion_filter(shot.get("motion", "push-in"), frames, w, h)
        if shot["type"] == "card":         # darken card backgrounds so the title reads
            vf += ",eq=brightness=-0.18:saturation=0.8,gblur=sigma=2"
        run(["ffmpeg", "-y", "-i", str(asset), "-vf", f"{vf},{tail}", *enc])
    else:
        # No asset yet: graded backdrop; a small label reminds you which file to add.
        label = "" if shot["type"] == "card" else (
            f",drawtext=text='add assets/shot_{shot['id']}':fontcolor=white@0.35:fontsize={h // 30}:x=w*0.04:y=h*0.16")
        run(["ffmpeg", "-y", "-f", "lavfi", "-i", f"color=c={CARD_BG[look]}:s={w}x{h}:d={dur}:r={FPS}",
             "-vf", f"vignette=PI/3.5{label},{tail}", *enc])


# ---------------------------------------------------------------- subtitles
def ts(t):
    cs = round(t * 100)
    return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


def ass_header(w, h):
    s = h / 1080
    bar = round((h - w / 2.39) / 2)
    st = lambda name, font, size, colour, align, mv, outline=2, spacing=0: (
        f"Style: {name},{font},{round(size * s)},{colour},&H000000FF,&H00000000,&H80000000,"
        f"0,0,0,0,100,100,{spacing},0,1,{outline * s:.1f},0,{align},60,60,{round(mv * s)},1")
    return "\n".join([
        "[Script Info]", "ScriptType: v4.00+", f"PlayResX: {w}", f"PlayResY: {h}", "WrapStyle: 0", "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, "
        "Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        st("Te", "Noto Sans Telugu", 40, "&H00FFFFFF", 2, bar / s - 62, 2),
        st("En", "Cinzel", 24, "&H00C8D2DC", 2, bar / s - 100, 1, 1),
        st("Shloka", "Ramaraja", 54, "&H004CB4E9", 8, bar / s + 26, 2),
        st("Title", "Ramaraja", 150, "&H004CB4E9", 5, 0, 3),
        st("TitleEn", "Cinzel", 34, "&H00DCE4EC", 2, h / s / 2 - 130, 1, 4),
        "", "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ])


def ass_events(shot, start, dur, voice_start, voice_dur):
    ev = []
    end = start + dur
    add = lambda style, a, b, text: ev.append(f"Dialogue: 0,{ts(a)},{ts(b)},{style},,0,0,0,,{text}")
    if shot["type"] == "card" and shot.get("title"):
        add("Title", start + 0.3, end - 0.2, r"{\fad(700,500)\blur6\t(0,900,\blur0)\fscx118\fscy118\t(0,1400,0.5,\fscx100\fscy100)}" + shot["title"])
        if shot.get("title_en"):
            add("TitleEn", start + 1.0, end - 0.2, r"{\fad(800,500)}" + shot["title_en"])
    elif shot.get("shloka"):
        add("Shloka", start + 0.4, end - 0.3, r"{\fad(900,600)}" + shot["shloka"])
    if shot.get("te") and voice_dur and shot["type"] != "card":
        a, b = start + voice_start, min(end - 0.2, start + voice_start + voice_dur + 0.4)
        add("Te", a, b, r"{\fad(200,200)}" + shot["te"])
        if shot.get("en"):
            add("En", a, b, r"{\fad(200,200)}" + shot["en"])
    return ev


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--preview", action="store_true", help="fast 960x540 draft")
    ap.add_argument("--only", help="build one scene id: title, s1, s2, s3, s4, s5, finale")
    ap.add_argument("--voice", choices=["edge", "espeak", "none"], default="edge", help="voice engine (default edge)")
    ap.add_argument("--out", default="output/karma_yoga_movie.mp4")
    args = ap.parse_args()

    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg not found. Install it from https://ffmpeg.org/download.html and try again.")
    if args.voice == "edge":
        try:
            import edge_tts  # noqa: F401
        except ImportError:
            sys.exit("edge-tts not installed. Run:  pip install edge-tts   (or use --voice espeak / --voice none)")

    w, h = (960, 540) if args.preview else (1920, 1080)
    preset = "ultrafast" if args.preview else "medium"
    data = json.loads((HERE / "shots.json").read_text(encoding="utf-8"))
    work = HERE / "build"
    (work / "seg").mkdir(parents=True, exist_ok=True)
    ensure_fonts()

    scenes = [s for s in data["scenes"] if not args.only or s["id"] == args.only]
    if not scenes:
        sys.exit(f"No scene called {args.only!r}")

    t, segs, voices, events = 0.0, [], [], []
    voice_start = 0.6
    for scene in scenes:
        print(f"Scene {scene['name']}")
        for shot in scene["shots"]:
            v = make_voice(shot, data["voices"], args.voice, work)
            vd = duration(v) if v else 0.0
            dur = round(max(shot.get("min", 5), voice_start + vd + 1.1 if vd else 0), 2)
            seg = work / "seg" / f"{shot['id']}_{w}.mp4"
            print(f"  shot {shot['id']}  {dur:5.1f}s  {'asset' if find('assets', shot['id'], VIDEO_EXT + IMAGE_EXT) else 'no asset'}")
            render_segment(shot, scene["look"], dur, seg, w, h, preset)
            segs.append(seg)
            if v:
                voices.append((v, t + voice_start))
            events += ass_events(shot, t, dur, voice_start, vd)
            t += dur

    print(f"Total running time {int(t // 60)}m {t % 60:.0f}s. Mixing...")
    (work / "segments.txt").write_text("".join(f"file 'seg/{s.name}'\n" for s in segs), encoding="utf-8")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", "segments.txt",
                    "-c", "copy", "video.mp4"], cwd=work, check=True)

    # Music bed: your track from music/, or a generated tanpura-style drone. Ducked under the voice.
    music = sorted((HERE / "music").glob("*.mp3")) if (HERE / "music").exists() else []
    if music:
        m_in = ["-stream_loop", "-1", "-i", str(music[0])]
        m_chain = "volume=0.5"
    else:
        expr = ("0.07*sin(2*PI*110*t)*(0.6+0.4*sin(2*PI*0.07*t))+0.05*sin(2*PI*164.8*t)*(0.6+0.4*sin(2*PI*0.05*t+1))"
                "+0.04*sin(2*PI*220*t)*(0.7+0.3*sin(2*PI*0.11*t))+0.05*sin(2*PI*55*t)")
        m_in = ["-f", "lavfi", "-i", f"aevalsrc='{expr}':s=44100:d={t:.2f}"]
        m_chain = "lowpass=f=1200,aecho=0.8:0.7:120|240:0.3|0.2,volume=0.9"
    inputs, parts = [*m_in], []
    for i, (v, start) in enumerate(voices, 1):
        inputs += ["-i", str(v)]
        parts.append(f"[{i}:a]aresample=44100,aformat=channel_layouts=stereo,adelay={int(start * 1000)}:all=1[v{i}]")
    fc = [f"[0:a]atrim=0:{t:.2f},aformat=channel_layouts=stereo,{m_chain},afade=t=in:d=3,afade=t=out:st={max(t - 4, 0):.2f}:d=4[m]"]
    if voices:
        fc += parts
        fc.append("".join(f"[v{i}]" for i in range(1, len(voices) + 1)) + f"amix=inputs={len(voices)}:normalize=0,apad=whole_dur={t:.2f}[voc]")
        fc.append("[voc]asplit[voc1][voc2]")
        fc.append("[m][voc1]sidechaincompress=threshold=0.02:ratio=6:attack=30:release=600[duck]")
        fc.append("[duck][voc2]amix=inputs=2:normalize=0,alimiter=limit=0.95[out]")
    else:
        fc.append("[m]anull[out]")
    run(["ffmpeg", "-y", *inputs, "-filter_complex", ";".join(fc), "-map", "[out]", "-t", f"{t:.2f}",
         "-c:a", "aac", "-b:a", "192k", str(work / "audio.m4a")])

    (work / "movie.ass").write_text(ass_header(w, h) + "\n" + "\n".join(events) + "\n", encoding="utf-8")
    out = (HERE / args.out).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    print("Burning in subtitles and titles...")
    r = subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", "video.mp4", "-i", "audio.m4a",
                        "-vf", "ass=movie.ass:fontsdir=../fonts:shaping=complex", "-c:v", "libx264", "-preset", preset,
                        "-crf", "19", "-pix_fmt", "yuv420p", "-c:a", "copy", "-shortest", "-movflags", "+faststart",
                        str(out)], cwd=work)
    if r.returncode != 0:
        sys.exit("Final render failed (see the ffmpeg error above).")
    print(f"Done: {out}")


if __name__ == "__main__":
    main()
