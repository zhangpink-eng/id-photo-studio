/**
 * 图片预压缩工具
 *
 * 在送入 AI 模型前对上传的照片进行压缩，
 * 减少模型处理的内存消耗，提升移动端性能。
 *
 * 输出分辨率保持在最长边 2000px 以内，
 * 对证件照识别精度影响极小但内存消耗大幅降低。
 */

/** 压缩配置 */
export interface CompressOptions {
  /** 最长边最大像素（默认 2000） */
  maxDimension?: number;
  /** JPEG 质量 0-1（默认 0.92） */
  quality?: number;
}

const DEFAULT_OPTIONS: CompressOptions = {
  maxDimension: 2000,
  quality: 0.92,
};

/**
 * 压缩上传的图片
 * @returns 压缩后的 Blob（保持原始格式 JPEG 或 PNG）
 */
export function compressImage(
  file: File,
  options?: CompressOptions,
): Promise<Blob> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    // 如果文件已经很小，直接返回原文件
    if (file.size < 500 * 1024) {
      resolve(file);
      return;
    }

    const img = new Image();
    img.onload = () => {
      let { naturalWidth: w, naturalHeight: h } = img;

      // 等比例缩放
      if (w > opts.maxDimension! || h > opts.maxDimension!) {
        const ratio = opts.maxDimension! / Math.max(w, h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;

      // 高质量缩放
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);

      // 导出（保持 jpeg/png 格式）
      const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('图片压缩失败'));
        },
        mimeType,
        mimeType === 'image/png' ? undefined : opts.quality,
      );
    };
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = URL.createObjectURL(file);
  });
}
