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
  /** 头部占比要求（可选，如 {min:0.67, max:0.75}） */
  headRatio?: { min: number; max: number };
}

/**
 * 在缩略图上检测人像边界框
 */
function detectPersonBounds(
  img: HTMLImageElement,
  thumbSize = 200,
): { topPx: number; heightPx: number } | null {
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  const invRatio = Math.max(w, h) / thumbSize;
  if (invRatio > 1) { w = Math.round(w / invRatio); h = Math.round(h / invRatio); }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  let top = -1, bottom = -1;
  for (let y = 0; y < h && top === -1; y++)
    for (let x = 0; x < w; x++)
      if (data[(y * w + x) * 4 + 3] > 128) { top = y; break; }
  for (let y = h - 1; y >= 0 && bottom === -1; y--)
    for (let x = 0; x < w; x++)
      if (data[(y * w + x) * 4 + 3] > 128) { bottom = y; break; }

  if (top === -1 || bottom === -1) return null;
  // 返回原始图像空间的坐标
  return { topPx: Math.round(top * invRatio), heightPx: Math.round((bottom - top) * invRatio) };
}

/**
 * 智能合成证件照
 *
 * 传入 headRatio 时自动调整人像缩放，使头部占比符合要求。
 * 不传 headRatio 时用 contain 模式完整显示人像。
 */
export async function compositeImage(
  personBlob: Blob,
  fillStyle: string | CanvasGradient,
  targetW: number,
  targetH: number,
  headRatio?: { min: number; max: number },
): Promise<Blob> {
  const img = await loadImage(personBlob);
  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d')!;

  // 1. 填充背景
  ctx.fillStyle = fillStyle;
  ctx.fillRect(0, 0, targetW, targetH);

  // 2. 计算绘制参数
  let drawX: number, drawY: number, drawW: number, drawH: number;

  if (headRatio) {
    // 检测人像边界
    const bounds = detectPersonBounds(img);
    if (bounds) {
      // 人像可见高度，假设头部 ≈ 可见高度的 40%（从顶到脖子）
      const personVisH = bounds.heightPx;
      const headH = personVisH * 0.4;
      // 当前头部占画幅比例
      const currentRatio = headH / targetH;
      // 目标头部占比（取中间值）
      const target = (headRatio.min + headRatio.max) / 2;
      // 需要的缩放
      const scale = currentRatio > 0 ? target / currentRatio : 0.85;

      drawW = imgW * scale;
      drawH = imgH * scale;

      // 居中x
      drawX = (targetW - drawW) / 2;
      // y: 头顶在画布上的位置 = 头顶留白
      const topMargin = (1 - target) * targetH * 0.25;
      // 原始人像中 personTop 处对应缩放后的位置
      drawY = topMargin - bounds.topPx * scale;
    } else {
      // 没检测到人像，回退 contain 模式
      const s = Math.min(targetW / imgW, targetH / imgH);
      drawW = imgW * s; drawH = imgH * s;
      drawX = (targetW - drawW) / 2;
      drawY = (targetH - drawH) / 2;
    }
  } else {
    // contain 模式（完整显示人像）
    const s = Math.min(targetW / imgW, targetH / imgH);
    drawW = imgW * s; drawH = imgH * s;
    drawX = (targetW - drawW) / 2;
    drawY = (targetH - drawH) / 2;
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, drawX, drawY, drawW, drawH);

  // 3. 导出
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('图片导出失败'));
    }, 'image/png', 0.95);
  });
}

/** 读取本地文件为 data URL */
export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
