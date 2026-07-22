#!/bin/bash
# deploy-models.sh
#
# 部署 AI 模型文件到 CDN（Cloudflare R2 / S3 等）
# 配合环境变量 NEXT_PUBLIC_MODEL_CDN_URL 使用。
#
# 用法：
#   ./deploy-models.sh r2:cdn-bucket/models         # 部署到 R2
#   ./deploy-models.sh s3://my-bucket/models         # 部署到 S3
#   ./deploy-models.sh gs://my-bucket/models         # 部署到 GCS
#
# 前置条件：
#   - 已安装 rclone（推荐）或 aws/gsutil
#   - 已配置好对应云存储的认证
#
# 生产环境设置：
#   NEXT_PUBLIC_MODEL_CDN_URL=https://cdn.yourdomain.com/models/

set -euo pipefail

TARGET="${1:-}"
if [ -z "$TARGET" ]; then
  echo "❌ 请指定目标路径"
  echo "用法: $0 <目标路径>"
  echo "示例: $0 r2:cdn-bucket/models"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MODELS_DIR="$SCRIPT_DIR/public/models"
WASM_DIR="$SCRIPT_DIR/public/onnxruntime"

echo "📦 部署模型文件到: $TARGET"
echo ""

# ==========================
# 1. 检查文件是否就绪
# ==========================
echo "  1/3 检查本地文件..."

if [ ! -f "$MODELS_DIR/resources.json" ]; then
  echo "    ⚠️  models/resources.json 不存在"
  echo "    💡 先运行 npm run download-models 下载模型"
  echo "    或运行 npm run patch 部署模型"
  exit 1
fi

MODEL_FILES=$(ls -1 "$MODELS_DIR" | wc -l | tr -d ' ')
WASM_FILES=$(ls -1 "$WASM_DIR" | wc -l | tr -d ' ')
echo "    ✅ 模型文件: $MODELS_DIR/ ($MODEL_FILES 个文件)"
echo "    ✅ WASM 文件: $WASM_DIR/ ($WASM_FILES 个文件)"

# ==========================
# 2. 估算大小
# ==========================
echo ""
echo "  2/3 估算上传大小..."

MODEL_SIZE=$(du -sh "$MODELS_DIR" | cut -f1)
WASM_SIZE=$(du -sh "$WASM_DIR" | cut -f1)
echo "    模型: $MODEL_SIZE"
echo "    WASM: $WASM_SIZE"

# ==========================
# 3. 上传到 CDN
# ==========================
echo ""
echo "  3/3 开始上传..."

echo "    → models/ ..."
if command -v rclone &> /dev/null; then
  rclone sync "$MODELS_DIR" "$TARGET/models/" --progress --checksum
  rclone sync "$WASM_DIR" "$TARGET/onnxruntime/" --progress --checksum
elif command -v aws &> /dev/null; then
  echo "    使用 aws s3 sync..."
  aws s3 sync "$MODELS_DIR" "$TARGET/models/" --checksum-algorithm sha256
  aws s3 sync "$WASM_DIR" "$TARGET/onnxruntime/" --checksum-algorithm sha256
else
  echo "    ❌ 未找到 rclone 或 aws 命令"
  echo "    💡 安装 rclone: brew install rclone"
  exit 1
fi

echo ""
echo "✅ 部署完成！"
echo ""
echo "📋 设置环境变量:"
echo "   NEXT_PUBLIC_MODEL_CDN_URL=https://你的域名/$TARGET/"
echo ""
echo "📋 Vercel 设置:"
echo "   vercel env add NEXT_PUBLIC_MODEL_CDN_URL"
echo ""
echo "📋 或添加到 .env.local:"
echo "   echo \"NEXT_PUBLIC_MODEL_CDN_URL=https://你的域名/\" >> .env.local"
