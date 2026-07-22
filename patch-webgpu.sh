#!/bin/bash
set -e
cd "$(dirname "$0")"
echo "📦 Patching onnxruntime-web .mjs files..."

ONNX="node_modules/onnxruntime-web/dist"

# File mapping: .mjs → replaced with .js counterpart
declare -A MAP=(
  ["ort.bundle.min.mjs"]="ort.min.js"
  ["ort.webgpu.bundle.min.mjs"]="ort.webgpu.min.js"
  ["ort.webgpu.min.mjs"]="ort.webgpu.min.js"
  ["ort.all.bundle.min.mjs"]="ort.all.min.js"
  ["ort.all.min.mjs"]="ort.all.min.js"
  ["ort.min.mjs"]="ort.min.js"
  ["ort.wasm.bundle.min.mjs"]="ort.wasm.min.js"
  ["ort.wasm.min.mjs"]="ort.wasm.min.js"
  ["ort.webgl.min.mjs"]="ort.webgl.min.js"
)

for MJS in "${!MAP[@]}"; do
  JS="${MAP[$MJS]}"
  if [ -f "$ONNX/$MJS" ] && [ -f "$ONNX/$JS" ]; then
    cp "$ONNX/$JS" "$ONNX/$MJS"
    echo "  ✅ $MJS ← $JS"
  fi
done

if [ -f "$ONNX/ort.node.min.mjs" ]; then
  echo 'export default null;' > "$ONNX/ort.node.min.mjs"
  echo "  ✅ ort.node.min.mjs ← stub (node-only)"
fi

IMGLY="node_modules/@imgly/background-removal/dist/index.mjs"
if [ -f "$IMGLY" ]; then
  sed -i '' 's|ort = (await import("onnxruntime-web/webgpu")).default;|ort = null;|' "$IMGLY"
  echo "  ✅ @imgly: removed unused webgpu import"
fi

echo "✅ Done!"
