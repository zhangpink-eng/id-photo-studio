/**
 * AI 人像抠图（浏览器端，基于 @imgly/background-removal）
 *
 * 通过 CDN 动态加载，避免 npm 包中的 onnxruntime-web .mjs 文件与
 * Next.js 构建系统冲突。完全在浏览器本地执行，不上传图片数据。
 */

export type RemoveBgCallback = (progress: number, status: string) => void;

// ===== 类型声明（对应 @imgly/background-removal 的 API） =====
interface ImglyConfig {
  progress?: (key: string, current: number, total: number) => void;
  output?: { format?: string; quality?: number };
}

type ImglyRemoveFn = (image: Blob, config?: ImglyConfig) => Promise<Blob>;

// ===== CDN 加载器 =====
const CDN_URL =
  'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.0/dist/browser.js';

let loaded = false;
let loadingPromise: Promise<void> | null = null;

/** 确保库已加载 */
async function ensureLoaded(): Promise<ImglyRemoveFn> {
  if ((window as any).imglyRemoveBackground) {
    return (window as any).imglyRemoveBackground as ImglyRemoveFn;
  }

  if (!loadingPromise) {
    loadingPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = CDN_URL;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        loaded = true;
        resolve();
      };
      script.onerror = () => {
        loadingPromise = null;
        reject(new Error('AI抠图模型加载失败，请检查网络连接'));
      };
      document.head.appendChild(script);
    });
  }

  await loadingPromise;
  return (window as any).imglyRemoveBackground as ImglyRemoveFn;
}

/**
 * 移除图片背景，返回透明背景的人像 PNG
 *
 * @param imageBlob  - 源图片
 * @param onProgress - 进度回调 (0-100)
 */
export async function removeImageBackground(
  imageBlob: Blob,
  onProgress?: RemoveBgCallback,
): Promise<Blob> {
  onProgress?.(5, '加载模型');

  let fn: ImglyRemoveFn;
  try {
    fn = await ensureLoaded();
  } catch (err) {
    onProgress?.(0, '失败');
    throw err;
  }

  onProgress?.(20, '模型就绪');

  try {
    const result = await fn(imageBlob, {
      progress: (key, current, total) => {
        if (total > 0) {
          // progress 从 20% ~ 95%
          const pct = 20 + Math.min(Math.round((current / total) * 75), 75);
          onProgress?.(pct, key);
        }
      },
    });
    onProgress?.(100, '完成');
    return result;
  } catch (error) {
    onProgress?.(0, '失败');
    throw error;
  }
}
