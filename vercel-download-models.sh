#!/bin/bash
# vercel-download-models.sh
# Vercel 构建时下载 isnet 模型到 public/models/（作为降级回退）
set -euo pipefail
MODEL_VERSION="1.7.0"
CDN_BASE="https://staticimgly.com/@imgly/background-removal-data/${MODEL_VERSION}/dist"
OUTPUT_DIR="public/models"
echo "📦 下载 AI 模型到 ${OUTPUT_DIR} ..."
mkdir -p "$OUTPUT_DIR"
echo "  1/3 下载 resources.json..."
curl -sfL "${CDN_BASE}/resources.json" -o "${OUTPUT_DIR}/resources.json"
echo "  2/3 解析 isnet 模型清单..."
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('${OUTPUT_DIR}/resources.json','utf-8'));
const model = data['/models/isnet'];
if (!model) { process.exit(1); }
fs.writeFileSync('${OUTPUT_DIR}/resources.json', JSON.stringify({'/models/isnet': model}, null, 2));
model.chunks.forEach(c => console.log(c.name));
" > /tmp/isnet_chunks.txt
CHUNK_COUNT=$(wc -l < /tmp/isnet_chunks.txt)
echo "  3/3 下载 ${CHUNK_COUNT} 个 chunk (168MB)..."
COUNT=0
while read -r HASH; do
  [ -z "$HASH" ] && continue
  COUNT=$((COUNT + 1))
  TARGET="${OUTPUT_DIR}/${HASH}"
  if [ ! -f "$TARGET" ] || [ ! -s "$TARGET" ]; then
    curl -sfL "${CDN_BASE}/${HASH}" -o "$TARGET"
  fi
done < /tmp/isnet_chunks.txt
rm -f /tmp/isnet_chunks.txt
echo "✅ 模型下载完成"
