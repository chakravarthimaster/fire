#!/usr/bin/env bash
# Encode build/frames + build/mix.wav into the final MP4, with embedded
# subtitles and chapter markers, and export a poster frame.
set -euo pipefail
cd "$(dirname "$0")/.."
FFMPEG="${FFMPEG:-$(python3 -c 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())')}"
OUT="${OUT:-output/the-thinking-machine.mp4}"
mkdir -p "$(dirname "$OUT")"

# Exact picture length; the audio and subtitle streams are trimmed to it.
FRAMES=$(ls build/frames | grep -c '\.jpg$')
DUR=$(python3 -c "print(f'{$FRAMES / 30:.3f}')")
# Two-pass VBR keeps the 1080p file under GitHub's 100 MB limit while giving
# the busy scenes the bits they need.
VBITRATE="${VBITRATE:-1800k}"
ABITRATE="${ABITRATE:-160k}"
# Optional downscale for a smaller copy, e.g. SCALE=1280:720
VF=()
[ -n "${SCALE:-}" ] && VF=(-vf "scale=${SCALE}:flags=lanczos")
enc() {
  "$FFMPEG" -hide_banner -loglevel warning -stats -y \
    -framerate 30 -i build/frames/f%05d.jpg \
    -i build/mix.wav \
    -i build/subtitles.srt \
    -i build/chapters.txt \
    -map 0:v -map 1:a -map 2:s -map_metadata 3 -map_chapters 3 -t "$DUR" \
    "${VF[@]}" -c:v libx264 -preset slow -tune film -profile:v high -pix_fmt yuv420p \
    -b:v "$VBITRATE" -maxrate 7M -bufsize 14M -g 60 -bf 3 \
    -passlogfile build/x264pass "$@"
}
enc -pass 1 -an -sn -f mp4 /dev/null
enc -pass 2 -movflags +faststart \
  -c:a aac -b:a "$ABITRATE" -ar 48000 \
  -c:s mov_text -metadata:s:s:0 language=eng \
  -metadata title="The Thinking Machine — A History of Artificial Intelligence" \
  -metadata comment="Pictures, music and narration generated entirely from code." \
  "$OUT"
cp build/subtitles.srt "${OUT%.mp4}.srt"

# Poster: the title card, just after it locks in.
[ "${POSTER:-1}" = 1 ] && "$FFMPEG" -hide_banner -loglevel error -y -ss 21.6 -i "$OUT" -frames:v 1 -q:v 3 "$(dirname "$OUT")/poster.jpg"
echo "wrote $OUT"
