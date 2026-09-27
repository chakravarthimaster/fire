#!/usr/bin/env bash
# Download the Kokoro-82M text-to-speech model used for the narration
# (Apache-2.0, https://github.com/thewh1teagle/kokoro-onnx).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p models
base=https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0
for f in kokoro-v1.0.onnx voices-v1.0.bin; do
  [ -s "models/$f" ] || curl -fL -o "models/$f" "$base/$f"
done
ls -la models
