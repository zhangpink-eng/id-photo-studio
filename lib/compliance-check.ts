/**
 * 证件照合规检测引擎 V1（纯规则版）
 *
 * 在用户下载前进行自动检测，模拟政务系统的审核逻辑，
 * 把"上传后被退"提前到"下载前就告知"。
 *
 * V1 使用纯 Canvas API 分析，不依赖额外 ML 模型。
 * V2 可接入 face-api.js / MediaPipe 做更精确的面部检测。
 */

export type CheckStatus = 'pass' | 'warn' | 'fail';

export interface CheckResult {
  /** 检测项 ID */
  id: string;
  /** 检测项中文名 */
  name: string;
  /** 检测结果 */
  status: CheckStatus;
  /** 用户可见的说明 */
  message: string;
  /** 建议 */
  suggestion?: string;
}

export interface ComplianceContext {
  /** 目标尺寸的最小像素要求（宽，高） */
  minWidthPx?: number;
  minHeightPx?: number;
  /** 场景名称（用于显示） */
  sceneName?: string;
}

/**
 * 合规检测主函数
 *
 * @param imageData  - 待检测图像的 ImageData
 * @param context    - 检测上下文（目标尺寸等）
 * @returns 检测结果列表
 */
export function checkCompliance(
  imageData: ImageData,
  context?: ComplianceContext,
): CheckResult[] {
  const results: CheckResult[] = [];

  const { width: w, height: h } = imageData;
  const data = imageData.data;
  const total = w * h;

  // ===== 1. 分辨率检测 =====
  results.push(checkResolution(w, h, context));

  // ===== 2. 曝光检测 =====
  results.push(checkExposure(data, total));

  // ===== 3. 色偏检测 =====
  results.push(checkColorCast(data, total));

  return results;
}

// ============================================================
// 1. 分辨率检测
// ============================================================

function checkResolution(
  w: number,
  h: number,
  context?: ComplianceContext,
): CheckResult {
  const minW = context?.minWidthPx || 300;
  const minH = context?.minHeightPx || 300;

  if (w < minW || h < minH) {
    return {
      id: 'resolution',
      name: '照片分辨率',
      status: 'fail',
      message: `当前照片 ${w}×${h}px，小于最低要求 ${minW}×${minH}px`,
      suggestion: '请上传更高清晰度的照片，或重新拍摄',
    };
  }

  if (w < minW * 1.5 || h < minH * 1.5) {
    return {
      id: 'resolution',
      name: '照片分辨率',
      status: 'pass',
      message: `分辨率 ${w}×${h}px，满足最低要求`,
      suggestion: '建议使用更高分辨率的原始照片以获得更好效果',
    };
  }

  return {
    id: 'resolution',
    name: '照片分辨率',
    status: 'pass',
    message: `分辨率 ${w}×${h}px，质量良好`,
  };
}

// ============================================================
// 2. 曝光检测（亮度直方图）
// ============================================================

function checkExposure(data: Uint8ClampedArray, total: number): CheckResult {
  let sumL = 0;
  let darkPixels = 0;
  let brightPixels = 0;
  let shadowClipped = 0;
  let highlightClipped = 0;

  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    // 亮度（加权法）
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    sumL += l;

    if (l < 30) shadowClipped++;
    if (l > 240) highlightClipped++;
    if (l < 60) darkPixels++;
    if (l > 200) brightPixels++;
  }

  const avg = sumL / total;
  const shadowPct = (shadowClipped / total) * 100;
  const highlightPct = (highlightClipped / total) * 100;

  // 过曝
  if (avg > 210 || highlightPct > 15) {
    return {
      id: 'exposure',
      name: '曝光检测',
      status: 'warn',
      message: `照片偏亮${avg > 210 ? '（平均亮度 ' + Math.round(avg) + '）' : ''}`,
      suggestion: '建议避免强光直射面部，调整光线使其均匀柔和',
    };
  }

  // 欠曝
  if (avg < 80 || shadowPct > 20) {
    return {
      id: 'exposure',
      name: '曝光检测',
      status: 'warn',
      message: `照片偏暗${avg < 80 ? '（平均亮度 ' + Math.round(avg) + '）' : ''}`,
      suggestion: '建议增加环境光照明，避免逆光或侧光阴影',
    };
  }

  // 半阴半阳（明亮侧和暗侧差异大）
  if (darkPixels > total * 0.3 && brightPixels > total * 0.3) {
    return {
      id: 'exposure',
      name: '曝光检测',
      status: 'warn',
      message: '面部明暗反差较大，可能光照不均匀',
      suggestion: '建议使用正面光源，避免从侧面或上方直射',
    };
  }

  return {
    id: 'exposure',
    name: '曝光检测',
    status: 'pass',
    message: `曝光正常（平均亮度 ${Math.round(avg)}）`,
  };
}

// ============================================================
// 3. 色偏检测
// ============================================================

function checkColorCast(data: Uint8ClampedArray, total: number): CheckResult {
  let sumR = 0, sumG = 0, sumB = 0;

  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    sumR += data[idx];
    sumG += data[idx + 1];
    sumB += data[idx + 2];
  }

  const avgR = sumR / total;
  const avgG = sumG / total;
  const avgB = sumB / total;

  // 中性灰判断
  const rg = Math.abs(avgR - avgG);
  const rb = Math.abs(avgR - avgB);
  const gb = Math.abs(avgG - avgB);
  const maxDev = Math.max(rg, rb, gb);

  if (maxDev > 30) {
    let cast = '';
    if (avgR > avgG + 25 && avgR > avgB + 25) cast = '偏红';
    else if (avgB > avgR + 25 && avgB > avgG + 25) cast = '偏蓝';
    else if (avgG > avgR + 25 && avgG > avgB + 25) cast = '偏绿';
    else if (avgR > avgB + 30 && avgG > avgB + 30) cast = '偏黄';
    else if (avgB > avgR + 30 && avgB > avgG + 30) cast = '偏蓝';
    else cast = '色偏';

    return {
      id: 'color_cast',
      name: '色彩检测',
      status: 'warn',
      message: `照片${cast}（RGB偏差 ${Math.round(maxDev)}）`,
      suggestion: '建议检查环境光源，避免有色光照射面部，或使用色彩校正',
    };
  }

  return {
    id: 'color_cast',
    name: '色彩检测',
    status: 'pass',
    message: '色彩正常',
  };
}

/**
 * 获取检测结果的汇总状态
 */
export function getOverallStatus(results: CheckResult[]): {
  status: CheckStatus;
  label: string;
  color: string;
} {
  if (results.some((r) => r.status === 'fail')) {
    return { status: 'fail', label: '有不合格项', color: 'text-red-600' };
  }
  if (results.some((r) => r.status === 'warn')) {
    return { status: 'warn', label: '有需要注意的项', color: 'text-amber-600' };
  }
  return { status: 'pass', label: '全部通过', color: 'text-green-600' };
}
