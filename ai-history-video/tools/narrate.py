#!/usr/bin/env python3
"""Generate the narrator's voice for every clip in story.json.

Uses Kokoro-82M (ONNX) text-to-speech. Each clip becomes one WAV file in
build/vo/, and build/vo/manifest.json records its duration so the film's
timeline can be laid out around the narration. Clips are cached by a hash of
their text, voice and speed, so editing one line only re-renders that line.
"""
import hashlib
import json
import os
import sys

import numpy as np
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "build", "vo")
MODEL = os.path.join(ROOT, "models", "kokoro-v1.0.onnx")
VOICES = os.path.join(ROOT, "models", "voices-v1.0.bin")

TARGET_RMS_DB = -20.0  # loudness of voiced speech, before the final mix
FADE = 0.012  # seconds of fade at clip edges, to avoid clicks


def rms_db_voiced(x, sr):
    """RMS level of the louder 50 ms windows, i.e. ignoring pauses."""
    win = int(sr * 0.05)
    n = len(x) // win
    if n == 0:
        return -120.0
    frames = x[: n * win].reshape(n, win)
    rms = np.sqrt(np.mean(frames**2, axis=1) + 1e-12)
    voiced = rms[rms > np.max(rms) * 0.1]
    return 20 * np.log10(np.sqrt(np.mean(voiced**2)) + 1e-12)


def trim_silence(x, sr, thresh_db=-50.0, pad=0.03):
    """Trim leading/trailing near-silence, keeping a small pad."""
    env = np.abs(x)
    thresh = 10 ** (thresh_db / 20) * max(np.max(env), 1e-9)
    idx = np.where(env > thresh)[0]
    if len(idx) == 0:
        return x
    a = max(0, idx[0] - int(pad * sr))
    b = min(len(x), idx[-1] + int(pad * sr))
    return x[a:b]


def main():
    story = json.load(open(os.path.join(ROOT, "story.json")))
    voice = story.get("voice", "af_heart")
    speed = float(story.get("speed", 1.0))
    os.makedirs(OUT, exist_ok=True)

    manifest_path = os.path.join(OUT, "manifest.json")
    manifest = {}
    tts = None
    total = 0.0
    words = 0

    for scene in story["scenes"]:
        for clip in scene.get("clips", []):
            say = clip.get("say", clip["text"])
            key = hashlib.sha1(f"{voice}|{speed}|{say}".encode()).hexdigest()[:12]
            name = f"{scene['id']}_{clip['key']}_{key}.wav"
            path = os.path.join(OUT, name)
            if not os.path.exists(path):
                if tts is None:
                    from kokoro_onnx import Kokoro

                    tts = Kokoro(MODEL, VOICES)
                audio, sr = tts.create(say, voice=voice, speed=speed, lang="en-us")
                audio = trim_silence(np.asarray(audio, dtype=np.float64), sr)
                gain = 10 ** ((TARGET_RMS_DB - rms_db_voiced(audio, sr)) / 20)
                audio = audio * gain
                peak = np.max(np.abs(audio))
                if peak > 0.89:  # keep headroom; the mix adds its own limiter
                    audio *= 0.89 / peak
                nf = int(FADE * sr)
                ramp = np.linspace(0, 1, nf)
                audio[:nf] *= ramp
                audio[-nf:] *= ramp[::-1]
                sf.write(path, audio.astype(np.float32), sr, subtype="FLOAT")
                print(f"  voiced {scene['id']}.{clip['key']}: {len(audio) / sr:5.2f}s  {say}")
            info = sf.info(path)
            dur = info.frames / info.samplerate
            manifest.setdefault(scene["id"], {})[clip["key"]] = {
                "file": name,
                "dur": round(dur, 4),
                "text": clip["text"],
            }
            total += dur
            words += len(say.split())

    # Drop stale clips from earlier script revisions.
    keep = {c["file"] for s in manifest.values() for c in s.values()}
    for f in os.listdir(OUT):
        if f.endswith(".wav") and f not in keep:
            os.remove(os.path.join(OUT, f))

    json.dump(manifest, open(manifest_path, "w"), indent=2)
    print(f"narration: {total:.1f}s of speech, {words} words, {60 * words / max(total, 1):.0f} wpm")


if __name__ == "__main__":
    sys.exit(main())
