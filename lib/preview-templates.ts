/**
 * 证件照场景预览模板
 *
 * 将成品证照嵌入到各种场景中，让用户直观感受最终效果。
 * 纯 Canvas 渲染，不影响下载的原图。
 */

/** roundRect 兼容函数（支持旧浏览器） */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  r: number,
) {
  r = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export interface PreviewTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** 渲染函数（photo 为已加载好的 Image 元素） */
  render: (ctx: CanvasRenderingContext2D, w: number, h: number, img: HTMLImageElement) => Promise<void>;
}

/**
 * 注册所有可用模板
 */
export async function renderTemplate(
  templateId: string,
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
): Promise<void> {
  const template = TEMPLATES.find((t) => t.id === templateId);
  if (!template) throw new Error(`未知模板: ${templateId}`);

  const ctx = canvas.getContext('2d')!;
  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);
  await template.render(ctx, w, h, img);
}

/** 加载图片并绘制到指定区域（cover 模式） */
function drawPhotoCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = img.naturalWidth * scale;
  const sh = img.naturalHeight * scale;
  const sx = x + (w - sw) / 2;
  const sy = y + (h - sh) / 2;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh);
}

// ============================================================
// 模板定义
// ============================================================

export const TEMPLATES: PreviewTemplate[] = [
  {
    id: 'plain',
    name: '纯色背景',
    icon: '🎨',
    description: '标准证件照效果',
    render: async (ctx, w, h, img) => {
      drawPhotoCover(ctx, img, 0, 0, w, h);
    },
  },
  {
    id: 'frame',
    name: '相框效果',
    icon: '🖼️',
    description: '放在桌面相框里的效果',
    render: async (ctx, w, h, img) => {

      // 背景墙（木质纹理）
      ctx.fillStyle = '#d4a574';
      ctx.fillRect(0, 0, w, h);
      // 纹理线
      for (let y = 0; y < h; y += 60) {
        ctx.strokeStyle = 'rgba(180, 130, 80, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y + 30);
        ctx.lineTo(w, y + 10);
        ctx.stroke();
      }

      // 阴影
      const shadowPad = 20;
      const shadowSize = 6;
      ctx.shadowColor = 'rgba(0,0,0,0.25)';
      ctx.shadowBlur = shadowSize;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 3;

      // 相框外框
      const frameW = 10;
      const fw = w - shadowPad * 2;
      const fh = h - shadowPad * 2;
      ctx.fillStyle = '#8B7355';
      ctx.fillRect(shadowPad, shadowPad, fw, fh);

      // 相框内框（白色卡纸）
      const innerPad = frameW + 8;
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#f5f0e8';
      ctx.fillRect(shadowPad + frameW, shadowPad + frameW, fw - frameW * 2, fh - frameW * 2);

      // 照片（稍微缩小，居中在卡纸上）
      const photoPad = 12;
      const pw = fw - frameW * 2 - photoPad * 2;
      const ph = fh - frameW * 2 - photoPad * 2;
      const px = shadowPad + frameW + photoPad;
      const py = shadowPad + frameW + photoPad;
      ctx.shadowBlur = 0;

      // 用裁剪路径
      ctx.save();
      ctx.beginPath();
      ctx.rect(px, py, pw, ph);
      ctx.clip();
      drawPhotoCover(ctx, img, px, py, pw, ph);
      ctx.restore();
    },
  },
  {
    id: 'passport',
    name: '护照内页',
    icon: '🛂',
    description: '粘贴在护照上的效果',
    render: async (ctx, w, h, img) => {

      // 护照封面底色
      const grad = ctx.createLinearGradient(0, 0, w * 0.3, h);
      grad.addColorStop(0, '#1a237e');
      grad.addColorStop(1, '#283593');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // 国徽/文字装饰
      ctx.fillStyle = 'rgba(255,215,0,0.3)';
      ctx.font = `bold ${w * 0.08}px serif`;
      ctx.textAlign = 'center';
      ctx.fillText('PASSPORT', w / 2, h * 0.15);

      // 个人信息区背景
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      roundRect(ctx, w * 0.08, h * 0.25, w * 0.84, h * 0.65, 8);
      ctx.fill();

      // 照片贴附位置（偏右）
      const photoW = w * 0.28;
      const photoH = h * 0.38;
      const photoX = w * 0.62;
      const photoY = h * 0.30;

      // 照片白边
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.2)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      ctx.fillRect(photoX - 4, photoY - 4, photoW + 8, photoH + 8);
      ctx.shadowBlur = 0;

      // 照片
      ctx.save();
      ctx.beginPath();
      ctx.rect(photoX, photoY, photoW, photoH);
      ctx.clip();
      drawPhotoCover(ctx, img, photoX, photoY, photoW, photoH);
      ctx.restore();

      // 文字信息
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = `${w * 0.022}px sans-serif`;
      ctx.textAlign = 'left';
      const infoX = w * 0.14;
      const infoY = h * 0.38;
      const info = ['姓 名 / Surname', '张三 / ZHANG SAN', '', '性 别 / Sex', '男 / M', '', '国 籍 / Nationality', '中国 / CHN'];
      info.forEach((line, i) => {
        ctx.fillText(line, infoX, infoY + i * h * 0.045);
      });

      // 底纹
      ctx.fillStyle = 'rgba(255,215,0,0.08)';
      ctx.font = `${w * 0.5}px serif`;
      ctx.textAlign = 'center';
      ctx.fillText('★', w / 2, h * 0.92);
    },
  },
  {
    id: 'resume',
    name: '简历头像',
    icon: '📄',
    description: '简历上的圆形裁剪效果',
    render: async (ctx, w, h, img) => {

      // A4 纸背景
      ctx.fillStyle = '#fafafa';
      ctx.fillRect(0, 0, w, h);

      // 简历布局
      const leftW = w * 0.35;
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(0, 0, leftW, h);

      // 圆形头像
      const circleR = leftW * 0.32;
      const cx = leftW / 2;
      const cy = h * 0.22;

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, circleR, 0, Math.PI * 2);
      ctx.clip();
      drawPhotoCover(ctx, img, cx - circleR, cy - circleR, circleR * 2, circleR * 2);
      ctx.restore();

      // 头像边框
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, circleR + 2, 0, Math.PI * 2);
      ctx.stroke();

      // 左侧文字
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = `${leftW * 0.08}px sans-serif`;
      ctx.textAlign = 'center';
      const leftLabels = ['姓名', '电话', '邮箱'];
      const leftVals = ['张三', '138****8888', 'zhang@email.com'];
      leftLabels.forEach((label, i) => {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = `${leftW * 0.05}px sans-serif`;
        ctx.fillText(label, cx, h * 0.42 + i * h * 0.065);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = `${leftW * 0.055}px sans-serif`;
        ctx.fillText(leftVals[i], cx, h * 0.42 + i * h * 0.065 + h * 0.028);
      });

      // 右侧内容模拟
      ctx.fillStyle = '#2c3e50';
      ctx.font = `bold ${w * 0.035}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText('工作经历', leftW + w * 0.04, h * 0.15);

      const contentLines = [
        '公司名称 | 职位',
        '2020 - 至今',
        '',
        '• 负责产品设计与研发',
        '• 团队管理经验丰富',
        '',
        '教育背景',
        '某大学 | 计算机科学 本科',
      ];
      ctx.fillStyle = '#555';
      ctx.font = `${w * 0.02}px sans-serif`;
      contentLines.forEach((line, i) => {
        if (line === '教育背景') {
          ctx.fillStyle = '#2c3e50';
          ctx.font = `bold ${w * 0.03}px sans-serif`;
        } else {
          ctx.fillStyle = '#555';
          ctx.font = `${w * 0.02}px sans-serif`;
        }
        ctx.fillText(line, leftW + w * 0.04, h * 0.22 + i * h * 0.035);
      });
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

      // 卡片本体
      const cardW = w * 0.65;
      const cardH = h * 0.78;
      const cardX = (w - cardW) / 2;
      const cardY = h * 0.18;

      ctx.shadowColor = 'rgba(0,0,0,0.15)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      roundRect(ctx, cardX, cardY, cardW, cardH, 10);
      ctx.fill();
      ctx.shadowBlur = 0;

      // 卡片顶部色条
      ctx.fillStyle = '#2563eb';
      ctx.beginPath();
      // 仅顶部圆角（手绘）
      const r = 10, bw = cardW, bh = cardH * 0.28;
      ctx.moveTo(cardX + r, cardY);
      ctx.lineTo(cardX + bw - r, cardY);
      ctx.quadraticCurveTo(cardX + bw, cardY, cardX + bw, cardY + r);
      ctx.lineTo(cardX + bw, cardY + bh);
      ctx.lineTo(cardX, cardY + bh);
      ctx.lineTo(cardX, cardY + r);
      ctx.quadraticCurveTo(cardX, cardY, cardX + r, cardY);
      ctx.closePath();
      ctx.fill();

      // 公司名称
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${cardW * 0.08}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('一 拍 即 合', cardX + cardW / 2, cardY + cardH * 0.16);

      // 照片区
      const photoW = cardW * 0.35;
      const photoH = cardH * 0.42;
      const photoX = cardX + (cardW - photoW) / 2;
      const photoY = cardY + cardH * 0.32;
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(photoX, photoY, photoW, photoH);

      ctx.save();
      ctx.beginPath();
      ctx.rect(photoX, photoY, photoW, photoH);
      ctx.clip();
      drawPhotoCover(ctx, img, photoX, photoY, photoW, photoH);
      ctx.restore();

      // 姓名
      ctx.fillStyle = '#333';
      ctx.font = `bold ${cardW * 0.07}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('张 三', cardX + cardW / 2, photoY + photoH + cardH * 0.12);

      ctx.fillStyle = '#888';
      ctx.font = `${cardW * 0.04}px sans-serif`;
      ctx.fillText('研发部 · 高级工程师', cardX + cardW / 2, photoY + photoH + cardH * 0.20);
    },
  },
  {
    id: 'wall',
    name: '墙上装饰',
    icon: '🏠',
    description: '挂在墙上的大片效果',
    render: async (ctx, w, h, img) => {

      // 墙面
      ctx.fillStyle = '#e8e0d8';
      ctx.fillRect(0, 0, w, h);
      // 墙纸纹
      for (let y = 0; y < h; y += 40) {
        ctx.strokeStyle = 'rgba(200,190,180,0.3)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // 大相框
      const pad = w * 0.08;
      const frameW = w - pad * 2;
      const frameH = h - pad * 2 - 20;
      const frameX = pad;
      const frameY = pad;

      // 阴影
      ctx.shadowColor = 'rgba(0,0,0,0.2)';
      ctx.shadowBlur = 15;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 4;

      // 相框
      const border = 12;
      ctx.fillStyle = '#5c4033';
      ctx.beginPath();
      roundRect(ctx, frameX - border, frameY - border, frameW + border * 2, frameH + border * 2, 4);
      ctx.fill();

      // 内白边
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#f5f0e8';
      ctx.beginPath();
      roundRect(ctx, frameX - border + 4, frameY - border + 4, frameW + border * 2 - 8, frameH + border * 2 - 8, 2);
      ctx.fill();

      // 照片
      ctx.save();
      ctx.beginPath();
      ctx.rect(frameX, frameY, frameW, frameH);
      ctx.clip();
      drawPhotoCover(ctx, img, frameX, frameY, frameW, frameH);
      ctx.restore();
    },
  },
  {
    id: 'idcard',
    name: '身份证效果',
    icon: '🆔',
    description: '身份证上的照片效果',
    render: async (ctx, w, h, img) => {

      // 卡片底色
      ctx.fillStyle = '#f8f5f0';
      ctx.beginPath();
      roundRect(ctx, w * 0.02, h * 0.02, w * 0.96, h * 0.96, 8);
      ctx.fill();

      // 国徽
      ctx.fillStyle = '#c5a55a';
      ctx.font = `${w * 0.1}px serif`;
      ctx.textAlign = 'center';
      ctx.fillText('★', w * 0.5, h * 0.12);

      // 标题
      ctx.fillStyle = '#333';
      ctx.font = `bold ${w * 0.045}px sans-serif`;
      ctx.fillText('中 华 人 民 共 和 国', w * 0.5, h * 0.2);
      ctx.font = `bold ${w * 0.05}px sans-serif`;
      ctx.fillText('居 民 身 份 证', w * 0.5, h * 0.27);

      // 照片区（右侧）
      const photoW = w * 0.26;
      const photoH = h * 0.4;
      const photoX = w * 0.68;
      const photoY = h * 0.32;

      ctx.fillStyle = '#e8e4dc';
      ctx.fillRect(photoX, photoY, photoW, photoH);
      ctx.save();
      ctx.beginPath();
      ctx.rect(photoX, photoY, photoW, photoH);
      ctx.clip();
      drawPhotoCover(ctx, img, photoX, photoY, photoW, photoH);
      ctx.restore();

      // 信息
      ctx.fillStyle = '#333';
      ctx.font = `${w * 0.028}px sans-serif`;
      ctx.textAlign = 'left';
      const infoLines = [
        ['姓名', '张三'],
        ['性别', '男'],
        ['民族', '汉'],
        ['出生', '1990年1月1日'],
        ['住址', '北京市朝阳区xx街道xx号'],
      ];
      infoLines.forEach(([label, value], i) => {
        const ly = h * 0.33 + i * h * 0.07;
        ctx.fillStyle = '#888';
        ctx.font = `${w * 0.022}px sans-serif`;
        ctx.fillText(label, w * 0.06, ly);
        ctx.fillStyle = '#333';
        ctx.font = `${w * 0.028}px sans-serif`;
        ctx.fillText(value, w * 0.06 + w * 0.08, ly);
      });

      // 有效期
      ctx.fillStyle = '#888';
      ctx.font = `${w * 0.022}px sans-serif`;
      ctx.fillText('有效期 2020 - 2040', w * 0.06, h * 0.78);

      // 底纹
      ctx.fillStyle = 'rgba(200,180,160,0.08)';
      ctx.font = `${w * 0.4}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('身份证', w * 0.5, h * 0.75);
    },
  },
  {
    id: 'certificate',
    name: '证件证书',
    icon: '📜',
    description: '贴在证书/奖状上的效果',
    render: async (ctx, w, h, img) => {

      // 证书底色
      ctx.fillStyle = '#faf3e0';
      ctx.fillRect(0, 0, w, h);

      // 花边边框
      ctx.strokeStyle = '#c5a55a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      roundRect(ctx, w * 0.03, h * 0.03, w * 0.94, h * 0.94, 6);
      ctx.stroke();

      ctx.strokeStyle = '#d4b96a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      roundRect(ctx, w * 0.05, h * 0.05, w * 0.90, h * 0.90, 4);
      ctx.stroke();

      // 标题
      ctx.fillStyle = '#8b0000';
      ctx.font = `bold ${w * 0.06}px serif`;
      ctx.textAlign = 'center';
      ctx.fillText('荣 誉 证 书', w * 0.5, h * 0.17);

      // 正文
      ctx.fillStyle = '#333';
      ctx.font = `${w * 0.025}px sans-serif`;
      ctx.fillText('兹证明', w * 0.15, h * 0.28);
      ctx.font = `bold ${w * 0.035}px sans-serif`;
      ctx.fillText('张三 先生', w * 0.15, h * 0.35);
      ctx.font = `${w * 0.025}px sans-serif`;
      ctx.fillText('在2024年度工作中表现优秀，被评为：', w * 0.15, h * 0.42);
      ctx.fillStyle = '#8b0000';
      ctx.font = `bold ${w * 0.04}px serif`;
      ctx.fillText('年度优秀员工', w * 0.4, h * 0.53);
      ctx.fillStyle = '#333';
      ctx.font = `${w * 0.025}px sans-serif`;
      ctx.fillText('特发此证，以资鼓励', w * 0.3, h * 0.62);

      // 照片（左下角
      const photoSize = w * 0.18;
      const photoX = w * 0.1;
      const photoY = h * 0.70;

      ctx.fillStyle = '#e0d8c8';
      ctx.fillRect(photoX, photoY, photoSize, photoSize * 1.35);
      ctx.save();
      ctx.beginPath();
      ctx.rect(photoX, photoY, photoSize, photoSize * 1.35);
      ctx.clip();
      drawPhotoCover(ctx, img, photoX, photoY, photoSize, photoSize * 1.35);
      ctx.restore();

      // 日期章
      ctx.fillStyle = 'rgba(200,0,0,0.15)';
      ctx.font = `${w * 0.05}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.beginPath();
      ctx.arc(w * 0.78, h * 0.82, w * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(200,0,0,0.25)';
      ctx.font = `${w * 0.03}px sans-serif`;
      ctx.fillText('XX公司', w * 0.78, h * 0.80);
      ctx.font = `${w * 0.02}px sans-serif`;
      ctx.fillText('人事专用章', w * 0.78, h * 0.84);
    },
  },
];
