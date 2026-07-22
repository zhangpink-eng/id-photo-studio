/**
 * 证件照排版打印引擎
 *
 * 将证件照排版到标准相纸或纸张上，方便打印后裁剪。
 * 支持6寸照片纸、A4纸等常见尺寸。
 */

export interface PaperSize {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  description: string;
}

/** 标准纸张/相纸规格 */
export const PAPER_SIZES: PaperSize[] = [
  { id: '6inch', name: '6寸相纸', widthMm: 101.6, heightMm: 152.4, description: '4×6英寸，最常见冲印尺寸' },
  { id: '5inch', name: '5寸相纸', widthMm: 88.9, heightMm: 127, description: '3.5×5英寸' },
  { id: '7inch', name: '7寸相纸', widthMm: 127, heightMm: 177.8, description: '5×7英寸' },
  { id: 'a4', name: 'A4纸', widthMm: 210, heightMm: 297, description: '标准打印纸' },
  { id: 'a5', name: 'A5纸', widthMm: 148, heightMm: 210, description: 'A4的一半' },
];

export interface LayoutConfig {
  /** 相纸类型 */
  paperId: string;
  /** 单张证件照尺寸（mm） */
  cellW: number;
  cellH: number;
  /** 边距（mm） */
  margin: number;
  /** 间距（mm） */
  spacing: number;
  /** 是否显示裁切线 */
  showCropMarks: boolean;
}

export interface CellPosition {
  col: number;
  row: number;
  x: number;   // left edge (mm)
  y: number;   // top edge (mm)
  w: number;   // cell width (mm)
  h: number;   // cell height (mm)
}

export interface LayoutResult {
  paper: PaperSize;
  cells: CellPosition[];
  cols: number;
  rows: number;
  total: number;
  actualWidthMm: number;
  actualHeightMm: number;
}

/**
 * 计算排版布局
 */
export function calculateLayout(
  config: LayoutConfig,
): LayoutResult {
  const paper = PAPER_SIZES.find((p) => p.id === config.paperId)!;
  if (!paper) throw new Error(`未知纸张尺寸: ${config.paperId}`);

  const { cellW, cellH, margin, spacing } = config;

  // 可用区域
  const availW = paper.widthMm - 2 * margin;
  const availH = paper.heightMm - 2 * margin;

  if (availW < cellW || availH < cellH) {
    // 纸张太小，至少放一张
    return {
      paper,
      cells: [{
        col: 0,
        row: 0,
        x: (paper.widthMm - cellW) / 2,
        y: (paper.heightMm - cellH) / 2,
        w: cellW,
        h: cellH,
      }],
      cols: 1,
      rows: 1,
      total: 1,
      actualWidthMm: cellW,
      actualHeightMm: cellH,
    };
  }

  // 计算每行/每列能排几个（含间距）
  const cols = Math.floor((availW + spacing) / (cellW + spacing));
  const rows = Math.floor((availH + spacing) / (cellH + spacing));

  // 总占用宽度/高度（居中）
  const totalW = cols * cellW + (cols - 1) * spacing;
  const totalH = rows * cellH + (rows - 1) * spacing;

  const offsetX = (paper.widthMm - totalW) / 2;
  const offsetY = (paper.heightMm - totalH) / 2;

  const cells: CellPosition[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({
        col: c,
        row: r,
        x: offsetX + c * (cellW + spacing),
        y: offsetY + r * (cellH + spacing),
        w: cellW,
        h: cellH,
      });
    }
  }

  return {
    paper,
    cells,
    cols,
    rows,
    total: cells.length,
    actualWidthMm: totalW,
    actualHeightMm: totalH,
  };
}

/**
 * 排版预测文本（供 UI 显示）
 */
export function layoutSummary(config: LayoutConfig): string {
  const result = calculateLayout(config);
  if (result.total <= 1 && result.cols === 1 && result.rows === 1) {
    return '纸张太小，仅能容纳 1 张';
  }
  return `${result.paper.name} · ${result.cols}列×${result.rows}行 = ${result.total}张`;
}

/**
 * 渲染排版为高分辨率 Blob（Canvas 引擎，300 DPI）
 *
 * @param personBlob   - 抠图后的人像 Blob
 * @param fillStyle    - 背景色（颜色字符串 | 'gradient' | 'custom')
 * @param layoutConfig - 排版配置
 * @param cellSizePx   - 单张证件照的像素尺寸（最终输出分辨率）
 */
export async function renderLayout(
  personBlob: Blob,
  fillStyle: string | CanvasGradient,
  layoutConfig: LayoutConfig,
  cellSizePx: { width: number; height: number },
): Promise<Blob> {
  const result = calculateLayout(layoutConfig);
  const DPI = 300;

  // 画布尺寸（按 DPI 转像素）
  const canvasW = Math.round(result.paper.widthMm / 25.4 * DPI);
  const canvasH = Math.round(result.paper.heightMm / 25.4 * DPI);

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d')!;

  // 白色基底
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvasW, canvasH);

  // 加载人像
  const personImg = await loadImage(personBlob);

  // 逐个绘制每个 cell
  for (const cell of result.cells) {
    // cell 坐标 mm → px
    const cx = Math.round(cell.x / 25.4 * DPI);
    const cy = Math.round(cell.y / 25.4 * DPI);
    const cw = Math.round(cell.w / 25.4 * DPI);
    const ch = Math.round(cell.h / 25.4 * DPI);

    // 背景色（支持渐变）
    let cellBg: string | CanvasGradient;
    if (fillStyle === 'gradient') {
      const g = ctx.createLinearGradient(cx, cy, cx, cy + ch);
      g.addColorStop(0, '#667eea');
      g.addColorStop(1, '#764ba2');
      cellBg = g;
    } else if (fillStyle === 'custom') {
      cellBg = '#4476C7'; // 自定义颜色在排版时使用默认蓝
    } else {
      cellBg = fillStyle;
    }
    ctx.fillStyle = cellBg;
    ctx.fillRect(cx, cy, cw, ch);

    // 绘制人像（cover 模式居中）
    const scaleX = cw / cellSizePx.width;
    const scaleY = ch / cellSizePx.height;
    const scale = Math.max(scaleX, scaleY);

    const sw = cellSizePx.width * scale;
    const sh = cellSizePx.height * scale;
    const sx = cx + (cw - sw) / 2;
    const sy = cy + (ch - sh) / 2;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(personImg, sx, sy, sw, sh);

    // 裁切线
    if (layoutConfig.showCropMarks) {
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(cx, cy, cw, ch);
      ctx.setLineDash([]);
    }
  }

  // 导出
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('排版渲染失败'));
      },
      'image/png',
      0.95,
    );
  });
}

/** 内部：从 Blob 加载图像 */
function loadImage(src: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = URL.createObjectURL(src);
  });
}
