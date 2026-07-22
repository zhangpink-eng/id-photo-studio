#!/bin/bash
set -e
cd "$(dirname "$0")"
echo "📦 本地化 onnxruntime-web ..."

ONNX="node_modules/onnxruntime-web/dist"
PUBLIC_WASM="public/onnxruntime"
PUBLIC_MODELS="public/models"
IMGLY="node_modules/@imgly/background-removal/dist/index.mjs"

# ==========================
# 1. WASM 文件 → public/
# ==========================
echo ""
echo "  1/3 WASM 运行时文件 → public/ ..."
mkdir -p "$PUBLIC_WASM"

for f in ort-wasm-simd-threaded.wasm ort-wasm-simd-threaded.jsep.wasm ort-wasm-simd-threaded.mjs ort-wasm-simd-threaded.jsep.mjs; do
  if [ -f "$ONNX/$f" ]; then
    cp "$ONNX/$f" "$PUBLIC_WASM/$f"
    echo "    ✅ $f ($(du -h "$ONNX/$f" | cut -f1))"
  fi
done

# ==========================
# 2. AI 模型文件 → public/models/
# ==========================
echo ""
echo "  2/3 AI 模型文件 → public/models/ ..."

CACHE_DIR="${MODEL_CACHE_DIR:-/Volumes/PSSD/model-cache}"
mkdir -p "$PUBLIC_MODELS"

if [ -f "$CACHE_DIR/resources.json" ]; then
  # 从缓存复制模型文件
  echo "    缓存目录: $CACHE_DIR"

  # 复制 resources.json
  cp "$CACHE_DIR/resources.json" "$PUBLIC_MODELS/resources.json"

  # 解析并复制所有引用的 chunk 文件
  COPIED=0
  for hash in $(node -e "
    const fs=require('fs');
    const d=JSON.parse(fs.readFileSync('$PUBLIC_MODELS/resources.json','utf-8'));
    const seen=new Set();
    Object.values(d).forEach(e=>e.chunks.forEach(c=>{if(!seen.has(c.name)){seen.add(c.name);console.log(c.name)}}));
  "); do
    src="$CACHE_DIR/$hash"
    dst="$PUBLIC_MODELS/$hash"
    if [ -f "$src" ]; then
      # 只复制不存在的或不同大小的
      if [ ! -f "$dst" ] || [ "$(stat -f%z "$src")" != "$(stat -f%z "$dst" 2>/dev/null || echo 0)" ]; then
        cp "$src" "$dst"
      fi
      COPIED=$((COPIED + 1))
    else
      echo "    ⚠️  缓存中缺少: $hash（将在首次使用时从 CDN 下载）"
    fi
  done
  echo "    ✅ $COPIED 个 chunk 文件就绪"
else
  echo "    ⚠️  模型缓存未找到，使用 CDN 回退"
  echo "       提示: 运行 \`npm run download-models\` 下载模型到本地"
  echo "       或设置 MODEL_CACHE_DIR 环境变量"
  # 模型不在本地时，删掉 resources.json（避免空文件导致加载失败）
  rm -f "$PUBLIC_MODELS/resources.json"
fi

# ==========================
# 3. .mjs 文件 ESM 兼容性修复
# ==========================
echo ""
echo "  3/3 .mjs 文件兼容性修复..."

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
  JS_PATH="$ONNX/$JS"
  MJS_PATH="$ONNX/$MJS"
  if [ ! -f "$JS_PATH" ] || [ ! -f "$MJS_PATH" ]; then continue; fi
  cp "$JS_PATH" "$MJS_PATH"
  VAR="ort"
  sed -i '' "s|typeof exports==\"object\"&&typeof module==\"object\"&&(module\.exports=$VAR)|export default $VAR|" "$MJS_PATH"
  echo "    ✅ $MJS → export default $VAR"
done

if [ -f "$ONNX/ort.node.min.mjs" ]; then
  echo 'export default null;' > "$ONNX/ort.node.min.mjs"
  echo "    ✅ ort.node.min.mjs → stub"
fi

# ==========================
# 4. 清理无用 WebGPU 导入
# ==========================
if [ -f "$IMGLY" ]; then
  sed -i '' 's|ort = (await import("onnxruntime-web/webgpu")).default;|ort = null;|' "$IMGLY"
  echo "    ✅ @imgly: 移除无用 WebGPU 导入"
fi

echo ""
echo "✅ 全部完成！"
echo ""
echo "📋 部署清单:"
echo "   WASM: public/onnxruntime/ ($(ls -1 $PUBLIC_WASM/*.wasm 2>/dev/null | wc -l | tr -d ' ') 个 wasm 文件)"
if [ -f "$PUBLIC_MODELS/resources.json" ]; then
  echo "   模型: public/models/ ($(node -e "const d=require('fs').readFileSync('$PUBLIC_MODELS/resources.json','utf-8');console.log(Object.keys(JSON.parse(d)).length+' 个资源')") )"
else
  echo "   模型: 未本地化（将使用 CDN）"
fi
