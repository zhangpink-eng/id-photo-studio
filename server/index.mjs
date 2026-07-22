/**
 * 证件照云端抠图 API 服务
 *
 * 直接使用 onnxruntime-node + 本地模型文件，
 * 不依赖 @imgly/background-removal-node
 *
 * 模型 168MB 常驻内存，用户上传照片即可抠图。
 *
 * 启动：
 *   npm start
 *
 * 环境变量：
 *   PORT          端口（默认 3001）
 *   MODEL_DIR     模型目录（默认 ./models）
 */

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import ort from 'onnxruntime-node';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const MODEL_DIR = path.resolve(process.env.MODEL_DIR || path.join(__dirname, 'models'));
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });

app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json());

// ============================================================
// 模型加载
// ============================================================

let session = null;
let modelLoaded = false;
let inputName = null;
let outputName = null;

/**
 * 从 chunk 文件组装完整 ONNX 模型
 */
function assembleModel() {
  const resourcePath = path.join(MODEL_DIR, 'resources.json');
  if (!fs.existsSync(resourcePath)) {
    throw new Error(`resources.json 未找到: ${resourcePath}`);
  }

  const resJson = JSON.parse(fs.readFileSync(resourcePath, 'utf-8'));
  const modelKey = Object.keys(resJson)[0];
  if (!modelKey) throw new Error('resources.json 中无模型定义');

  const modelDef = resJson[modelKey];
  const sortedChunks = modelDef.chunks.sort((a, b) => a.offsets[0] - b.offsets[0]);

  // 计算总大小
  const totalSize = sortedChunks[sortedChunks.length - 1].offsets[1];
  const buffer = Buffer.alloc(totalSize);

  sortedChunks.forEach((chunk) => {
    const chunkPath = path.join(MODEL_DIR, chunk.name);
    if (!fs.existsSync(chunkPath)) {
      throw new Error(`模型 chunk 缺失: ${chunkPath}`);
    }
    const data = fs.readFileSync(chunkPath);
    data.copy(buffer, chunk.offsets[0], 0, data.length);
  });

  console.log(`  模型: ${modelKey}, ${(totalSize / 1024 / 1024).toFixed(1)} MB, ${sortedChunks.length} chunks`);
  return buffer;
}

async function loadModel() {
  console.log('\n📦 加载 AI 模型...');
  try {
    const modelBuffer = assembleModel();
    session = await ort.InferenceSession.create(modelBuffer);
    inputName = session.inputNames[0];
    outputName = session.outputNames[0];
    modelLoaded = true;
    console.log(`  ✅ 加载成功 (输入: ${inputName}, 输出: ${outputName})`);
    console.log('🚀 服务就绪!\n');
  } catch (err) {
    console.error('  ❌ 加载失败:', err.message);
  }
}

loadModel();

// ============================================================
// 图像处理工具
// ============================================================

/**
 * 加载图片到 Tensor（归一化至 0-1）
 */
async function imageToTensor(imgBuffer) {

  // 模型输入尺寸: 1024x1024
  const INPUT_SIZE = 1024;
  const { data, info } = await sharp(imgBuffer)
    .resize(INPUT_SIZE, INPUT_SIZE, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // HWC → CHW + normalize to [0,1]
  const { width, height, channels } = info;
  const float32 = new Float32Array(1 * channels * height * width);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < channels; c++) {
        float32[c * height * width + y * width + x] = data[(y * width + x) * channels + c] / 255.0;
      }
    }
  }

  return { tensor: new ort.Tensor('float32', float32, [1, channels, height, width]), width, height, channels };
}

/**
 * 运行人像分割
 */
async function runSegmentation(imageBuffer) {
  if (!session) throw new Error('模型未加载');

  const { tensor, width, height } = await imageToTensor(imageBuffer);

  const feeds = { [inputName]: tensor };
  const results = await session.run(feeds);
  const output = results[outputName];

  // 输出多为 [1, 1, H, W] 的形状
  const data = output.data;
  const outH = output.dims?.[2] || height;
  const outW = output.dims?.[3] || width;

  return { mask: data, width: outW, height: outH, origW: width, origH: height };
}

/**
 * 将分割结果合成透明 PNG
 */
async function applyMask(imgBuffer, mask) {

  // 将 mask 数据转为 1 通道图像，缩放到原图尺寸
  const maskBuffer = Buffer.from(mask.mask);
  const maskImg = await sharp(maskBuffer, {
    raw: { width: mask.width, height: mask.height, channels: 1 },
  })
    .resize(mask.origW, mask.origH, { fit: 'fill' })
    .raw()
    .toBuffer();

  // 获取原图 RGBA
  const { data, info } = await sharp(imgBuffer)
    .resize(mask.origW, mask.origH, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // 合成：将 mask 作为 alpha 通道（mask 值 0-1 转为 0-255）
  const rgba = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < info.width * info.height; i++) {
    rgba[i * 4] = data[i * 4];       // R
    rgba[i * 4 + 1] = data[i * 4 + 1]; // G
    rgba[i * 4 + 2] = data[i * 4 + 2]; // B
    // Alpha = mask 值 * 255（>=0.5 为前景，<0.5 透明）
    const alpha = Math.round(maskImg[i] * 255);
    rgba[i * 4 + 3] = alpha > 128 ? 255 : 0;
  }

  return await sharp(rgba, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

// ============================================================
// API 路由
// ============================================================

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', modelLoaded, model: 'isnet(168MB)', modelDir: MODEL_DIR });
});

app.post('/api/remove-bg', upload.single('image'), async (req, res) => {
  const start = Date.now();

  try {
    if (!modelLoaded || !session) {
      return res.status(503).json({ error: '模型加载中，请稍后再试' });
    }
    if (!req.file) {
      return res.status(400).json({ error: '请上传图片' });
    }

    console.log(`  📸 收到: ${(req.file.size / 1024 / 1024).toFixed(2)} MB`);

    const segResult = await runSegmentation(req.file.buffer);
    const resultPng = await applyMask(req.file.buffer, segResult);

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    res.set({
      'Content-Type': 'image/png',
      'X-Processing-Time': `${elapsed}s`,
    });
    res.send(resultPng);
    console.log(`  ✅ 完成 (${elapsed}s)`);

  } catch (err) {
    console.error(`  ❌ 失败:`, err);
    res.status(500).json({ error: '背景移除失败', detail: err.message });
  }
});

// ============================================================
// 启动
// ============================================================

app.use('/models', express.static(MODEL_DIR));

app.listen(PORT, '0.0.0.0', () => {
  console.log('\n========================================');
  console.log('  一拍即合 · 云端抠图 API');
  console.log(`  端口: ${PORT}`);
  console.log(`  模型: ${MODEL_DIR}`);
  console.log(`  状态: ${modelLoaded ? '✅ 已加载' : '⏳ 加载中...'}`);
  console.log('========================================\n');
});
