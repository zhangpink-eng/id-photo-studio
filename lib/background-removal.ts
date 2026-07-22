/**
 * AI 人像抠图（浏览器端，基于 @imgly/background-removal）
 *
 * 完全在本地执行，不上传任何图片数据到服务器。
 * 图片的 WASM 模型和 ONNX 推理均在浏览器中完成。
 */

import { removeBackground } from '@imgly/background-removal';

export type RemoveBgCallback = (progress: number, status: string) => void;

/**
 * 移除图片背景，返回透明背景的人像 PNG
 *
 * @param imageBlob  - 源图片 (Blob/File)
 * @param onProgress - 进度回调 (0-100)
 */
export async function removeImageBackground(
  imageBlob: Blob,
  onProgress?: RemoveBgCallback,
): Promise<Blob> {
  onProgress?.(0, '初始化');

  try {
    const result = await removeBackground(imageBlob, {
      progress: (key: string, current: number, total: number) => {
        if (total > 0) {
          const pct = Math.min(Math.round((current / total) * 100), 99);
          let status = key;
          if (key === 'wasm') status = '正在加载 AI 模型...';
          else if (key === 'compute' || key === 'inference') status = '正在识别人物轮廓...';
          onProgress?.(pct, status);
        }
      },
    });

    onProgress?.(100, '完成');
    return result;
  } catch (error) {
    onProgress?.(0, '失败');
    console.error('背景移除失败:', error);
    throw new Error(
      `背景移除失败：${error instanceof Error ? error.message : '请尝试其他照片或检查网络连接'}`
    );
  }
}
