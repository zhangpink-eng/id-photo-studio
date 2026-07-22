/**
 * 证件照场景预览模板
 *
 * 仅保留对用户有实际意义的场景：相框、工牌、挂墙。
 * 不做假数据模拟（护照/身份证/简历等使用假数据显得廉价）。
 */

export interface PreviewTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  render: (ctx: CanvasRenderingContext2D, w: number, h: number, img: HTMLImageElement) => Promise<void>;
}

export const TEMPLATES: PreviewTemplate[] = [
  {
    id: 'frame',
    name: '相框效果',
    icon: '🖼️',
    description: '放在桌面相框里的效果',
    render: async (ctx, w, h, img) => {
      const pad = w * 0.06;

      // 木纹墙
      ctx.fillStyle = '#d4a574';
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 60) {
        ctx.strokeStyle = 'rgba(180, 130, 80, 0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y + 30);
        ctx.lineTo(w, y + 10);
        ctx.stroke();
      }

      // 阴影
      ctx.shadowColor = 'rgba(0,0,0,0.25)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetX = 4;
      ctx.shadowOffsetY = 4;

      // 外框
      const bw = w - pad * 2;
      const bh = h - pad * 2;
      ctx.fillStyle = '#8B7355';
      ctx.fillRect(pad, pad, bw, bh);

      // 内框白边
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#f5f0e8';
      ctx.fillRect(pad + 10, pad + 10, bw - 20, bh - 20);

      // 照片保持比例
      const innerPad = 18;
      const pw = bw - 20 - innerPad * 2;
      const ph = bh - 20 - innerPad * 2;
      const scale = Math.min(pw / img.naturalWidth, ph / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;

      ctx.save();
      ctx.beginPath();
      ctx.rect(pad + 10 + innerPad, pad + 10 + innerPad, pw, ph);
      ctx.clip();
      ctx.drawImage(img, pad + 10 + innerPad + (pw - dw) / 2, pad + 10 + innerPad + (ph - dh) / 2, dw, dh);
      ctx.restore();
    },
  },
  {
    id: 'badge',
    name: '工牌效果',
    icon: '🪪',
    description: '挂在胸前的工作证效果',
    render: async (ctx, w, h, img) => {
      // 挂绳
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 4;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(w * 0.35, 0);
      ctx.quadraticCurveTo(w * 0.2, h * 0.1, w * 0.35, h * 0.18);
      ctx.stroke();
      ctx.moveTo(w * 0.65, 0);
      ctx.quadraticCurveTo(w * 0.8, h * 0.1, w * 0.65, h * 0.18);
      ctx.stroke();
      ctx.setLineDash([]);

      // 卡片
      const cw = w * 0.65;
      const ch = h * 0.78;
      const cx = (w - cw) / 2;
      const cy = h * 0.18;

      ctx.shadowColor = 'rgba(0,0,0,0.12)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      // roundRect polyfill
      const rr = 10;
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

      // 蓝色顶条
      const barH = ch * 0.25;
      ctx.fillStyle = '#2563eb';
      ctx.beginPath();
      ctx.moveTo(cx + rr, cy);
      ctx.lineTo(cx + cw - rr, cy);
      ctx.quadraticCurveTo(cx + cw, cy, cx + cw, cy + rr);
      ctx.lineTo(cx + cw, cy + barH);
      ctx.lineTo(cx, cy + barH);
      ctx.lineTo(cx, cy + rr);
      ctx.quadraticCurveTo(cx, cy, cx + rr, cy);
      ctx.closePath();
      ctx.fill();

      // 公司名
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${cw * 0.08}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('一 拍 即 合', cx + cw / 2, cy + barH * 0.58);

      // 照片（保持原比例）
      const pw = cw * 0.35;
      const s = pw / img.naturalWidth;
      const ph2 = img.naturalHeight * s;
      const px = cx + (cw - pw) / 2;
      const py = cy + barH + (ch - barH - ph2) * 0.35;

      ctx.save();
      ctx.beginPath();
      ctx.rect(px, py, pw, ph2);
      ctx.clip();
      ctx.drawImage(img, px, py, pw, ph2);
      ctx.restore();

      // 姓名
      ctx.fillStyle = '#333';
      ctx.font = `bold ${cw * 0.06}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('姓 名', cx + cw / 2, py + ph2 + ch * 0.10);
    },
  },
  {
    id: 'wall',
    name: '挂墙效果',
    icon: '🏠',
    description: '大照片挂在墙上的效果',
    render: async (ctx, w, h, img) => {
      // 墙面
      ctx.fillStyle = '#e8e0d8';
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 40) {
        ctx.strokeStyle = 'rgba(200,190,180,0.25)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      const pad = w * 0.06;

      // 阴影
      ctx.shadowColor = 'rgba(0,0,0,0.2)';
      ctx.shadowBlur = 15;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 4;

      // 相框
      ctx.fillStyle = '#5c4033';
      ctx.fillRect(pad - 10, pad - 10, w - pad * 2 + 20, h - pad * 2 + 20);

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#f5f0e8';
      ctx.fillRect(pad - 6, pad - 6, w - pad * 2 + 12, h - pad * 2 + 12);

      // 照片保持比例
      const fw = w - pad * 2;
      const fh = h - pad * 2;
      const scale = Math.min(fw / img.naturalWidth, fh / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;

      ctx.save();
      ctx.beginPath();
      ctx.rect(pad, pad, fw, fh);
      ctx.clip();
      ctx.drawImage(img, pad + (fw - dw) / 2, pad + (fh - dh) / 2, dw, dh);
      ctx.restore();
    },
  },
];
