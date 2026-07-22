#!/bin/bash
# server/download-models.sh
#
# 下载全精度 isnet 模型到服务器本地目录
# 模型文件约 168MB，只下载一次，服务启动后常驻内存

set -euo pipefail

MODEL_VERSION="1.7.0"
CDN_BASE="https://staticimgly.com/@imgly/background-removal-data/${MODEL_VERSION}/dist"
OUTPUT_DIR="models"

echo "📦 下载 AI 模型到 ${OUTPUT_DIR} ..."
mkdir -p "$OUTPUT_DIR"

# 1. 下载 resources.json
echo "  1/3 下载 resources.json..."
curl -sfL "${CDN_BASE}/resources.json" -o "${OUTPUT_DIR}/resources.json"
echo "    ✅ ($(wc -c < "${OUTPUT_DIR}/resources.json") bytes)"

# 2. 解析 isnet 模型的 chunk 清单
echo "  2/3 解析模型文件清单..."
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('${OUTPUT_DIR}/resources.json', 'utf-8'));
const model = data['/models/isnet'];
if (!model) { console.error('❌ 未找到 isnet 模型'); process.exit(1); }
// 只保留 isnet 的清单
fs.writeFileSync('${OUTPUT_DIR}/resources.json', JSON.stringify({'/models/isnet': model}, null, 2));
const seen = new Set();
model.chunks.forEach(c => { if (!seen.has(c.name)) { seen.add(c.name); console.log(c.name); } });
" > /tmp/isnet_chunks.txt

CHUNK_COUNT=$(wc -l < /tmp/isnet_chunks.txt)
echo "    ✅ 需要下载 ${CHUNK_COUNT} 个 chunk 文件"

# 3. 下载所有 chunk
echo "  3/3 下载 chunk 文件..."
COUNT=0
while read -r HASH; do
  [ -z "$HASH" ] && continue
  COUNT=$((COUNT + 1))
  TARGET="${OUTPUT_DIR}/${HASH}"
  if [ -f "$TARGET" ] && [ -s "$TARGET" ]; then
    echo "    [${COUNT}/${CHUNK_COUNT}] ${HASH:0:12}... 已缓存"
  else
    echo -ne "    [${COUNT}/${CHUNK_COUNT}] 下载 ${HASH:0:12}...\r"
    curl -sfL "${CDN_BASE}/${HASH}" -o "$TARGET"
    echo "    [${COUNT}/${CHUNK_COUNT}] ${HASH:0:12}... ✅"
  fi
done < /tmp/isnet_chunks.txt

rm -f /tmp/isnet_chunks.txt
echo ""
echo "✅ 模型下载完成！$(ls -1 "$OUTPUT_DIR" | wc -l | tr -d ' ') 个文件，$(du -sh "$OUTPUT_DIR" | cut -f1)"
echo ""
echo "💡 启动服务：npm start"
