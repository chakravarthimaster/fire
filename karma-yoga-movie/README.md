# కర్మ యోగము · Karma Yogam: The Movie

A 10-minute Telugu film on Bhagavad Gita Chapter 3, made with free tools only.

| File | What it is |
|---|---|
| `production-kit.html` | Open in a browser. All 60 shots with copy-ready Google Flow prompts, file names, narration and a checklist. |
| `shots.json` | The screenplay: every shot, its Telugu narration, English subtitle, śloka and visual. Edit lines here. |
| `build_movie.py` | Builds the finished movie from your Flow images and clips. |

## Steps

1. **Make the visuals in Google Flow** (labs.google/flow, 16:9). Copy each shot's prompt from `production-kit.html`.
   Make the Krishna and Arjuna portraits first and use them as references so the faces stay the same.
   If your free Flow credits run out, make *video* shots as images instead; the script animates stills with slow camera moves.
2. **Save each result into `assets/`** as `shot_01.png`, `shot_02.mp4`, … (png, jpg, webp, mp4, mov or webm all work).
3. **Install the free tools:** Python 3, [ffmpeg](https://ffmpeg.org/download.html), then `pip install edge-tts`.
4. **Build:**
   ```
   python build_movie.py --preview   # fast 540p draft
   python build_movie.py             # final 1080p -> output/karma_yoga_movie.mp4
   python build_movie.py --only s3   # one scene: title, s1, s2, s3, s4, s5, finale
   ```

The script adds:
- Telugu neural voices: Krishna and Arjuna use `te-IN-MohanNeural` at different pitches, and the narrator uses `te-IN-ShrutiNeural`.
- Per-scene colour grading, a 2.39:1 letterbox, vignette and film grain.
- Slow push, pull and pan camera moves on still images, and slow-motion stretching on short clips.
- Telugu and English subtitles, gold title cards and śloka captions.
- A tanpura-style drone that ducks under the voice.

Shots without a file yet show a dark placeholder, so you can build drafts as you go.

**Optional**

- **Your own voice:** save a recording as `voice/shot_04.mp3` and it replaces the AI voice for that shot.
- **Your own music:** put any royalty-free `.mp3` in `music/`, for example from YouTube Audio Library or Pixabay Music.
- **No internet for the voices:** use `--voice espeak` (robotic, offline) or `--voice none`.

With the AI voices the running time is about 10 minutes. It follows the length of the narration.
