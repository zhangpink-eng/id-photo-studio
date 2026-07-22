/**
 * 照片预处理检查 — 在 AI 抠图前快速扫描照片，判断是否适合所选场景
 *
 * 所有检测在浏览器内完成，零额外依赖，几毫秒出结果。
 */

export type PrecheckLevel = 'pass' | 'warn' | 'fail';

export interface PrecheckItem {
  id: string;
  name: string;
  level: PrecheckLevel;
  message: string;
  suggestion?: string;
}

export interface PrecheckResult {
  /** 综合是否可继续 */
  canProceed: boolean;
  /** 检测项列表 */
  items: PrecheckItem[];
  /** 需要用户确认的警告摘要 */
  summary: string;
}

/**
 * 快速预检照片
 *
 * @param imageUrl  - 上传的原始照片 URL
 * @param sceneName - 场景名称（用于上下文提示）
 * @returns 预检结果
 */
export async function quickPrecheck(
  imageUrl: string,
  sceneName?: string,
): Promise<PrecheckResult> {
  const items: PrecheckItem[] = [];

  // 加载图片
  const img = await loadImage(imageUrl);
  const { naturalWidth: w, naturalHeight: h } = img;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // ===== 1. 基本分辨率检测 =====
  items.push(checkResolution(w, h));

  // ===== 2. 长宽比检测（证件照应该竖拍） =====
  items.push(checkOrientation(w, h));

  // ===== 3. 模糊检测（Laplacian 方差） =====
  items.push(checkBlurry(data, w, h));

  // ===== 4. 亮度检测（基础曝光） =====
  items.push(checkBasicExposure(data, w, h));

  // ===== 5. 头部初步定位（有没有人像居中区域） =====
  items.push(checkHeadPosition(data, w, h));

  // ===== 6. 背景复杂度 =====
  items.push(checkBackgroundNoise(data, w, h));

  // 汇总
  const fails = items.filter((i) => i.level === 'fail');
  const warns = items.filter((i) => i.level === 'warn');
  const canProceed = fails.length === 0;

  let summary = '';
  if (!canProceed) {
    summary = `${fails.length} 项不符合要求，请调整后重新上传`;
  } else if (warns.length > 0) {
    summary = `${warns.length} 项需要注意，可继续处理`;
  } else {
    summary = '照片质量良好，可以开始处理';
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
      suggestion: '建议使用 500×600px 以上的照片',
    };
  }
  if (w < 400 || h < 500) {
    return {
      id: 'resolution',
      name: '照片分辨率',
      level: 'warn',
      message: `${w}×${h}px，分辨率偏低`,
      suggestion: '建议使用更高清晰度的照片',
    };
  }
  return {
    id: 'resolution',
    name: '照片分辨率',
    level: 'pass',
    message: `${w}×${h}px，分辨率充足`,
  };
}

function checkOrientation(w: number, h: number): PrecheckItem {
  // 证件照应该是竖拍（高 > 宽）
  if (h < w) {
    return {
      id: 'orientation',
      name: '拍摄方向',
      level: 'warn',
      message: '照片是横拍的，证件照建议竖拍',
      suggestion: '请使用竖屏半身照，效果更好',
    };
  }
  // 太正方形（高/宽 < 1.1）
  if (h / w < 1.1) {
    return {
      id: 'orientation',
      name: '拍摄方向',
      level: 'warn',
      message: '照片接近正方形，建议竖屏半身照',
      suggestion: '证件照建议头顶上方留白，人物居中',
    };
  }
  return {
    id: 'orientation',
    name: '拍摄方向',
    level: 'pass',
    message: '竖拍，方向正确',
  };
}

/**
 * 模糊检测：计算 Laplacian 方差
 * 值越大越清晰，< 50 很模糊，< 100 需要注意
 */
function checkBlurry(
  data: Uint8ClampedArray,
  w: number,
  h: number,
): PrecheckItem {
  // 缩到 300px 检测就够了
  const size = Math.min(300, Math.max(w, h));
  const scale = size / Math.max(w, h);
  const sw = Math.round(w * scale);
  const sh = Math.round(h * scale);

  // Laplacian 近似：用简单的边缘检测 (3x3 核)
  let sumEdges = 0;
  let count = 0;

  for (let y = 1; y < h - 1; y += Math.max(1, Math.round(1 / scale))) {
    for (let x = 1; x < w - 1; x += Math.max(1, Math.round(1 / scale))) {
      const idx = (y * w + x) * 4;
      // 转灰度
      const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      // 简单的拉普拉斯: 4*gray(x,y) - 上下左右
      const top = 0.299 * data[((y - 1) * w + x) * 4] + 0.587 * data[((y - 1) * w + x) * 4 + 1] + 0.114 * data[((y - 1) * w + x) * 4 + 2];
      const bottom = 0.299 * data[((y + 1) * w + x) * 4] + 0.587 * data[((y + 1) * w + x) * 4 + 1] + 0.114 * data[((y + 1) * w + x) * 4 + 2];
      const left = 0.299 * data[(y * w + x - 1) * 4] + 0.587 * data[(y * w + x - 1) * 4 + 1] + 0.114 * data[(y * w + x - 1) * 4 + 2];
      const right = 0.299 * data[(y * w + x + 1) * 4] + 0.587 * data[(y * w + x + 1) * 4 + 1] + 0.114 * data[(y * w + x + 1) * 4 + 2];

      const laplacian = Math.abs(4 * gray - top - bottom - left - right);
      sumEdges += laplacian;
      count++;
    }
  }

  const avg = sumEdges / count;

  if (avg < 8) {
    return {
      id: 'blurry',
      name: '照片清晰度',
      level: 'fail',
      message: '照片模糊不清',
      suggestion: '请重新拍摄，确保对焦清晰、手不抖',
    };
  }
  if (avg < 15) {
    return {
      id: 'blurry',
      name: '照片清晰度',
      level: 'warn',
      message: '照片不够清晰',
      suggestion: '建议使用光线充足时拍摄的照片',
    };
  }
  return {
    id: 'blurry',
    name: '照片清晰度',
    level: 'pass',
    message: '照片清晰',
  };
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

  if (avg < 40) {
    return {
      id: 'exposure',
      name: '曝光情况',
      level: 'fail',
      message: '照片过暗，几乎看不清',
      suggestion: '请在光线充足的室内拍摄，避免逆光',
    };
  }
  if (avg < 70) {
    return {
      id: 'exposure',
      name: '曝光情况',
      level: 'warn',
      message: '照片偏暗',
      suggestion: '可以增加光源或靠近窗户拍摄',
    };
  }
  if (avg > 220) {
    return {
      id: 'exposure',
      name: '曝光情况',
      level: 'warn',
      message: '照片过亮',
      suggestion: '避免强光直射面部',
    };
  }
  return {
    id: 'exposure',
    name: '曝光情况',
    level: 'pass',
    message: '曝光合适',
  };
}

function checkHeadPosition(
  data: Uint8ClampedArray,
  w: number,
  h: number,
): PrecheckItem {
  // 用中心区域亮度判断是否有主体
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
    return {
      id: 'head_position',
      name: '人物位置',
      level: 'warn',
      message: '画面中央区域较空，可能人物偏位或未入镜',
      suggestion: '请确保面部在画面中央偏上位置',
    };
  }

  return {
    id: 'head_position',
    name: '人物位置',
    level: 'pass',
    message: '人物位置正常',
  };
}

/** 背景复杂度检测 */
function checkBackgroundNoise(
  data: Uint8ClampedArray,
  w: number,
  h: number,
): PrecheckItem {
  // 检测画面四角的颜色方差是否很大（背景杂乱）
  const corners = [
    { x: Math.floor(w * 0.1), y: Math.floor(h * 0.1) },
    { x: Math.floor(w * 0.9), y: Math.floor(h * 0.1) },
    { x: Math.floor(w * 0.1), y: Math.floor(h * 0.9) },
    { x: Math.floor(w * 0.9), y: Math.floor(h * 0.9) },
  ];

  let sumVar = 0;
  for (const c of corners) {
    const idx = (c.y * w + c.x) * 4;
    // 取 5x5 区域的方差
    let rSum = 0, gSum = 0, bSum = 0;
    let n = 0;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const px = c.x + dx;
        const py = c.y + dy;
        if (px >= 0 && px < w && py >= 0 && py < h) {
          const i = (py * w + px) * 4;
          rSum += data[i];
          gSum += data[i + 1];
          bSum += data[i + 2];
          n++;
        }
      }
    }
    const avgR = rSum / n, avgG = gSum / n, avgB = bSum / n;
    let varSum = 0;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const px = c.x + dx;
        const py = c.y + dy;
        if (px >= 0 && px < w && py >= 0 && py < h) {
          const i = (py * w + px) * 4;
          varSum += (data[i] - avgR) ** 2 + (data[i + 1] - avgG) ** 2 + (data[i + 2] - avgB) ** 2;
        }
      }
    }
    sumVar += varSum / n;
  }

  const avgVar = sumVar / 4;

  if (avgVar > 5000) {
    return {
      id: 'background',
      name: '背景情况',
      level: 'warn',
      message: '背景较杂乱，抠图效果可能受影响',
      suggestion: '建议使用纯色墙面或白色背景拍摄',
    };
  }

  return {
    id: 'background',
    name: '背景情况',
    level: 'pass',
    message: '背景简洁，适合抠图',
  };
}

/** 加载图片 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
