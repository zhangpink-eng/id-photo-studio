#!/bin/bash
set -e
cd "$(dirname "$0")"

QUIET=false
[[ "$1" == "--quiet" || "$1" == "-q" ]] && QUIET=true
quiet_echo() { $QUIET || echo "$@"; }

quiet_echo "📦 本地化 onnxruntime-web ..."

ONNX="node_modules/onnxruntime-web/dist"
PUBLIC_WASM="public/onnxruntime"
PUBLIC_MODELS="public/models"
IMGLY="node_modules/@imgly/background-removal/dist/index.mjs"

# ==========================
# 1. WASM 文件 → public/
# ==========================
quiet_echo ""
quiet_echo "  1/3 WASM 运行时文件 → public/ ..."
mkdir -p "$PUBLIC_WASM"

for f in ort-wasm-simd-threaded.wasm ort-wasm-simd-threaded.jsep.wasm ort-wasm-simd-threaded.mjs ort-wasm-simd-threaded.jsep.mjs; do
  if [ -f "$ONNX/$f" ]; then
    cp "$ONNX/$f" "$PUBLIC_WASM/$f"
    quiet_echo "    ✅ $f ($(du -h "$ONNX/$f" | cut -f1))"
  fi
done

quiet_echo ""
quiet_echo "  2/3 AI 模型文件 → public/models/ ..."

CACHE_DIR="${MODEL_CACHE_DIR:-/Volumes/PSSD/model-cache}"
mkdir -p "$PUBLIC_MODELS"

if [ -f "$CACHE_DIR/resources.json" ]; then
  # 从缓存复制模型文件
  quiet_echo "    缓存目录: $CACHE_DIR"

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
      quiet_echo "    ⚠️  缓存中缺少: $hash（将在首次使用时从 CDN 下载）"
    fi
  done
  quiet_echo "    ✅ $COPIED 个 chunk 文件就绪"
else
  quiet_echo "    ⚠️  模型缓存未找到，使用 CDN 回退"
  quiet_echo "       提示: 运行 \`npm run download-models\` 下载模型到本地"
  quiet_echo "       或设置 MODEL_CACHE_DIR 环境变量"
  # 模型不在本地时，删掉 resources.json（避免空文件导致加载失败）
  rm -f "$PUBLIC_MODELS/resources.json"
fi

# ==========================
# 3. .mjs 文件 ESM 兼容性修复
# ==========================
quiet_echo ""
quiet_echo "  3/3 .mjs 文件兼容性修复..."

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

  # 跨平台：用 node 替换（兼容 macOS 和 Linux）
  node -e "
const fs = require('fs');
const path = '$MJS_PATH';
const varName = '$VAR';
let content = fs.readFileSync(path, 'utf-8');
content = content.replace(
  new RegExp('typeof exports==\"object\"&&typeof module==\"object\"&&\\(module\\.exports=' + varName + '\\)', 'g'),
  'export default ' + varName
);
fs.writeFileSync(path, content);
" 2>/dev/null || true
  quiet_echo "    ✅ $MJS → export default $VAR"
done

if [ -f "$ONNX/ort.node.min.mjs" ]; then
  echo 'export default null;' > "$ONNX/ort.node.min.mjs"
  quiet_echo "    ✅ ort.node.min.mjs → stub"
fi

# ==========================
# 4. 清理无用 WebGPU 导入
# ==========================
if [ -f "$IMGLY" ]; then
  quiet_echo "    运行 python 脚本修改 imgly 代码..."

  python3 << 'PYFIX'
import re
import os

IMGLY = "node_modules/@imgly/background-removal/dist/index.mjs"

with open(IMGLY, 'r') as f:
    content = f.read()

changed = False

# 1. 移除无用 WebGPU 导入
content = content.replace(
    'ort = (await import("onnxruntime-web/webgpu")).default;',
    'ort = null;'
)
changed = True

# 2. 移除前面失败的 patch 产生的重复行（保证幂等性）
WASMPATHS_LINE = 'ort2.env.wasm.wasmPaths = window.__WASM_PATH || "/onnxruntime/";'
content = re.sub(rf'{re.escape(WASMPATHS_LINE)}\s*', '', content)

# 3. 替换 WASM 的 CDN 加载块为本地路径
#    原始块（两种打包版本）：
#      const wasmPath = await loadAsUrl(`${baseFilePath}.wasm`, config);
#      const mjsPath = await loadAsUrl(`${baseFilePath}.mjs`, config);
#      ort2.env.wasm.wasmPaths = { mjs: mjsPath, wasm: wasmPath };
#    替换为：
#      ort2.env.wasm.wasmPaths = window.__WASM_PATH || "/onnxruntime/";
OLD_BLOCKS = [
    r"""const wasmPath = await loadAsUrl(`${baseFilePath}.wasm`, config);
  const mjsPath = await loadAsUrl(`${baseFilePath}.mjs`, config);
  ort2.env.wasm.wasmPaths = {
    mjs: mjsPath,
    wasm: wasmPath
  };""",
    r"""const wasmPath = await loadAsUrl(`${baseFilePath}.wasm`, config);
  const mjsPath = await loadAsUrl(`${baseFilePath}.mjs`, config);
  ort2.env.wasm.wasmPaths = { mjs: mjsPath, wasm: wasmPath };""",
]

found_block = False
for block in OLD_BLOCKS:
    if block in content:
        content = content.replace(block, WASMPATHS_LINE)
        found_block = True
        print("    ✅ WASM 加载块替换成功")
        break

if not found_block:
    # 检查 wasmPaths 是否需要在其他地方
    if WASMPATHS_LINE not in content:
        # 在 baseFilePath 之后、if (config.debug) 之前插入
        insert_after = "const baseFilePath ="
        idx = content.find(insert_after)
        if idx > 0:
            line_end = content.find('\n', idx)
            rest = content[line_end + 1:]
            # 如果下一行不是我们的 wasmPaths，插入
            if not rest.lstrip().startswith('ort2.env.wasm.wasmPaths'):
                content = content[:line_end + 1] + '  ' + WASMPATHS_LINE + '\n' + rest
                found_block = True
                print("    ✅ 已插入 wasmPaths 本地路径")
        if not found_block:
            print("    ⚠️ 无法插入 wasmPaths，WASM 可能从 CDN 加载")

with open(IMGLY, 'w') as f:
    f.write(content)

print("    ✅ @imgly: WASM 本地路径 + 移除 WebGPU")
PYFIX

  quiet_echo "    ✅ @imgly 代码修改完成"
fi

quiet_echo ""
quiet_echo "✅ 全部完成！"
quiet_echo ""
quiet_echo "📋 部署清单:"
quiet_echo "   WASM: public/onnxruntime/ ($(ls -1 $PUBLIC_WASM/*.wasm 2>/dev/null | wc -l | tr -d ' ') 个 wasm 文件)"
if [ -f "$PUBLIC_MODELS/resources.json" ]; then
  quiet_echo "   模型: public/models/ ($(node -e "const d=require('fs').readFileSync('$PUBLIC_MODELS/resources.json','utf-8');console.log(Object.keys(JSON.parse(d)).length+' 个资源')") )"
else
  quiet_echo "   模型: 未本地化（将使用 CDN）"
fi
