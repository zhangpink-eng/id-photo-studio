#!/bin/bash
# vercel-download-models.sh
#
# Vercel 构建专用：将 isnet_quint8 模型（42MB）直接下载到 public/models/
#
# 用法：在 vercel-build 脚本中调用
#   bash vercel-download-models.sh

set -euo pipefail

MODEL_VERSION="1.7.0"
CDN_BASE="https://staticimgly.com/@imgly/background-removal-data/${MODEL_VERSION}/dist"
OUTPUT_DIR="public/models"

echo "📦 下载 AI 模型到 ${OUTPUT_DIR} ..."
mkdir -p "$OUTPUT_DIR"

# 1. 下载 resources.json
echo "  1/3 下载 resources.json..."
RESOURCE_JSON="${OUTPUT_DIR}/resources.json"
curl -sfL "${CDN_BASE}/resources.json" -o "$RESOURCE_JSON"
echo "    ✅ 完成 ($(wc -c < "$RESOURCE_JSON") bytes)"

# 2. 过滤出 isnet_quint8 的 chunks
echo "  2/3 解析模型文件清单..."
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('$RESOURCE_JSON', 'utf-8'));
// 只保留 isnet_quint8
const model = data['/models/isnet_quint8'];
if (!model) { console.error('❌ 未找到 isnet_quint8 模型'); process.exit(1); }
fs.writeFileSync('$RESOURCE_JSON', JSON.stringify({'/models/isnet_quint8': model}, null, 2));
const seen = new Set();
model.chunks.forEach(c => { if (!seen.has(c.name)) { seen.add(c.name); console.log(c.name); } });
" > /tmp/model_chunks.txt

CHUNK_COUNT=$(wc -l < /tmp/model_chunks.txt)
echo "    ✅ 需要下载 ${CHUNK_COUNT} 个 chunk 文件 (42MB)"

# 3. 下载 chunck 文件
echo "  3/3 下载 chunk 文件..."
COUNT=0
while read -r HASH; do
  [ -z "$HASH" ] && continue
  COUNT=$((COUNT + 1))
  TARGET="${OUTPUT_DIR}/${HASH}"
  if [ -f "$TARGET" ] && [ -s "$TARGET" ]; then
    echo -ne "    [${COUNT}/${CHUNK_COUNT}] ${HASH:0:12}... 已缓存\n"
  else
    echo -ne "    [${COUNT}/${CHUNK_COUNT}] 下载 ${HASH:0:12}...\r"
    curl -sfL "${CDN_BASE}/${HASH}" -o "$TARGET"
    echo -ne "    [${COUNT}/${CHUNK_COUNT}] ${HASH:0:12}... ✅\n"
  fi
done < /tmp/model_chunks.txt

rm -f /tmp/model_chunks.txt
echo ""
echo "✅ 模型下载完成！${OUTPUT_DIR}/ 共有 $(ls -1 "$OUTPUT_DIR" | wc -l | tr -d ' ') 个文件"
