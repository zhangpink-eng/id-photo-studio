#!/bin/bash
set -e
cd "$(dirname "$0")"
echo "📦 本地化 onnxruntime-web ..."

ONNX="node_modules/onnxruntime-web/dist"
PUBLIC_WASM="public/onnxruntime"
IMGLY="node_modules/@imgly/background-removal/dist/index.mjs"

# ==========================
# 1. WASM → public/
# ==========================
echo ""
echo "  1/3 WASM 文件 → public/ ..."
mkdir -p "$PUBLIC_WASM"

for f in ort-wasm-simd-threaded.wasm ort-wasm-simd-threaded.jsep.wasm ort-wasm-simd-threaded.mjs ort-wasm-simd-threaded.jsep.mjs; do
  if [ -f "$ONNX/$f" ]; then
    cp "$ONNX/$f" "$PUBLIC_WASM/$f"
    echo "    ✅ $f ($(du -h "$ONNX/$f" | cut -f1))"
  fi
done

# ==========================
# 2. .mjs 文件修复
# ==========================
# 核心问题：onnxruntime-web 的 .mjs bundle 在构建时被 Terser 二次压缩
# 报错 'import.meta' cannot be used outside of module code。
# 以前的方案：把 .mjs 文件内容替换成 .js（CJS）版本。
# 但 CJS 用 module.exports=xxx 导出，.mjs 作为 ESM 加载时没有 module，
# 导致导出为空 → 运行时报错。
#
# 正确方案：把 .js 内容复制到 .mjs，然后将 module.exports=VAR 替换为
# export default VAR，确保 ESM 加载时能正确导出。
# ==========================
echo ""
echo "  2/3 .mjs 文件 ESM 兼容性修复 ..."

# 需要转换的 .mjs + 对应的 .js 源
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

  # 1. 复制 CJS .js 内容到 .mjs
  cp "$JS_PATH" "$MJS_PATH"

  # 2. 整个 CJS 导出表达式 → export default VAR
  # 原始：typeof exports=="object"&&typeof module=="object"&&(module.exports=VAR);
  # 替换后：export default VAR;
  # ⚠️ 不能用 s/module.exports=VAR/export default VAR/，因为 export 不能出现在表达式中
  # 所有 onnxruntime .min.js 的最终导出变量都是 ort（经逐文件确认）
  VAR="ort"
  # 匹配整个 typeof...module.exports=VAR 表达式，替换为 export default
  sed -i '' "s|typeof exports==\"object\"&&typeof module==\"object\"&&(module\.exports=$VAR)|export default $VAR|" "$MJS_PATH"
  echo "    ✅ $MJS → export default $VAR"
done

# ort.node.min.mjs — Node.js 专用 → stub
if [ -f "$ONNX/ort.node.min.mjs" ]; then
  echo 'export default null;' > "$ONNX/ort.node.min.mjs"
  echo "    ✅ ort.node.min.mjs → stub"
fi

# ==========================
# 3. 清理 WebGPU 导入
# ==========================
echo ""
echo "  3/3 清理无用 WebGPU 导入..."

if [ -f "$IMGLY" ]; then
  # 替换 WebGPU 的动态引入（设备默认 cpu，此代码从不执行）
  sed -i '' 's|ort = (await import("onnxruntime-web/webgpu")).default;|ort = null;|' "$IMGLY"
  echo "    ✅ 移除 WebGPU 动态导入"
fi

echo ""
echo "✅ 全部完成！"
echo ""
echo "📋 WASM 文件已复制到 public/onnxruntime/:"
ls -lh "$PUBLIC_WASM"/* 2>/dev/null | grep -v "^total" | grep -v "^d" || echo "(无)"
