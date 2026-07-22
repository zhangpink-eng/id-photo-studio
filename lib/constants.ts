/** 证件照尺寸规格（300 DPI 分辨率） */
export interface PhotoSize {
  id: string;
  name: string;           // 中文名称如 "1寸"
  widthMm: number;        // 宽度 mm
  heightMm: number;       // 高度 mm
  widthPx: number;        // 宽度 px (300dpi)
  heightPx: number;       // 高度 px (300dpi)
  description: string;    // 简短描述
}

/** 自定义尺寸的标记 ID */
export const CUSTOM_SIZE_ID = '__custom__';

export const PHOTO_SIZES: PhotoSize[] = [
  { id: '1inch',    name: '1寸',   widthMm: 25, heightMm: 35, widthPx: 295, heightPx: 413, description: '标准一寸' },
  { id: 'small1',   name: '小1寸', widthMm: 22, heightMm: 32, widthPx: 260, heightPx: 378, description: '小一寸' },
  { id: 'large1',   name: '大一寸', widthMm: 33, heightMm: 48, widthPx: 390, heightPx: 567, description: '大一寸' },
  { id: '2inch',    name: '2寸',   widthMm: 35, heightMm: 49, widthPx: 413, heightPx: 579, description: '标准两寸' },
  { id: 'small2',   name: '小2寸', widthMm: 33, heightMm: 48, widthPx: 390, heightPx: 567, description: '小两寸' },
  { id: 'large2',   name: '大2寸', widthMm: 35, heightMm: 53, widthPx: 413, heightPx: 626, description: '大两寸' },
  { id: 'idcard',   name: '身份证', widthMm: 26, heightMm: 32, widthPx: 358, heightPx: 441, description: '身份证照' },
  { id: 'visa',     name: '签证',  widthMm: 51, heightMm: 51, widthPx: 600, heightPx: 600, description: '方形签证照' },
  { id: CUSTOM_SIZE_ID, name: '自定义', widthMm: 0, heightMm: 0, widthPx: 400, heightPx: 500, description: '自定义尺寸' },
];

/** 预设背景色 */
export interface BgColorOption {
  name: string;
  value: string;          // CSS 颜色值 | 'gradient' | 'custom'
  description: string;
  gradient?: string;      // 渐变 CSS
}

export const BG_COLORS: BgColorOption[] = [
  { name: '白色',   value: '#FFFFFF',   description: '白色背景' },
  { name: '蓝色',   value: '#4476C7',   description: '标准蓝色背景（护照/身份证）' },
  { name: '红色',   value: '#E53935',   description: '标准红色背景' },
  { name: '渐变蓝', value: 'gradient',  description: '渐变蓝色背景', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { name: '灰色',   value: '#D9D9D9',   description: '浅灰色背景' },
  { name: '自定义', value: 'custom',    description: '自定义颜色' },
];

export const DEFAULT_BG_COLOR = '#4476C7';

/** 渐变色预设 */
export function createGradient(ctx: CanvasRenderingContext2D, width: number, height: number): CanvasGradient {
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#667eea');
  grad.addColorStop(1, '#764ba2');
  return grad;
}

/** 支持的图片格式 */
export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
