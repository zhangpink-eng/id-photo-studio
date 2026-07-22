/**
 * 照片预处理检查 — 在 AI 抠图前快速扫描照片
 *
 * 所有检测在浏览器内完成，零额外依赖，几毫秒出结果。
 * 能自动修复的标记 autoFix，不能修的标记 userAction。
 */

export type PrecheckLevel = 'pass' | 'autoFix' | 'warn' | 'fail';

export interface PrecheckItem {
  id: string;
  name: string;
  level: PrecheckLevel;
  message: string;
  /** 系统将自动执行的操作（autoFix 时有效） */
  autoAction?: string;
  /** 用户需要做的操作（warn/fail 时有效） */
  userAction?: string;
}

export interface PrecheckResult {
  /** 综合是否可继续（只有 fail 才会阻断） */
  canProceed: boolean;
  /** 检测项列表 */
  items: PrecheckItem[];
  /** 摘要 */
  summary: string;
}

/**
 * 快速预检照片
 */
export async function quickPrecheck(
  imageUrl: string,
  sceneName?: string,
): Promise<PrecheckResult> {
  const items: PrecheckItem[] = [];

  const img = await loadImage(imageUrl);
  const { naturalWidth: w, naturalHeight: h } = img;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h).data;

  // ===== 1. 分辨率检测 =====
  items.push(checkResolution(w, h));

  // ===== 2. 模糊检测 → 可以用锐化修复 =====
  items.push(checkBlurry(data, w, h));

  // ===== 3. 方向检测 → 可以智能裁剪 =====
  items.push(checkOrientation(w, h));

  // ===== 4. 亮度检测 =====
  items.push(checkBasicExposure(data, w, h));

  // ===== 5. 头部初步定位 =====
  items.push(checkHeadPosition(data, w, h));

  // ===== 6. 背景复杂度 =====
  items.push(checkBackgroundNoise(data, w, h));

  const fails = items.filter((i) => i.level === 'fail');
  const canProceed = fails.length === 0;

  let summary = '';
  if (!canProceed) {
    summary = `${fails.length} 项无法自动修复，系统将尝试优化其他问题`;
  } else {
    const autoFixes = items.filter((i) => i.level === 'autoFix');
    if (autoFixes.length > 0) {
      summary = `发现 ${autoFixes.length} 个可优化项，系统将自动处理`;
    } else {
      summary = '照片质量良好';
    }
  }

  return { canProceed, items, summary };
}

// ============================================================
// 各检测项
// ============================================================

function checkResolution(w: number, h: number): PrecheckItem {
  if (w < 200 || h < 200) {
    return {
      id: 'resolution',
      name: '照片分辨率',
      level: 'fail',
      message: `${w}×${h}px，分辨率过低`,
      userAction: '请上传更高清晰度的照片',
    };
  }
  if (w < 400 || h < 500) {
    return {
      id: 'resolution',
      name: '照片分辨率',
      level: 'warn',
      message: `${w}×${h}px，分辨率偏低`,
      userAction: '输出效果可能不够理想',
    };
  }
  return { id: 'resolution', name: '照片分辨率', level: 'pass', message: `${w}×${h}px，充足` };
}

function checkOrientation(w: number, h: number): PrecheckItem {
  // 证件照应该竖拍
  const ratio = Math.max(w, h) / Math.min(w, h);
  if (h < w && ratio > 1.3) {
    return {
      id: 'orientation',
      name: '拍摄方向',
      level: 'autoFix',
      message: '照片是横拍的',
      autoAction: 'AI 将自动智能裁剪为竖版半身照',
    };
  }
  return { id: 'orientation', name: '拍摄方向', level: 'pass', message: '正常' };
}

function checkBlurry(
  data: Uint8ClampedArray,
  w: number,
  h: number,
): PrecheckItem {
  const MAX = 200;
  const scale = MAX / Math.max(w, h);
  if (scale >= 1) {
    return { id: 'blurry', name: '照片清晰度', level: 'pass', message: '正常' };
  }

  const sh = Math.round(h * scale);
  const sw = Math.round(w * scale);
  let totalDiff = 0;
  let count = 0;

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw - 1; x++) {
      const ox = Math.round(x / scale);
      const ox2 = Math.round((x + 1) / scale);
      const oy = Math.round(y / scale);
      const idx1 = (oy * w + ox) * 4;
      const idx2 = (oy * w + ox2) * 4;
      const l1 = 0.299 * data[idx1] + 0.587 * data[idx1 + 1] + 0.114 * data[idx1 + 2];
      const l2 = 0.299 * data[idx2] + 0.587 * data[idx2 + 1] + 0.114 * data[idx2 + 2];
      totalDiff += Math.abs(l1 - l2);
      count++;
    }
  }

  if (count === 0) return { id: 'blurry', name: '照片清晰度', level: 'pass', message: '正常' };

  const avgDiff = totalDiff / count;

  if (avgDiff < 2.5) {
    return {
      id: 'blurry', name: '照片清晰度', level: 'warn',
      message: '照片模糊',
      userAction: '系统将尝试锐化，效果可能不完美',
    };
  }
  if (avgDiff < 5) {
    return {
      id: 'blurry', name: '照片清晰度', level: 'autoFix',
      message: '照片清晰度偏低',
      autoAction: '将自动应用锐化增强',
    };
  }
  return { id: 'blurry', name: '照片清晰度', level: 'pass', message: '清晰' };
}

function checkBasicExposure(
  data: Uint8ClampedArray,
  w: number,
  h: number,
): PrecheckItem {
  let sumL = 0;
  const total = w * h;
  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    sumL += 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  }
  const avg = sumL / total;

  if (avg < 40) return { id: 'exposure', name: '曝光', level: 'fail', message: '照片过暗', userAction: '请使用光线充足的照片' };
  if (avg < 70) return { id: 'exposure', name: '曝光', level: 'autoFix', message: '照片偏暗', autoAction: '将自动提亮' };
  if (avg > 220) return { id: 'exposure', name: '曝光', level: 'autoFix', message: '照片过亮', autoAction: '将自动降低曝光' };
  return { id: 'exposure', name: '曝光', level: 'pass', message: '正常' };
}

function checkHeadPosition(
  data: Uint8ClampedArray,
  w: number,
  h: number,
): PrecheckItem {
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);
  const rangeW = Math.floor(w * 0.4);
  const rangeH = Math.floor(h * 0.4);
  let brightCount = 0;
  let totalPixels = 0;

  for (let y = cy - rangeH / 2; y < cy + rangeH / 2; y++) {
    for (let x = cx - rangeW / 2; x < cx + rangeW / 2; x++) {
      if (x >= 0 && x < w && y >= 0 && y < h) {
        const idx = (Math.floor(y) * w + Math.floor(x)) * 4;
        const l = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        if (l > 30) brightCount++;
        totalPixels++;
      }
    }
  }

  const ratio = brightCount / totalPixels;
  if (ratio < 0.3) {
    return { id: 'head_position', name: '人物位置', level: 'warn', message: '画面中央区域较空', userAction: '请确保面部在画面中央偏上位置' };
  }
  return { id: 'head_position', name: '人物位置', level: 'pass', message: '正常' };
}

function checkBackgroundNoise(
  data: Uint8ClampedArray,
  w: number,
  h: number,
): PrecheckItem {
  const corners = [
    { x: Math.floor(w * 0.1), y: Math.floor(h * 0.1) },
    { x: Math.floor(w * 0.9), y: Math.floor(h * 0.1) },
    { x: Math.floor(w * 0.1), y: Math.floor(h * 0.9) },
    { x: Math.floor(w * 0.9), y: Math.floor(h * 0.9) },
  ];

  let sumVar = 0;
  for (const c of corners) {
    let rSum = 0, gSum = 0, bSum = 0, n = 0;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const px = c.x + dx, py = c.y + dy;
        if (px >= 0 && px < w && py >= 0 && py < h) {
          const i = (py * w + px) * 4;
          rSum += data[i]; gSum += data[i + 1]; bSum += data[i + 2]; n++;
        }
      }
    }
    const avgR = rSum / n, avgG = gSum / n, avgB = bSum / n;
    let varSum = 0;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const px = c.x + dx, py = c.y + dy;
        if (px >= 0 && px < w && py >= 0 && py < h) {
          const i = (py * w + px) * 4;
          varSum += (data[i] - avgR) ** 2 + (data[i + 1] - avgG) ** 2 + (data[i + 2] - avgB) ** 2;
        }
      }
    }
    sumVar += varSum / n;
  }

  if (sumVar / 4 > 5000) {
    return { id: 'background', name: '背景', level: 'autoFix', message: '背景较杂乱', autoAction: 'AI 抠图将自动去除背景' };
  }
  return { id: 'background', name: '背景', level: 'pass', message: '简洁' };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
