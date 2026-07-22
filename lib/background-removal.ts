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

/** 使用全精度 ISNet 模型（168MB，精度最高） */
const DEFAULT_MODEL = 'isnet';

/**
 * 获取 NEXT_PUBLIC_* 环境变量（安全兼容浏览器端）
 * Next.js 14 在构建时把 NEXT_PUBLIC_* 替换为实际值，
 * 但如果未设置环境变量，DefinePlugin 可能留下 process.env 引用导致浏览器报错。
 * 此函数安全兜底。
 */
function getPublicEnv(name: string): string | undefined {
  try {
    if (typeof process !== 'undefined' && process.env && process.env[name]) {
      return process.env[name];
    }
  } catch {
    // 浏览器端无 process，静默处理
  }
  return undefined;
}

/** 模型路径优先级：环境变量CDN > 本地静态目录 */
function getModelBasePath(): string {
  if (typeof window === 'undefined') return '/models/';
  const cdnUrl = getPublicEnv('NEXT_PUBLIC_MODEL_CDN_URL');
  if (cdnUrl) return cdnUrl.replace(/\/+$/, '') + '/';
  // 开发/默认：使用本地静态目录（必须是绝对 URL，因为 imgly 内部用 new URL(base, path) 拼接）
  return window.location.origin + '/models/';
}

/**
 * 检测本地模型 cache 是否可用
 */
async function checkLocalModelAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const resp = await fetch(`${getModelBasePath()}resources.json`, { method: 'HEAD' });
    return resp.ok;
  } catch {
    return false;
  }
}

/** WASM CDN 路径 */
function getWasmBasePath(): string {
  if (typeof window === 'undefined') return '/onnxruntime/';
  const cdnUrl = getPublicEnv('NEXT_PUBLIC_MODEL_CDN_URL');
  if (cdnUrl) return cdnUrl.replace(/\/+$/, '') + '/onnxruntime/';
  return window.location.origin + '/onnxruntime/';
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
    // 设置 WASM 运行时路径（patch 后的 @imgly 会读这个值）
    if (typeof window !== 'undefined') {
      (window as any).__WASM_PATH = getWasmBasePath();
    }

    const result = await removeBackground(imageBlob, {
      ...(localAvailable && {
        publicPath: getModelBasePath(),
      }),
      model: DEFAULT_MODEL,
      progress: (key: string, current: number, total: number) => {
        // 即使 total 为 0（流式下载未知总大小），也用小步递进保持 UI 反馈
        let pct: number;
        let status: string;

        if (key === 'wasm') {
          status = '正在加载 AI 引擎...';
          pct = total > 0 ? Math.min(10, Math.round((current / total) * 15)) : 8;
        } else if (key === 'compute' || key === 'inference') {
          status = '正在识别人物轮廓...';
          pct = total > 0 ? Math.min(85, 15 + Math.round((current / total) * 70)) : 50;
        } else if (key.startsWith('fetch:')) {
          status = total > 0
            ? `正在下载模型 (${Math.round(current / 1024 / 1024)}/${Math.round(total / 1024 / 1024)} MB)`
            : `正在下载模型 (${Math.round(current / 1024 / 1024)} MB)`;
          pct = total > 0
            ? Math.min(80, Math.round((current / total) * 80))
            : Math.min(80, 5 + Math.round((current / 1048576) * 5));
        } else {
          pct = total > 0 ? Math.min(99, Math.round((current / total) * 100)) : 50;
          status = `处理中 ${pct}%`;
        }

        onProgress?.(pct, status);
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
