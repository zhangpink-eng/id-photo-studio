#!/bin/bash
# download-models.sh
#
# 从 CDN 下载 @imgly/background-removal 所需的 AI 模型文件到本地缓存，
# 配合 patch-webgpu.sh 实现完全离线部署。
#
# 用法：
#   MODEL_CACHE_DIR=/path/to/cache ./download-models.sh          # 指定缓存目录
#   ./download-models.sh                                          # 默认 /Volumes/PSSD/model-cache
#   ./download-models.sh --model isnet_fp16                       # 下载 fp16 模型（84MB）
#   ./download-models.sh --model isnet_quint8                     # 下载量化模型（42MB，默认）
#   ./download-models.sh --all                                    # 下载所有模型（327MB）
#
# 环境变量：
#   MODEL_CACHE_DIR  缓存目录（默认 /Volumes/PSSD/model-cache）
#   MODEL_VERSION    模型版本（默认 1.7.0，与 npm 包一致）

set -euo pipefail

# === 配置 ===
CACHE_DIR="${MODEL_CACHE_DIR:-/Volumes/PSSD/model-cache}"
MODEL_VERSION="${MODEL_VERSION:-1.7.0}"
CDN_BASE="https://staticimgly.com/@imgly/background-removal-data/${MODEL_VERSION}/dist"
TARGET_MODEL="isnet_quint8"    # 默认最小模型（42MB）
DOWNLOAD_ALL=false

# 解析参数
while [[ $# -gt 0 ]]; do
  case "$1" in
    --model) TARGET_MODEL="$2"; shift 2 ;;
    --all)   DOWNLOAD_ALL=true; shift ;;
    *)       echo "未知参数: $1"; exit 1 ;;
  esac
done

# ==========================
# 第一步：下载 resources.json
# ==========================
echo "📦 下载模型文件到缓存目录: $CACHE_DIR"
echo "   CDN: $CDN_BASE"
mkdir -p "$CACHE_DIR"

echo ""
echo "  1/4 下载 resources.json..."
RESOURCE_JSON="$CACHE_DIR/resources.json"
if curl -sfL "${CDN_BASE}/resources.json" -o "$RESOURCE_JSON"; then
  echo "    ✅ resources.json ($(wc -c < "$RESOURCE_JSON") bytes)"
else
  echo "    ❌ 下载失败，请检查网络连接"
  exit 1
fi

# ==========================
# 第二步：解析需要下载的文件
# ==========================
echo ""
echo "  2/4 分析需要下载的模型文件..."

if $DOWNLOAD_ALL; then
  # 下载所有模型 + WASM
  FILTER_PATTERN='.'
  echo "    模式: 全部下载 (7 个资源)"
else
  # 只下载指定模型
  FILTER_PATTERN="/models/${TARGET_MODEL}"
  echo "    模式: 仅下载 ${TARGET_MODEL}"
fi

# 用 node 解析 resources.json，提取需要下载的 chunk 列表
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('$RESOURCE_JSON', 'utf-8'));

const pattern = '$FILTER_PATTERN';
const all = $DOWNLOAD_ALL;

const neededKeys = all
  ? Object.keys(data)
  : Object.keys(data).filter(k => k.match(pattern));

const allChunks = new Map();
let totalSize = 0;

neededKeys.forEach(key => {
  const entry = data[key];
  console.log('   📄 ' + key + ' (' + (entry.size/1024/1024).toFixed(1) + ' MB)');
  entry.chunks.forEach(c => {
    if (!allChunks.has(c.name)) {
      allChunks.set(c.name, {name: c.name, size: c.offsets[1] - c.offsets[0]});
      totalSize += c.offsets[1] - c.offsets[0];
    }
  });
});

// 输出 chunk 文件列表供后续下载
const list = [...allChunks.values()];
console.log('\n    需要下载 ' + list.length + ' 个 chunk, 共 ' + (totalSize/1024/1024).toFixed(1) + ' MB');

// 保存清单供 bash 读取
fs.writeFileSync('$CACHE_DIR/.chunk_list.json', JSON.stringify(list));

// 同时保存过滤后的 resources.json（只保留模型条目）
if (!all) {
  const filtered = {};
  neededKeys.forEach(k => { filtered[k] = data[k]; });
  fs.writeFileSync('$CACHE_DIR/resources.json', JSON.stringify(filtered, null, 2));
  console.log('\n    已生成过滤版 resources.json (仅保留模型条目)');
}
" 2>&1 || { echo "    ❌ 分析失败"; exit 1; }

# ==========================
# 第三步：下载 chunk 文件
# ==========================
echo ""
echo "  3/4 下载 chunk 文件..."

CHUNKS=$(node -e "const d=require('$CACHE_DIR/.chunk_list.json');d.forEach(c=>console.log(c.name))")
TOTAL=$(echo "$CHUNKS" | wc -l | tr -d ' ')
COUNT=0

echo "$CHUNKS" | while read -r HASH; do
  if [ -z "$HASH" ]; then continue; fi
  TARGET="$CACHE_DIR/$HASH"
  if [ -f "$TARGET" ] && [ -s "$TARGET" ]; then
    # 已存在，跳过
    COUNT=$((COUNT + 1))
  else
    COUNT=$((COUNT + 1))
    echo -ne "    [${COUNT}/${TOTAL}] 下载 $HASH...\r"
    curl -sfL "${CDN_BASE}/${HASH}" -o "$TARGET" || {
      echo -e "\n    ❌ chunk $HASH 下载失败"
      exit 1
    }
  fi
done

echo -e "\n    ✅ $TOTAL 个 chunk 下载完成"

# ==========================
# 第四步：验证完整性
# ==========================
echo ""
echo "  4/4 验证完整性..."

node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('$CACHE_DIR/resources.json', 'utf-8'));
const cacheDir = '$CACHE_DIR';
let allOk = true;

Object.entries(data).forEach(([key, entry]) => {
  entry.chunks.forEach(c => {
    const path = cacheDir + '/' + c.name;
    if (!fs.existsSync(path)) {
      console.log('    ❌ 缺失: ' + c.name);
      allOk = false;
    }
  });
});

if (allOk) {
  console.log('    ✅ 所有 chunk 文件完整');
} else {
  console.log('    ❌ 部分 chunk 文件缺失，请重新运行');
  process.exit(1);
}
"

rm -f "$CACHE_DIR/.chunk_list.json"

echo ""
echo "✅ 模型文件下载完成！"
echo ""
echo "📋 缓存目录: $CACHE_DIR"
echo "   大小: $(du -sh "$CACHE_DIR" | cut -f1)（不含 resources.json 外的文件）"
echo ""
echo "💡 运行 npm run patch 将模型部署到项目中"
