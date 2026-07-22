/**
 * AI 人像抠图（浏览器端，基于 @imgly/background-removal）
 *
 * 完全在浏览器本地执行，不上传图片数据到服务器。
 *
 * ⚠️ 工作原理解释：
 * 1. ✅ 图片数据仅在本地浏览器内处理，绝不外传
 * 2. ✅ AI 库代码（npm 包）本地加载
 * 3. ✅ WASM 运行时文件（~12MB）从本地 public/ 目录加载
 * 4. ⚠️ AI 模型权重（~20MB）首次使用时从 CDN 下载，之后由浏览器缓存
 *    - 如果希望完全离线使用，可手动下载模型放入 public/models/ 目录
 */

import { removeBackground } from '@imgly/background-removal';
// onnxruntime 的全局 env 单例，与 onnxruntime-web 共享
// 用于设置 WASM 文件加载路径为本地目录
import { env } from 'onnxruntime-common';

export type RemoveBgCallback = (progress: number, status: string) => void;

// 是否已初始化 WASM 路径
let wasmPathInitialized = false;

/**
 * 配置 onnxruntime 的 WASM 文件路径为本地 public/onnxruntime/
 * 确保浏览器从本地加载 ~12MB 的 WASM 运行时，而非 CDN。
 */
function ensureWasmPath() {
  if (wasmPathInitialized) return;
  if (typeof window !== 'undefined') {
    env.wasm.wasmPaths = '/onnxruntime/';
    wasmPathInitialized = true;
  }
}

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

  // 设置 WASM 文件本地加载路径
  ensureWasmPath();

  try {
    const result = await removeBackground(imageBlob, {
      progress: (key: string, current: number, total: number) => {
        if (total > 0) {
          const pct = Math.min(Math.round((current / total) * 100), 99);
          let status = key;
          if (key === 'wasm') status = '正在加载 AI 模型...';
          else if (key === 'compute' || key === 'inference') status = '正在识别人物轮廓...';
          else if (key.startsWith('fetch:')) {
            status = `正在下载模型 (${pct}%)`;
          }
          onProgress?.(pct, status);
        }
      },
      // 如果不希望使用 CDN 加载模型，可在此设置 publicPath 为本地路径
      // 见项目 README 中的"完全离线部署"章节
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
