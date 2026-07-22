/**
 * AI 人像抠图（浏览器端，基于 @imgly/background-removal）
 *
 * 完全在浏览器本地执行，不上传图片数据到服务器。
 *
 * 资源加载优先级：
 * 1. public/models/     → 本地 AI 模型文件（由 download-models.sh 下载，patch 脚本部署）
 * 2. public/onnxruntime/ → 本地 WASM 运行时文件（由 patch-webgpu.sh 自动部署）
 * 3. CDN 回退            → 如果本地无模型，自动从 CDN 加载
 */

import { removeBackground } from '@imgly/background-removal';
import { env } from 'onnxruntime-common';

export type RemoveBgCallback = (progress: number, status: string) => void;

/** 使用的最轻量模型（42MB，isnet_quint8 = 8-bit 量化） */
const DEFAULT_MODEL = 'isnet_quint8';

// ===== 本地化配置 =====
// 当 public/models/resources.json 存在时使用本地模型，否则回退 CDN
const LOCAL_MODEL_PATH = '/models/';

let wasmPathInitialized = false;

/**
 * 检测本地模型是否可用（通过 HEAD 请求检查 resources.json）
 */
async function checkLocalModelAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const resp = await fetch(`${LOCAL_MODEL_PATH}resources.json`, { method: 'HEAD' });
    const ok = resp.ok;
    if (ok) console.log('[抠图] 使用本地模型 (' + LOCAL_MODEL_PATH + ')');
    return ok;
  } catch {
    return false;
  }
}

/**
 * 配置 onnxruntime 的 WASM 文件路径为本地 public/onnxruntime/
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

  // 设置 WASM 本地加载路径
  ensureWasmPath();

  // 异步检查本地模型是否可用
  const localAvailable = await checkLocalModelAvailable();

  onProgress?.(5, localAvailable ? '模型就绪' : '正在加载 AI 模型...');

  try {
    const result = await removeBackground(imageBlob, {
      // 有本地模型时使用本地路径，否则使用库默认的 CDN 路径
      ...(localAvailable && {
        publicPath: LOCAL_MODEL_PATH,
      }),
      // 使用最小的量化模型（42MB），本地 / CDN 通用
      model: DEFAULT_MODEL,
      progress: (key: string, current: number, total: number) => {
        if (total > 0) {
          const pct = Math.min(Math.round((current / total) * 100), 99);
          let status = key;
          if (key === 'wasm')
            status = '正在加载 AI 模型...';
          else if (key === 'compute' || key === 'inference')
            status = '正在识别人物轮廓...';
          else if (key.startsWith('fetch:'))
            status = `正在下载模型 (${pct}%)`;
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
