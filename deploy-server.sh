#!/bin/bash
# deploy-server.sh
#
# 部署云端 API 服务到阿里云服务器
#
# 使用方法：
#   1. 在本机运行此脚本，将代码部署到服务器
#   2. SSH 到服务器，运行 npm start
#
# 前置条件：
#   - 已在 ~/.ssh/config 中配置好服务器 Host
#   - 服务器已安装 Node.js 18+ 和 npm
#
# 配置：
#   修改下面的 SERVER_HOST 和 REMOTE_DIR 为你的服务器信息

set -euo pipefail

# ====== 配置（修改这里）======
SERVER_HOST="root@your-server-ip"        # SSH 地址
REMOTE_DIR="/app/id-photo-server"         # 服务器部署目录
# =============================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/server"

echo "=========================================="
echo "  一拍即合 · 部署到阿里云"
echo "  服务器: ${SERVER_HOST}"
echo "  目标目录: ${REMOTE_DIR}"
echo "=========================================="
echo ""

# 1. 在服务器上创建目录
echo "📁 1/5 创建远程目录..."
ssh "$SERVER_HOST" "mkdir -p ${REMOTE_DIR}/models"

# 2. 拷贝 server 代码
echo "📦 2/5 上传代码..."
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude 'models/*.bin' \
  --exclude '.env' \
  "$SERVER_DIR/" "${SERVER_HOST}:${REMOTE_DIR}/"

# 3. 安装依赖
echo "📥 3/5 安装依赖..."
ssh "$SERVER_HOST" "cd ${REMOTE_DIR} && npm install"

# 4. 下载模型文件（168MB）
echo "🧠 4/5 下载 AI 模型..."
ssh "$SERVER_HOST" "cd ${REMOTE_DIR} && bash download-models.sh"

# 5. 启动服务
echo "🚀 5/5 启动服务..."
ssh "$SERVER_HOST" "cd ${REMOTE_DIR} && npm start &"

echo ""
echo "=========================================="
echo "  ✅ 部署完成！"
echo ""
echo "  本地测试:"
echo "    curl http://${SERVER_HOST#*@}:3001/api/health"
echo ""
echo "  设置前端环境变量:"
echo "    vercel env add NEXT_PUBLIC_REMOVE_BG_API"
echo "    填入: http://${SERVER_HOST#*@}:3001"
echo ""
echo "  管理命令:"
echo "    停止:   ssh ${SERVER_HOST} 'kill \$(cat ${REMOTE_DIR}/app.pid)'"
echo "    日志:   ssh ${SERVER_HOST} 'tail -f ${REMOTE_DIR}/app.log'"
echo "    重启:   ssh ${SERVER_HOST} 'cd ${REMOTE_DIR} && node index.mjs'"
echo "=========================================="
