/**
 * AI 人像抠图（浏览器端，基于 @imgly/background-removal）
 *
 * 完全在浏览器本地执行，不上传图片数据到服务器。
 *
 * 资源加载优先级：
 * 1. public/models/        → 本地 AI 模型（由 download-models.sh + patch 部署）
 * 2. public/onnxruntime/   → 本地 WASM 运行时（patch 自动部署）
 * 3. staticimgly.com CDN   → 上述都无可用时的回退
 */

import { removeBackground } from '@imgly/background-removal';

export type RemoveBgCallback = (progress: number, status: string) => void;

/** 使用的最轻量量化模型（42MB） */
const DEFAULT_MODEL = 'isnet_quint8';

/** 本地模型路径 */
const LOCAL_MODEL_PATH = '/models/';

/**
 * 检测本地模型 cache 是否可用
 */
async function checkLocalModelAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const resp = await fetch(`${LOCAL_MODEL_PATH}resources.json`, { method: 'HEAD' });
    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * 移除图片背景，返回透明背景的人像 PNG
 */
export async function removeImageBackground(
  imageBlob: Blob,
  onProgress?: RemoveBgCallback,
): Promise<Blob> {
  onProgress?.(0, '初始化');

  const localAvailable = await checkLocalModelAvailable();
  onProgress?.(5, localAvailable ? '模型就绪' : '正在加载 AI 模型...');

  try {
    const result = await removeBackground(imageBlob, {
      ...(localAvailable && {
        publicPath: LOCAL_MODEL_PATH,
      }),
      model: DEFAULT_MODEL,
      progress: (key: string, current: number, total: number) => {
        if (total > 0) {
          const pct = Math.min(Math.round((current / total) * 100), 99);
          let status = key;
          if (key === 'wasm') status = '正在加载 AI 模型...';
          else if (key === 'compute' || key === 'inference') status = '正在识别人物轮廓...';
          else if (key.startsWith('fetch:')) status = `正在下载模型 (${pct}%)`;
          onProgress?.(pct, status);
        }
      },
    });

    onProgress?.(100, '完成');
    return result;
  } catch (error) {
    onProgress?.(0, '失败');
    // 打印完整错误到 Console（按 F12 查看）
    console.error('=== 背景移除失败（完整错误）===', error);
    const msg =
      error instanceof Error
        ? `背景移除失败：${error.message}` +
          (error.stack ? `\n堆栈：${error.stack.slice(0, 300)}` : '')
        : `背景移除失败：未知错误（${String(error).slice(0, 200)}）`;
    throw new Error(msg);
  }
}
