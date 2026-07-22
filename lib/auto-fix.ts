/**
 * 照片自动修正引擎
 *
 * 分析原始照片问题，能自动修的修，不能修的报告给用户。
 * 在 AI 抠图前运行，确保送进去的照片质量达标。
 */

export type FixAction = 'fixed' | 'suggestion' | 'fatal';

export interface FixResult {
  id: string;
  name: string;
  action: FixAction;
  /** 用户可见的文案 */
  message: string;
  /** 已修正的 ImageData（仅 action='fixed' 时有效） */
  imageData?: ImageData;
}

/**
 * 全自动修正管线
 *
 * @param imageData - 原始照片的 ImageData
 * @param minSize   - 最小允许分辨率
 * @returns 修正结果 + 可能被修改的 ImageData
 */
export function autoFixPipeline(
  imageData: ImageData,
  minSize?: { width: number; height: number },
): FixResult[] {
  const results: FixResult[] = [];
  let data: Uint8ClampedArray = new Uint8ClampedArray(imageData.data);
  let { width: w, height: h } = imageData;
  let modified = false;

  // ===== 1. 分辨率检测（不可修）=====
  const minW = minSize?.width || 300;
  const minH = minSize?.height || 300;
  if (w < minW || h < minH) {
    results.push({
      id: 'resolution',
      name: '分辨率',
      action: 'fatal',
      message: `照片 ${w}×${h}px，低于要求的 ${minW}×${minH}px。请上传更高清晰度的照片`,
    });
  }

  // ===== 2. 曝光修正（可自动修）=====
  const exposureResult = autoExposure(data, w, h);
  if (exposureResult.fixed) {
    data = exposureResult.data;
    modified = true;
    results.push({
      id: 'exposure',
      name: '曝光',
      action: 'fixed',
      message: exposureResult.message,
    });
  } else if (exposureResult.warning) {
    results.push({
      id: 'exposure',
      name: '曝光',
      action: 'suggestion',
      message: exposureResult.message,
    });
  }

  // ===== 3. 色偏修正（可自动修）=====
  const colorResult = autoWhiteBalance(data, w, h);
  if (colorResult.fixed) {
    data = colorResult.data;
    modified = true;
    results.push({
      id: 'color',
      name: '色彩',
      action: 'fixed',
      message: colorResult.message,
    });
  } else if (colorResult.warning) {
    results.push({
      id: 'color',
      name: '色彩',
      action: 'suggestion',
      message: colorResult.message,
    });
  }

  if (modified) {
    return results.map((r) => {
      if (r.action === 'fixed') {
        return { ...r, imageData: new ImageData(data.slice(), w, h) };
      }
      return r;
    });
  }

  return results;
}

// ============================================================
// 曝光自动修正
// ============================================================

function autoExposure(
  data: Uint8ClampedArray,
  w: number,
  h: number,
): { fixed: boolean; warning: boolean; data: Uint8ClampedArray; message: string } {
  const total = w * h;
  let sumL = 0;
  let shadowCount = 0;
  let highlightCount = 0;

  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    const l = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    sumL += l;
    if (l < 60) shadowCount++;
    if (l > 200) highlightCount++;
  }

  const avg = sumL / total;

  // 曝光正常：不处理
  if (avg >= 90 && avg <= 190 && shadowCount < total * 0.15 && highlightCount < total * 0.1) {
    return { fixed: false, warning: false, data, message: '' };
  }

  // 太暗 → 提亮
  if (avg < 90) {
    const factor = Math.min(1.4, 110 / Math.max(avg, 30));
    const newData = new Uint8ClampedArray(data.length);
    for (let i = 0; i < total * 4; i++) {
      if (i % 4 === 3) { newData[i] = data[i]; continue; }
      newData[i] = Math.min(255, Math.round(data[i] * factor));
    }
    return {
      fixed: true,
      warning: false,
      data: newData,
      message: `照片偏暗，已自动提亮（修正因子 ×${factor.toFixed(2)}）`,
    };
  }

  // 太亮 → 压暗
  if (avg > 190 || highlightCount > total * 0.15) {
    const factor = Math.max(0.7, 170 / Math.min(avg, 250));
    const newData = new Uint8ClampedArray(data.length);
    for (let i = 0; i < total * 4; i++) {
      if (i % 4 === 3) { newData[i] = data[i]; continue; }
      newData[i] = Math.min(255, Math.round(data[i] * factor));
    }
    return {
      fixed: true,
      warning: false,
      data: newData,
      message: `照片偏亮，已自动降低曝光（修正因子 ×${factor.toFixed(2)}）`,
    };
  }

  // 明暗反差过大 → 提示
  if (shadowCount > total * 0.25 && highlightCount > total * 0.25) {
    return {
      fixed: false,
      warning: true,
      data,
      message: '面部光照不均匀（一侧过亮一侧过暗），建议使用正面光源拍摄',
    };
  }

  return { fixed: false, warning: false, data, message: '' };
}

// ============================================================
// 色偏自动修正（白平衡）
// ============================================================

function autoWhiteBalance(
  data: Uint8ClampedArray,
  w: number,
  h: number,
): { fixed: boolean; warning: boolean; data: Uint8ClampedArray; message: string } {
  const total = w * h;
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

  const maxDev = Math.max(Math.abs(avgR - avgG), Math.abs(avgR - avgB), Math.abs(avgG - avgB));

  // 色偏在合理范围
  if (maxDev < 20) {
    return { fixed: false, warning: false, data, message: '' };
  }

  // 用灰色世界假说做白平衡：所有颜色通道均值应相等
  // 计算增益
  const targetGray = (avgR + avgG + avgB) / 3;

  // 限制增益范围 0.75~1.5，避免过度修正
  const gainR = Math.max(0.75, Math.min(1.5, targetGray / avgR));
  const gainG = Math.max(0.75, Math.min(1.5, targetGray / avgG));
  const gainB = Math.max(0.75, Math.min(1.5, targetGray / avgB));

  const newData = new Uint8ClampedArray(data.length);
  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    newData[idx] = Math.min(255, Math.round(data[idx] * gainR));
    newData[idx + 1] = Math.min(255, Math.round(data[idx + 1] * gainG));
    newData[idx + 2] = Math.min(255, Math.round(data[idx + 2] * gainB));
    newData[idx + 3] = data[idx + 3];
  }

  let cast = '';
  if (avgR > avgG + 20 && avgR > avgB + 20) cast = '偏红';
  else if (avgB > avgR + 20 && avgB > avgG + 20) cast = '偏蓝';
  else if (avgG > avgR + 20 && avgG > avgB + 20) cast = '偏绿';
  else cast = '偏色';

  return {
    fixed: true,
    warning: false,
    data: newData,
    message: `照片${cast}，已自动白平衡修正`,
  };
}
