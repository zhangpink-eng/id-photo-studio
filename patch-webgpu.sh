#!/bin/bash
set -e
cd "$(dirname "$0")"
echo "📦 本地化 onnxruntime-web ..."

ONNX="node_modules/onnxruntime-web/dist"
PUBLIC_WASM="public/onnxruntime"

# ==========================
# 1. 复制 WASM 到 public 目录
# ==========================
echo ""
echo "  1/3 复制 WASM 运行时文件..."
mkdir -p "$PUBLIC_WASM"

for f in ort-wasm-simd-threaded.wasm ort-wasm-simd-threaded.jsep.wasm ort-wasm-simd-threaded.mjs ort-wasm-simd-threaded.jsep.mjs; do
  if [ -f "$ONNX/$f" ]; then
    cp "$ONNX/$f" "$PUBLIC_WASM/$f"
    echo "    ✅ $f ($(du -h "$ONNX/$f" | cut -f1))"
  fi
done

# 占位文件（postinstall 脚本每次会覆盖，不提交到 git）

# ==========================
# 2. 修复 .mjs → .js
# ==========================
echo ""
echo "  2/3 修复 .mjs 兼容性..."

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
    echo "    ✅ $MJS"
  fi
done

if [ -f "$ONNX/ort.node.min.mjs" ]; then
  echo 'export default null;' > "$ONNX/ort.node.min.mjs"
  echo "    ✅ ort.node.min.mjs (stub)"
fi

# ==========================
# 3. 清理 WebGPU 导入
# ==========================
echo ""
echo "  3/3 清理无用 WebGPU 代码..."

IMGLY="node_modules/@imgly/background-removal/dist/index.mjs"
if [ -f "$IMGLY" ]; then
  sed -i '' 's|ort = (await import("onnxruntime-web/webgpu")).default;|ort = null;|' "$IMGLY"
  echo "    ✅ 移除 WebGPU 导入"
fi

echo ""
echo "✅ 全部完成！"
echo ""
echo "📋 WASM 文件已复制到 public/onnxruntime/:"
ls -lh "$PUBLIC_WASM"/* 2>/dev/null | grep -v "^total" | grep -v "^d" || echo "(无)"
