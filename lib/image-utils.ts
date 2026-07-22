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

/**
 * 合成证件照：将人像（透明背景 PNG）合成到指定背景色上，并缩放到目标尺寸
 *
 * @param personBlob - 抠图后的人像 Blob（透明背景 PNG）
 * @param fillStyle  - Canvas 填充样式（颜色字符串 或 CanvasGradient）
 * @param targetW    - 目标宽度（px）
 * @param targetH    - 目标高度（px）
 * @returns 合成后的 PNG Blob
 */
export async function compositeImage(
  personBlob: Blob,
  fillStyle: string | CanvasGradient,
  targetW: number,
  targetH: number,
): Promise<Blob> {
  const personImg = await loadImage(personBlob);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D 上下文不可用');

  // 1. 填充背景
  ctx.fillStyle = fillStyle;
  ctx.fillRect(0, 0, targetW, targetH);

  // 2. 绘制人像（cover 模式：铺满画布，居中裁剪）
  const scaleX = targetW / personImg.naturalWidth;
  const scaleY = targetH / personImg.naturalHeight;
  const scale = Math.max(scaleX, scaleY);

  const sw = personImg.naturalWidth * scale;
  const sh = personImg.naturalHeight * scale;
  const sx = (targetW - sw) / 2;
  const sy = (targetH - sh) / 2;

  // 高质量缩放
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(personImg, sx, sy, sw, sh);

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
