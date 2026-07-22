/**
 * 证件照云端抠图 API 服务
 *
 * 基于 @imgly/background-removal-node，模型常驻内存。
 * 使用内置 medium 模型（84MB），无需额外下载。
 *
 * 启动：
 *   npm start
 *
 * 环境变量：
 *   PORT             端口（默认 3001）
 *   ALLOWED_ORIGIN   跨域来源（默认无限制）
 */

import express from 'express';
import cors from 'cors';
import multer from 'multer';

const PORT = process.env.PORT || 3001;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });

app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json());

// ============================================================
// 模型管理
// ============================================================

let removeBackground = null;
let modelLoaded = false;

async function loadModel() {
  if (modelLoaded) return;
  console.log('\n📦 正在加载 AI 模型 (medium, 84MB)...');

  try {
    const imgly = await import('@imgly/background-removal-node');
    removeBackground = imgly.removeBackground;

    // 用内置模型（publicPath 不传则使用包自带的 medium 模型）
    modelLoaded = true;
    console.log('  ✅ 模型就绪！');
    console.log('🚀 服务就绪!\n');
  } catch (err) {
    console.error('  ❌ 模型加载失败:', err.message);
  }
}

loadModel();

// ============================================================
// API 路由
// ============================================================

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', modelLoaded, model: 'medium', version: 'imgly-node' });
});

app.post('/api/remove-bg', upload.single('image'), async (req, res) => {
  const startTime = Date.now();

  try {
    if (!removeBackground) {
      await loadModel();
      if (!removeBackground) return res.status(503).json({ error: '模型加载中' });
    }
    if (!req.file) return res.status(400).json({ error: '请上传图片' });

    console.log(`  📸 收到: ${(req.file.size / 1024 / 1024).toFixed(2)} MB`);

    // new Blob 要传文件 MIME 类型，否则 imgly 识别不了
    const imageBlob = new Blob([req.file.buffer], { type: req.file.mimetype });

    const result = await removeBackground(imageBlob, {
      model: 'medium',
      output: { format: 'image/png', quality: 0.95 },
      progress: (key, current, total) => {
        if (key === 'compute:inference' && total > 0) {
          const pct = Math.round((current / total) * 100);
          if (pct % 50 === 0) console.log(`     推理: ${pct}%`);
        }
      },
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const resultBuffer = Buffer.from(await result.arrayBuffer());
    res.set({ 'Content-Type': 'image/png', 'X-Processing-Time': `${elapsed}s` });
    res.send(resultBuffer);
    console.log(`  ✅ 完成 (${elapsed}s)`);

  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`  ❌ 失败 (${elapsed}s):`, err.message);
    res.status(500).json({ error: '背景移除失败', detail: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('\n========================================');
  console.log('  一拍即合 · 云端抠图 API');
  console.log(`  端口: ${PORT}`);
  console.log(`  模型: medium (84MB, 内置)`);
  console.log(`  状态: ${modelLoaded ? '✅ 已加载' : '⏳ 启动中...'}`);
  console.log('========================================\n');
});
