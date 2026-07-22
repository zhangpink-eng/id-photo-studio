/**
 * 证件照云端抠图 API 服务
 *
 * 运行在阿里云服务器上，模型 168MB 常驻内存。
 * 浏览器端不需要下载模型，只需上传照片即可。
 *
 * 启动：
 *   npm start                    # 开发
 *   PORT=3001 node index.mjs     # 自定义端口
 *   pm2 start index.mjs          # 生产（推荐）
 *
 * 环境变量：
 *   PORT             端口（默认 3001）
 *   ALLOWED_ORIGIN   允许跨域的前端域名（可选，默认无限制）
 *   MODEL_DIR        模型目录路径（默认 ./models）
 */

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const MODEL_DIR = path.resolve(process.env.MODEL_DIR || path.join(__dirname, 'models'));
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

// ============================================================
// 初始化
// ============================================================

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB
});

app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json());

// ============================================================
// 模型管理
// ============================================================

let removeBackground = null;
let modelLoaded = false;
let modelLoading = false;

/**
 * 加载 @imgly/background-removal 模型
 * 首次调用时加载，之后常驻内存
 */
async function loadModel() {
  if (modelLoaded) return removeBackground;
  if (modelLoading) {
    // 如果正在加载，等待完成
    while (modelLoading) await new Promise(r => setTimeout(r, 100));
    return removeBackground;
  }

  modelLoading = true;
  console.log('\n📦 正在加载 AI 模型...');

  // 检查模型文件是否存在
  const resourcePath = path.join(MODEL_DIR, 'resources.json');
  if (!fs.existsSync(resourcePath)) {
    console.warn('  ⚠️  模型文件未找到，请先运行: bash download-models.sh');
    console.warn(`     期望路径: ${resourcePath}`);
    modelLoading = false;
    return null;
  }

  try {
    // 动态导入 ESM 模块
    const imgly = await import('@imgly/background-removal');
    removeBackground = imgly.removeBackground;

    modelLoaded = true;
    console.log('  ✅ 模型加载成功！');
    console.log(`     模型路径: ${MODEL_DIR}`);
    console.log(`     模型版本: isnet (168MB)`);
    return removeBackground;
  } catch (err) {
    console.error('  ❌ 模型加载失败:', err.message);
    modelLoading = false;
    return null;
  }
}

// 启动时异步加载模型
loadModel().then(() => {
  console.log('🚀 服务就绪，等待请求...\n');
});

// ============================================================
// API 路由
// ============================================================

/** 健康检查 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    modelLoaded,
    model: 'isnet',
    modelDir: MODEL_DIR,
  });
});

/** 移除图片背景 */
app.post('/api/remove-bg', upload.single('image'), async (req, res) => {
  const startTime = Date.now();

  try {
    // 1. 检查模型
    if (!removeBackground) {
      const loaded = await loadModel();
      if (!loaded) {
        return res.status(503).json({
          error: '模型未就绪',
          message: '请先运行 bash download-models.sh 下载模型',
        });
      }
    }

    // 2. 检查上传
    if (!req.file) {
      return res.status(400).json({ error: '请上传图片' });
    }

    console.log(`  📸 收到图片: ${(req.file.size / 1024 / 1024).toFixed(2)} MB, ${req.file.mimetype}`);

    // 3. 执行抠图
    const result = await removeBackground(req.file.buffer, {
      model: 'isnet',
      publicPath: MODEL_DIR + '/',
      progress: (key, current, total) => {
        if (key === 'inference' && total > 0) {
          const pct = Math.round((current / total) * 100);
          if (pct % 25 === 0) console.log(`     推理进度: ${pct}%`);
        }
      },
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    // 4. 返回 PNG
    res.set({
      'Content-Type': 'image/png',
      'X-Processing-Time': `${elapsed}s`,
    });
    res.send(result);

    console.log(`  ✅ 抠图完成 (${elapsed}s)`);
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`  ❌ 处理失败 (${elapsed}s):`, err.message);
    res.status(500).json({
      error: '背景移除失败',
      detail: err.message,
    });
  }
});

// ============================================================
// 静态文件服务（可选：托管前端或模型文件）
// ============================================================

app.use('/models', express.static(MODEL_DIR));

// ============================================================
// 启动
// ============================================================

app.listen(PORT, '0.0.0.0', () => {
  console.log('\n========================================');
  console.log('  一拍即合 · 云端抠图 API');
  console.log(`  端口: ${PORT}`);
  console.log(`  模型: ${MODEL_DIR}`);
  console.log(`  状态: ${modelLoaded ? '✅ 已加载' : '⏳ 启动中...'}`);
  console.log('========================================\n');
});
