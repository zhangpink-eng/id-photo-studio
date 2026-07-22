/**
 * 人像美颜处理 — 双边滤波磨皮 + 反锐化掩模清晰度增强
 *
 * 处理流水线（按顺序）：
 *   1. 双边滤波（磨皮去痘印，保留边缘）
 *   2. 反锐化掩模（提取细节层放大，提高清晰度）
 *   3. 美白提亮 + 降红
 *
 * 所有处理在浏览器本地完成。
 */

export interface BeautyParams {
  /** 磨皮强度 0-100，默认 50 — 双边滤波平滑皮肤 */
  smoothing: number;
  /** 去痘印 0-100，默认 50 — 红色素/深色斑点检测修复 */
  spotHeal: number;
  /** 提亮 0-100，默认 20 — 美白 */
  brightness: number;
  /** 清晰度 0-100，默认 30 — 反锐化掩模增强细节纹理 */
  sharpness: number;
}

export const DEFAULT_BEAUTY: BeautyParams = {
  smoothing: 50,
  spotHeal: 50,
  brightness: 20,
  sharpness: 30,
};

/**
 * 美颜预设定义
 */
export interface BeautyPreset {
  id: string;
  name: string;
  description: string;
  params: BeautyParams;
  /** 图标 emoji */
  icon: string;
}

export const BEAUTY_PRESETS: BeautyPreset[] = [
  {
    id: 'natural',
    name: '自然',
    description: '轻微修整，保留皮肤质感',
    icon: '🌿',
    params: { smoothing: 30, spotHeal: 30, brightness: 10, sharpness: 20 },
  },
  {
    id: 'fresh',
    name: '清新',
    description: '适度美化，气色更佳',
    icon: '🌸',
    params: { smoothing: 50, spotHeal: 40, brightness: 25, sharpness: 30 },
  },
  {
    id: 'refined',
    name: '精致',
    description: '明显美化，适合求职/正式场合',
    icon: '✨',
    params: { smoothing: 70, spotHeal: 60, brightness: 30, sharpness: 40 },
  },
  {
    id: 'natural_male',
    name: '男士自然',
    description: '保留线条感，轻度提亮',
    icon: '🧑',
    params: { smoothing: 20, spotHeal: 40, brightness: 5, sharpness: 40 },
  },
  {
    id: 'minimal',
    name: '素颜',
    description: '仅去痘印，几乎不改动',
    icon: '🧘',
    params: { smoothing: 5, spotHeal: 40, brightness: 0, sharpness: 10 },
  },
];

// ============================================================
// 快速高斯模糊（单通道 Float64Array）
// ============================================================

function gaussBlurFloat64(
  data: Float64Array,
  w: number,
  h: number,
  sigma: number
): Float64Array {
  if (sigma < 0.3) return data;
  const r = Math.max(1, Math.ceil(sigma * 2));
  const n = r * 2 + 1;
  const k = new Float64Array(n);
  let sk = 0;
  for (let i = 0; i < n; i++) { const x = i - r; k[i] = Math.exp(-(x * x) / (2 * sigma * sigma)); sk += k[i]; }
  for (let i = 0; i < n; i++) k[i] /= sk;

  const total = w * h;
  const tmp = new Float64Array(total);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let i = 0; i < n; i++) sum += data[y * w + Math.min(w - 1, Math.max(0, x + i - r))] * k[i];
      tmp[y * w + x] = sum;
    }
  }

  const out = new Float64Array(total);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let sum = 0;
      for (let i = 0; i < n; i++) sum += tmp[Math.min(h - 1, Math.max(0, y + i - r)) * w + x] * k[i];
      out[y * w + x] = sum;
    }
  }
  return out;
}

// ============================================================
// 快速高斯模糊（RGBA Uint8ClampedArray）
// ============================================================

function gaussBlurRGBA(
  src: Uint8ClampedArray,
  w: number,
  h: number,
  sigma: number
): Uint8ClampedArray {
  if (sigma < 0.3) return src;
  const r = Math.max(1, Math.ceil(sigma * 2));
  const n = r * 2 + 1;
  const k = new Float64Array(n);
  let sk = 0;
  for (let i = 0; i < n; i++) { const x = i - r; k[i] = Math.exp(-(x * x) / (2 * sigma * sigma)); sk += k[i]; }
  for (let i = 0; i < n; i++) k[i] /= sk;

  const total = w * h;
  const tmp = new Float64Array(total * 3);
  const dst = new Uint8ClampedArray(total * 4);

  for (let c = 0; c < 3; c++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0;
        for (let i = 0; i < n; i++) {
          const px = Math.min(w - 1, Math.max(0, x + i - r));
          sum += src[(y * w + px) * 4 + c] * k[i];
        }
        tmp[(y * w + x) * 3 + c] = sum;
      }
    }
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        let sum = 0;
        for (let i = 0; i < n; i++) {
          const py = Math.min(h - 1, Math.max(0, y + i - r));
          sum += tmp[(py * w + x) * 3 + c] * k[i];
        }
        dst[(y * w + x) * 4 + c] = Math.round(sum);
      }
    }
  }

  for (let i = 0; i < total; i++) dst[i * 4 + 3] = src[i * 4 + 3];
  return dst;
}

// ============================================================
// 双边滤波（Bilateral Filter）
// ============================================================

function bilateralFilter(
  src: Uint8ClampedArray,
  w: number,
  h: number,
  sigmaSpace: number,
  sigmaColor: number
): Uint8ClampedArray {
  const radius = Math.max(1, Math.ceil(sigmaSpace * 2));
  const total = w * h;
  const dst = new Uint8ClampedArray(total * 4);

  const spW = new Float64Array(radius * 2 + 1);
  for (let i = -radius; i <= radius; i++) spW[i + radius] = Math.exp(-(i * i) / (2 * sigmaSpace * sigmaSpace));

  const colorSigma2 = 2 * sigmaColor * sigmaColor;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cx = (y * w + x) * 4;
      const cr = src[cx], cg = src[cx + 1], cb = src[cx + 2];

      let sumR = 0, sumG = 0, sumB = 0, totalW = 0;
      const y0 = Math.max(0, y - radius), y1 = Math.min(h - 1, y + radius);
      const x0 = Math.max(0, x - radius), x1 = Math.min(w - 1, x + radius);

      for (let ky = y0; ky <= y1; ky++) {
        for (let kx = x0; kx <= x1; kx++) {
          const ki = (ky * w + kx) * 4;
          const dr = src[ki] - cr, dg = src[ki + 1] - cg, db = src[ki + 2] - cb;
          const cW = Math.exp(-(dr * dr + dg * dg + db * db) / colorSigma2);
          const weight = cW * spW[Math.abs(kx - x) + radius] * spW[Math.abs(ky - y) + radius];

          sumR += src[ki] * weight;
          sumG += src[ki + 1] * weight;
          sumB += src[ki + 2] * weight;
          totalW += weight;
        }
      }

      if (totalW > 0) {
        dst[cx] = Math.round(sumR / totalW);
        dst[cx + 1] = Math.round(sumG / totalW);
        dst[cx + 2] = Math.round(sumB / totalW);
      } else { dst[cx] = cr; dst[cx + 1] = cg; dst[cx + 2] = cb; }
      dst[cx + 3] = src[cx + 3];
    }
  }
  return dst;
}

// ============================================================
// 皮肤检测
// ============================================================

function skinScore(r: number, g: number, b: number): number {
  const mr = r / 255, mg = g / 255, mb = b / 255;
  const max = Math.max(mr, mg, mb), min = Math.min(mr, mg, mb);
  const diff = max - min;
  if (diff < 0.01) return 0;
  const l = (max + min) / 2;
  const s = l > 0.5 ? diff / (2 - max - min) : diff / (max + min);
  let h = 0;
  if (max === mr) h = ((mg - mb) / diff + (mg < mb ? 6 : 0)) / 6;
  else if (max === mg) h = ((mb - mr) / diff + 2) / 6;
  else h = ((mr - mg) / diff + 4) / 6;
  if (!((h < 0.083 || h > 0.83) && s > 0.05 && s < 0.6 && l > 0.1 && l < 0.85)) return 0;
  return Math.max(0, Math.min(1, 1 - Math.min(Math.abs(h - 0.055), 1 - Math.abs(h - 0.055)) * 3 - Math.abs(l - 0.5) - Math.abs(s - 0.2)));
}

// ============================================================
// 主函数
// ============================================================

export function applyBeauty(
  imageData: ImageData,
  params: BeautyParams
): ImageData {
  const { width: w, height: h } = imageData;
  const src = imageData.data;
  const total = w * h;
  const len = total * 4;

  const sm = params.smoothing / 100;
  const sh = params.spotHeal / 100;
  const br = params.brightness / 100;
  const sp = params.sharpness / 100; // sharpness 0-1

  if (sm <= 0 && sh <= 0 && br <= 0 && sp <= 0) {
    return new ImageData(new Uint8ClampedArray(src), w, h);
  }

  const maxDim = Math.max(w, h);

  // ===== 1. 双边滤波（磨皮去痘印）=====
  const sigmaSpace = sm * maxDim * 0.015 + 1;
  const sigmaColor = Math.max(8, 30 - sh * 15 + sm * 20);
  const smoothed = bilateralFilter(src, w, h, sigmaSpace, sigmaColor);

  // ===== 2. 反锐化掩模（清晰度增强）=====
  // 原理：原图 − 模糊版 = 细节层，放大细节层加回原图
  // 模糊 sigma 用固定值（≈1-3px），只增强精细纹理，不产生光晕
  let sharpened: Uint8ClampedArray | null = null;
  if (sp > 0) {
    // 模糊细节层 sigma = 1~2.5（固定，不随图像尺寸变）
    const detailSigma = 1.0 + sp * 1.5;
    // 用平滑后的图像做锐化基底（这样不会放大痘印）
    const base = sh > 0 ? smoothed : src;
    const blurredBase = gaussBlurRGBA(base, w, h, detailSigma);

    // 锐化强度
    const amount = 0.3 + sp * 1.2; // 0.3~1.5

    sharpened = new Uint8ClampedArray(len);
    for (let i = 0; i < total * 4; i++) {
      if (i % 4 === 3) { sharpened[i] = src[i]; continue; }
      // 细节 = 原图 - 模糊版
      const detail = base[i] - blurredBase[i];
      // 只取正细节（边缘高光侧），忽略暗侧（避免噪点放大）
      const posDetail = Math.max(0, detail);
      // 限制防止过噪
      const clamped = Math.min(posDetail, 30);
      sharpened[i] = Math.max(0, Math.min(255, Math.round(smoothed[i] + clamped * amount)));
    }
  }

  // ===== 3. 逐像素合成（磨皮 + 去痘印 + 锐化 + 提亮）=====
  const dst = new Uint8ClampedArray(len);
  const base = sharpened || smoothed;

  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    const sr = src[idx], sg = src[idx + 1], sb = src[idx + 2];
    const brr = base[idx], brg = base[idx + 1], brb = base[idx + 2];
    const a = src[idx + 3];
    const skin = skinScore(sr, sg, sb);

    let outR = sr, outG = sg, outB = sb;

    // 磨皮混合
    if (sm > 0 && skin > 0.05) {
      const blend = skin * (0.3 + sm * 0.7);
      outR = outR * (1 - blend) + brr * blend;
      outG = outG * (1 - blend) + brg * blend;
      outB = outB * (1 - blend) + brb * blend;
    }

    // 去痘印
    if (sh > 0 && skin > 0.1) {
      const redScore = sr - (sg + sb) / 2;
      const lumScore = (sr + sg + sb) / 3;
      const isRed = redScore > 10;
      const baseLum = Math.min(220, Math.max(sr, sg, sb));
      const isDark = lumScore < baseLum - 25 && lumScore < 180;

      if (isRed || isDark) {
        let extraBlend = 0;
        if (isRed) extraBlend = Math.min(0.9, (redScore - 10) / 50 * sh);
        if (isDark) extraBlend = Math.max(extraBlend, Math.min(0.8, (baseLum - lumScore) / 60 * sh * 0.6));
        extraBlend *= skin;
        outR = outR * (1 - extraBlend) + brr * extraBlend;
        outG = outG * (1 - extraBlend) + brg * extraBlend;
        outB = outB * (1 - extraBlend) + brb * extraBlend;
      }
    }

    // 美白提亮 + 降红
    if (br > 0 && skin > 0.05) {
      const bright = br * 25 * Math.min(1, skin * 1.4);
      const deRed = br * 6 * sh;
      outR = Math.min(255, outR + bright - deRed);
      outG = Math.min(255, outG + bright);
      outB = Math.min(255, outB + bright + deRed * 0.3);
    }

    dst[idx] = Math.max(0, Math.min(255, Math.round(outR)));
    dst[idx + 1] = Math.max(0, Math.min(255, Math.round(outG)));
    dst[idx + 2] = Math.max(0, Math.min(255, Math.round(outB)));
    dst[idx + 3] = a;
  }

  return new ImageData(dst, w, h);
}
