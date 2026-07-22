/**
 * AI 人像抠图 — 双模式：云端API / 浏览器本地
 *
 * 两种模式自动切换：
 *   云端API  — 设置 NEXT_PUBLIC_REMOVE_BG_API 环境变量
 *              照片上传到服务器处理，用户无需下载 168MB 模型
 *   浏览器本地 — 默认模式，模型在浏览器端运行，照片不上传
 *
 * 优先级：环境变量 > URL 参数 > 默认（浏览器本地）
 */

import { removeBackground as localRemoveBg } from '@imgly/background-removal';

export type RemoveBgCallback = (progress: number, status: string, stage?: string) => void;

/** 使用全精度 ISNet 模型（168MB，精度最高） */
const DEFAULT_MODEL = 'isnet';

/**
 * 云端 API 地址（编译时被 Next.js 替换）
 * 在浏览器端 process 不存在，try/catch 兜底返回 undefined
 */
let REMOVE_BG_API: string | undefined;
try { REMOVE_BG_API = process.env.NEXT_PUBLIC_REMOVE_BG_API; } catch {}

/**
 * 判断是否使用云端 API 模式
 */
function isServerMode(): boolean {
  if (REMOVE_BG_API && REMOVE_BG_API.length > 0) return true;

  // URL 参数覆盖（加 ?server=1 临时切服务器模式）
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('server') === '1') return true;
  }

  return false;
}

/**
 * 获取云端 API 地址
 */
function getServerApiUrl(): string {
  if (REMOVE_BG_API) return REMOVE_BG_API.replace(/\/+$/, '');
  return '';
}

// ============================================================
// 云端 API 模式
// ============================================================

async function removeImageBackgroundServer(
  imageBlob: Blob,
  onProgress?: RemoveBgCallback,
): Promise<Blob> {
  const apiBase = getServerApiUrl();
  if (!apiBase) throw new Error('未配置云端 API 地址');

  onProgress?.(5, '正在上传照片...', 'uploading');

  // 原图上传，不压缩 —— 服务器内部推理时会缩放到 1024×1024，
  // 推理完将 mask 贴回原分辨率返回，保证最终输出质量。
  const formData = new FormData();
  formData.append('image', imageBlob, 'photo.jpg');

  try {
    const response = await fetch(`${apiBase}/api/remove-bg`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let detail = '服务器处理失败';
      try {
        const errBody = await response.json();
        detail = errBody.error || detail;
      } catch {}
      throw new Error(detail);
    }

    onProgress?.(80, '服务器抠图中...', 'inference');

    const resultBlob = await response.blob();
    onProgress?.(100, '抠图完成 ✓', 'inference');

    return resultBlob;
  } catch (err) {
    onProgress?.(0, '失败');
    console.error('=== 云端抠图失败 ===', err);
    const msg = err instanceof Error ? err.message : '未知错误';
    throw new Error(`抠图失败：${msg}`);
  }
}

// ============================================================
// 浏览器本地模式（原有逻辑）
// ============================================================

/** 模型路径 */
function getModelBasePath(): string {
  if (typeof window === 'undefined') return '/models/';
  try {
    // Next.js 编译时把 NEXT_PUBLIC_* 替换为实际值
    const cdnUrl = process.env.NEXT_PUBLIC_MODEL_CDN_URL;
    if (cdnUrl) return cdnUrl.replace(/\/+$/, '') + '/';
  } catch {}
  return window.location.origin + '/models/';
}

/** 检测本地模型是否可用 */
async function checkLocalModelAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const resp = await fetch(`${getModelBasePath()}resources.json`, { method: 'HEAD' });
    return resp.ok;
  } catch {
    return false;
  }
}

/** WASM 路径 */
function getWasmBasePath(): string {
  if (typeof window === 'undefined') return '/onnxruntime/';
  try {
    const cdnUrl = process.env.NEXT_PUBLIC_MODEL_CDN_URL;
    if (cdnUrl) return cdnUrl.replace(/\/+$/, '') + '/onnxruntime/';
  } catch {}
  return window.location.origin + '/onnxruntime/';
}

async function removeImageBackgroundLocal(
  imageBlob: Blob,
  onProgress?: RemoveBgCallback,
): Promise<Blob> {
  onProgress?.(0, '初始化');

  const localAvailable = await checkLocalModelAvailable();
  onProgress?.(5, localAvailable ? '模型就绪' : '正在加载 AI 模型...');

  try {
    if (typeof window !== 'undefined') {
      (window as any).__WASM_PATH = getWasmBasePath();
    }

    const result = await localRemoveBg(imageBlob, {
      ...(localAvailable && {
        publicPath: getModelBasePath(),
      }),
      model: DEFAULT_MODEL,
      progress: (key: string, current: number, total: number) => {
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
    console.error('=== 背景移除失败 ===', error);
    const msg =
      error instanceof Error
        ? `背景移除失败：${error.message}`
        : '背景移除失败：未知错误';
    throw new Error(msg);
  }
}

// ============================================================
// 统一入口
// ============================================================

/**
 * 移除图片背景，返回透明背景的人像 PNG
 *
 * 自动选择模式：
 *   设 NEXT_PUBLIC_REMOVE_BG_API → 调用云端 API
 *   否则 → 浏览器本地处理
 */
export async function removeImageBackground(
  imageBlob: Blob,
  onProgress?: RemoveBgCallback,
): Promise<Blob> {
  if (isServerMode()) {
    console.log('[抠图] 使用云端 API 模式');
    return removeImageBackgroundServer(imageBlob, onProgress);
  }
  console.log('[抠图] 使用浏览器本地模式');
  return removeImageBackgroundLocal(imageBlob, onProgress);
}
