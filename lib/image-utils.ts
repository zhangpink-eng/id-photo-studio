/**
 * 图片处理工具函数
 */

/** 从 Blob/File 加载图片 */
export function loadImage(src: Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.crossOrigin = 'anonymous';

    if (src instanceof Blob) {
      img.src = URL.createObjectURL(src);
    } else {
      img.src = src;
    }
  });
}

// ============================================================
// 头部占比智能调整
// ============================================================

/** 从 alpha 通道计算人像的边界框 */
function findPersonBounds(
  imageData: ImageData,
): { top: number; bottom: number; left: number; right: number } | null {
  const { data, width, height } = imageData;
  const alpha = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    alpha[i] = data[i * 4 + 3];
  }

  let top = -1, bottom = -1, left = -1, right = -1;

  // 从上往下找第一个非透明行
  for (let y = 0; y < height && top === -1; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha[y * width + x] > 128) { top = y; break; }
    }
  }
  // 从下往上
  for (let y = height - 1; y >= 0 && bottom === -1; y--) {
    for (let x = 0; x < width; x++) {
      if (alpha[y * width + x] > 128) { bottom = y; break; }
    }
  }
  if (top === -1 || bottom === -1) return null;

  // 从左往右
  for (let x = 0; x < width && left === -1; x++) {
    for (let y = top; y <= bottom; y++) {
      if (alpha[y * width + x] > 128) { left = x; break; }
    }
  }
  // 从右往左
  for (let x = width - 1; x >= 0 && right === -1; x--) {
    for (let y = top; y <= bottom; y++) {
      if (alpha[y * width + x] > 128) { right = x; break; }
    }
  }

  return { top, bottom, left: left ?? 0, right: right ?? width - 1 };
}

// ============================================================
// 智能合成（带头部占比调整）
// ============================================================

/**
 * 证件照合成参数
 */
export interface CompositeConfig {
  /** 目标宽度（px） */
  targetW: number;
  /** 目标高度（px） */
  targetH: number;
  /** 背景色 */
  fillStyle: string | CanvasGradient;
  /** 头部占比要求（可选） */
  headRatio?: { min: number; max: number };
  /** 人像占画幅的上下位置偏移（0-1，0=居中偏上，越大越偏下） */
  verticalOffset?: number;
}

/**
 * 智能合成证件照
 *
 * 1. 检测人像边界框
 * 2. 按头部占比要求缩放/定位人像
 * 3. 合成到目标背景上
 */
export async function compositeImage(
  personBlob: Blob,
  fillStyle: string | CanvasGradient,
  targetW: number,
  targetH: number,
  headRatio?: { min: number; max: number },
): Promise<Blob> {
  // V1：检测人像边界，按头部占比缩放
  const personImg = await loadImage(personBlob);

  // 缩小成 thumbnail 找边界
  const thumbCanvas = document.createElement('canvas');
  const THUMB_SIZE = 200;
  let thumbScale = 1;
  let { naturalWidth: pw, naturalHeight: ph } = personImg;
  if (pw > THUMB_SIZE || ph > THUMB_SIZE) {
    thumbScale = THUMB_SIZE / Math.max(pw, ph);
    pw = Math.round(pw * thumbScale);
    ph = Math.round(ph * thumbScale);
  }
  thumbCanvas.width = pw;
  thumbCanvas.height = ph;
  const tCtx = thumbCanvas.getContext('2d')!;
  tCtx.drawImage(personImg, 0, 0, pw, ph);
  const thumbData = tCtx.getImageData(0, 0, pw, ph);
  const bounds = findPersonBounds(thumbData);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d')!;

  // 1. 填充背景
  ctx.fillStyle = fillStyle;
  ctx.fillRect(0, 0, targetW, targetH);

  // 2. 计算人像的绘制位置
  const imgW = personImg.naturalWidth;
  const imgH = personImg.naturalHeight;

  if (!bounds || !headRatio) {
    // 无头部占比要求 → 用 contain 模式（完整呈现人像）
    const scaleX = targetW / imgW;
    const scaleY = targetH / imgH;
    const scale = Math.min(scaleX, scaleY);
    const sw = imgW * scale;
    const sh = imgH * scale;
    const sx = (targetW - sw) / 2;
    const sy = (targetH - sh) / 2;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(personImg, sx, sy, sw, sh);
  } else {
    // 有头部占比要求 → 智能缩放
    // 将缩略图边界还原到原始坐标
    const invScale = 1 / thumbScale;
    const personTop = bounds.top * invScale;
    const personBottom = bounds.bottom * invScale;
    const personHeight = personBottom - personTop;

    // 假设头顶在 personTop上方 0.1×人像高度处（头发/额头）
    const headBaseTop = Math.max(0, personTop - personHeight * 0.1);
    // 头部结束 ≈ top + 0.4 × 总人像高度（头+脖子）
    const headBaseBottom = personTop + personHeight * 0.4;
    const headHeight = headBaseBottom - headBaseTop;

    // 当前头部占目标画幅的比例（如果直接铺满）
    const currentHeadRatio = headHeight / targetH;

    // 目标头部占比
    const targetHeadRatio = (headRatio.min + headRatio.max) / 2;

    // 需要的缩放因子
    const scale = currentHeadRatio > 0 ? targetHeadRatio / currentHeadRatio : 0.8;

    // 用缩放后的人像高度
    const scaledH = imgH * scale;
    const scaledW = imgW * scale;

    // 垂直位置：让头顶在头部占比正好覆盖 targetH * targetHeadRatio 的高度
    // headBaseTop 在原人像中的相对位置
    const topOffset = headBaseTop * scale;
    // 头顶位置 = (targetH * targetHeadRatio) - (headHeight * scale)
    const verticalMargin = Math.max(0, targetH - targetH * targetHeadRatio) * 0.3;
    const drawY = targetH * (1 - targetHeadRatio) - (headHeight * scale) + verticalMargin;

    const drawX = (targetW - scaledW) / 2;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(personImg, drawX, drawY, scaledW, scaledH);
  }

  // 3. 导出为 PNG
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('图片导出失败'));
      },
      'image/png',
      0.95,
    );
  });
}

/** 读取本地文件为 data URL（用于预览） */
export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
