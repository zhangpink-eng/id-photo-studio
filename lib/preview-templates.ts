/**
 * 证件照场景预览模板
 *
 * 真实场景框架，不做假数据。
 * 仅以场景对应的尺寸/底色/比例展示照片在真实场景中的效果。
 */

export interface PreviewTemplate {
  id: string;
  name: string;
  /** 渲染函数 — 将照片绘制到场景中 */
  render: (ctx: CanvasRenderingContext2D, w: number, h: number, img: HTMLImageElement) => Promise<void>;
}

/** 仅展示照片本身（标准证件照效果） */
const standard: PreviewTemplate = {
  id: 'standard',
  name: '标准证件照',
  render: async (ctx, w, h, img) => {
    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(0, 0, w, h);

    // 照片居中，维持比例，四周留边
    const pad = w * 0.08;
    const pw = w - pad * 2;
    const ph = h - pad * 2;
    const scale = Math.min(pw / img.naturalWidth, ph / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;

    ctx.shadowColor = 'rgba(0,0,0,0.08)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#fff';
    ctx.fillRect((w - pw) / 2 - 4, (h - ph) / 2 - 4, pw + 8, ph + 8);
    ctx.shadowBlur = 0;

    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  },
};

/** 相框/打印效果头 */
const printStrip: PreviewTemplate = {
  id: 'print',
  name: '冲印排版效果',
  render: async (ctx, w, h, img) => {
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(0, 0, w, h);

    // 模拟 6 寸相纸排版：3列×4行 = 12张
    const cols = 3, rows = 4;
    const margin = w * 0.03;
    const gap = w * 0.015;
    const cellW = (w - margin * 2 - gap * (cols - 1)) / cols;
    const cellH = (h - margin * 2 - gap * (rows - 1)) / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = margin + c * (cellW + gap);
        const y = margin + r * (cellH + gap);

        // 白底
        ctx.fillStyle = '#fff';
        ctx.fillRect(x, y, cellW, cellH);

        // 照片保持比例
        const s = Math.min(cellW * 0.85 / img.naturalWidth, cellH * 0.85 / img.naturalHeight);
        const dw = img.naturalWidth * s;
        const dh = img.naturalHeight * s;
        ctx.drawImage(img, x + (cellW - dw) / 2, y + (cellH - dh) / 2, dw, dh);
      }
    }
  },
};

/** 求职/工牌 — 展示在卡片上的效果 */
const badgeCard: PreviewTemplate = {
  id: 'badge',
  name: '工牌/证件卡片',
  render: async (ctx, w, h, img) => {
    // 背景
    ctx.fillStyle = '#f0ece8';
    ctx.fillRect(0, 0, w, h);

    // 卡片
    const cw = w * 0.58;
    const ch = h * 0.82;
    const cx = (w - cw) / 2;
    const cy = (h - ch) / 2;

    ctx.shadowColor = 'rgba(0,0,0,0.1)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    const rr = Math.min(cw, ch) * 0.025;
    ctx.moveTo(cx + rr, cy);
    ctx.lineTo(cx + cw - rr, cy);
    ctx.quadraticCurveTo(cx + cw, cy, cx + cw, cy + rr);
    ctx.lineTo(cx + cw, cy + ch - rr);
    ctx.quadraticCurveTo(cx + cw, cy + ch, cx + cw - rr, cy + ch);
    ctx.lineTo(cx + rr, cy + ch);
    ctx.quadraticCurveTo(cx, cy + ch, cx, cy + ch - rr);
    ctx.lineTo(cx, cy + rr);
    ctx.quadraticCurveTo(cx, cy, cx + rr, cy);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // 顶色条
    const barH = ch * 0.15;
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(cx, cy, cw, barH);

    // 照片（居中偏上）
    const pw = cw * 0.35;
    const px = cx + (cw - pw) / 2;
    const s = pw / img.naturalWidth;
    const ph2 = img.naturalHeight * s;
    const py = cy + barH + (ch - barH - ph2) * 0.3;

    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(px, py, pw, ph2);
    ctx.drawImage(img, px, py, pw, ph2);
  },
};

/** 场景ID → 模板映射 */
const SCENE_TEMPLATE_MAP: Record<string, PreviewTemplate> = {
  passport: printStrip,
  idcard: standard,
  drivers_license: standard,
  residence_permit: standard,
  social_security: standard,
  us_visa: standard,
  schengen_visa: standard,
  japan_visa: standard,
  uk_visa: standard,
  resume: badgeCard,
  linkedin: badgeCard,
  kaoyan: standard,
  teacher_cert: standard,
  civil_service: standard,
  college_english: standard,
  marriage: standard,
  military: badgeCard,
};

export function getTemplateForScene(sceneId: string): PreviewTemplate | null {
  return SCENE_TEMPLATE_MAP[sceneId] || standard;
}
