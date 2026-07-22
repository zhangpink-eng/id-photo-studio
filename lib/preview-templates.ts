/**
 * 证件照场景预览模板
 *
 * 真实证件画布：用 Canvas 绘制逼真的证件版面，
 * 用户照片放在准确位置，其他信息做模糊化/占位处理。
 */

export interface PreviewTemplate {
  id: string;
  name: string;
  /** 版式说明 */
  description: string;
  render: (ctx: CanvasRenderingContext2D, w: number, h: number, img: HTMLImageElement) => Promise<void>;
}

// 证件照在画布上的标准占比（参考真实比例）
const PHOTO_RATIO = 0.78; // 护照照片约占画布高度的 78%

function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
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

// ============================================================
// 护照资料页
// ============================================================

const passport: PreviewTemplate = {
  id: 'passport',
  name: '护照资料页',
  description: '护照资料页照片位置效果',
  render: async (ctx, w, h, img) => {
    // 护照封面底色
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#1a237e');
    grad.addColorStop(1, '#283593');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 装饰纹
    ctx.fillStyle = 'rgba(255,215,0,0.12)';
    ctx.font = `${w * 0.5}px serif`;
    ctx.textAlign = 'center';
    ctx.fillText('★', w / 2, h * 0.6);

    // 顶部国徽区域
    ctx.fillStyle = 'rgba(255,215,0,0.25)';
    ctx.font = `${w * 0.07}px serif`;
    ctx.textAlign = 'center';
    ctx.fillText('★', w / 2, h * 0.08);

    // 护照标题
    ctx.fillStyle = 'rgba(255,215,0,0.6)';
    ctx.font = `bold ${w * 0.055}px sans-serif`;
    ctx.fillText('PASSPORT', w / 2, h * 0.15);

    // 信息区背景
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    drawRoundRect(ctx, w * 0.06, h * 0.22, w * 0.88, h * 0.68, 6);
    ctx.fill();

    // 照片位置（右侧标准位置）
    const photoW = w * 0.28;
    const photoH = photoW / (img.naturalWidth / img.naturalHeight || PHOTO_RATIO);
    const photoX = w * 0.66;
    const photoY = h * 0.28;

    // 照片白边
    ctx.shadowColor = 'rgba(0,0,0,0.15)';
    ctx.shadowBlur = 3;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(photoX - 3, photoY - 3, photoW + 6, photoH + 6);
    ctx.shadowBlur = 0;

    // 照片
    ctx.save();
    ctx.beginPath();
    ctx.rect(photoX, photoY, photoW, photoH);
    ctx.clip();
    const s = Math.max(photoW / img.naturalWidth, photoH / img.naturalHeight);
    ctx.drawImage(img, photoX + (photoW - img.naturalWidth * s) / 2, photoY + (photoH - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
    ctx.restore();

    // 信息字段（占位符）
    const fields = [
      ['类型 / Type', 'P · 普通护照'],
      ['国家 / Country', '中华人民共和国'],
      ['姓名 / Surname', '••••••••'],
      ['性别 / Sex', '•'],
      ['国籍 / Nationality', 'CHN'],
      ['出生日期 / DOB', '••••••••'],
      ['签发日期 / DOI', '••••••••'],
      ['有效期至 / DOE', '••••••••'],
    ];

    ctx.textAlign = 'left';
    fields.forEach(([label, value], i) => {
      const ly = h * 0.28 + i * h * 0.068;
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = `${w * 0.018}px sans-serif`;
      ctx.fillText(label, w * 0.1, ly);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = `${w * 0.024}px sans-serif`;
      ctx.fillText(value, w * 0.1, ly + h * 0.032);
    });

    // 底部MRZ区域
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(w * 0.06, h * 0.82, w * 0.88, h * 0.06);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = `${w * 0.02}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('P<CHN••••••••<<••••<<••<<<<<<<<<<<<<<<<<', w / 2, h * 0.865);
  },
};

// ============================================================
// 身份证
// ============================================================

const idCard: PreviewTemplate = {
  id: 'idcard',
  name: '身份证',
  description: '身份证照片位置效果',
  render: async (ctx, w, h, img) => {
    // 卡片底色
    ctx.fillStyle = '#f8f5f0';
    drawRoundRect(ctx, w * 0.02, h * 0.02, w * 0.96, h * 0.96, 8);
    ctx.fill();

    // 国徽
    ctx.fillStyle = '#c5a55a';
    ctx.font = `${w * 0.08}px serif`;
    ctx.textAlign = 'center';
    ctx.fillText('★', w * 0.5, h * 0.1);

    // 标题
    ctx.fillStyle = '#8b0000';
    ctx.font = `bold ${w * 0.035}px sans-serif`;
    ctx.fillText('中华人民共和国', w * 0.5, h * 0.17);
    ctx.font = `bold ${w * 0.04}px sans-serif`;
    ctx.fillText('居民身份证', w * 0.5, h * 0.23);

    // 照片区（右侧）
    const photoW = w * 0.24;
    const photoH = photoW / (img.naturalWidth / img.naturalHeight || PHOTO_RATIO);
    const photoX = w * 0.7;
    const photoY = h * 0.28;

    ctx.fillStyle = '#e8e4dc';
    ctx.fillRect(photoX, photoY, photoW, photoH);
    ctx.save();
    ctx.beginPath();
    ctx.rect(photoX, photoY, photoW, photoH);
    ctx.clip();
    const s = Math.max(photoW / img.naturalWidth, photoH / img.naturalHeight);
    ctx.drawImage(img, photoX + (photoW - img.naturalWidth * s) / 2, photoY + (photoH - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
    ctx.restore();

    // 信息（占位）
    ctx.textAlign = 'left';
    const info = [
      ['姓名', '••••••'],
      ['性别', '•'],
      ['民族', '••'],
      ['出生', '••••年••月••日'],
      ['住址', '••••••••••••••••'],
    ];
    ctx.font = `${w * 0.022}px sans-serif`;
    info.forEach(([label, value], i) => {
      const ly = h * 0.30 + i * h * 0.065;
      ctx.fillStyle = '#888';
      ctx.fillText(label, w * 0.06, ly);
      ctx.fillStyle = '#333';
      ctx.fillText(value, w * 0.06 + w * 0.1, ly);
    });

    // 有效期
    ctx.fillStyle = '#888';
    ctx.font = `${w * 0.018}px sans-serif`;
    ctx.fillText('有效期限 20•• — 20••', w * 0.06, h * 0.68);

    // 底纹水印
    ctx.fillStyle = 'rgba(180,160,140,0.08)';
    ctx.font = `${w * 0.3}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('身份证', w * 0.5, h * 0.65);
  },
};

// ============================================================
// 驾驶证
// ============================================================

const driversLicense: PreviewTemplate = {
  id: 'drivers_license',
  name: '驾驶证',
  description: '驾驶证照片位置效果',
  render: async (ctx, w, h, img) => {
    ctx.fillStyle = '#e8f0f8';
    drawRoundRect(ctx, w * 0.02, h * 0.02, w * 0.96, h * 0.96, 6);
    ctx.fill();

    // 顶部色条
    ctx.fillStyle = '#1a5276';
    ctx.fillRect(w * 0.02, h * 0.02, w * 0.96, h * 0.06);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${w * 0.03}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('中华人民共和国机动车驾驶证', w * 0.5, h * 0.068);

    // 照片（左侧）
    const photoW = w * 0.22;
    const photoH = photoW / (img.naturalWidth / img.naturalHeight || PHOTO_RATIO);
    const photoX = w * 0.06;
    const photoY = h * 0.14;

    ctx.fillStyle = '#dce8f0';
    ctx.fillRect(photoX, photoY, photoW, photoH);
    ctx.save();
    ctx.beginPath();
    ctx.rect(photoX, photoY, photoW, photoH);
    ctx.clip();
    const s = Math.max(photoW / img.naturalWidth, photoH / img.naturalHeight);
    ctx.drawImage(img, photoX + (photoW - img.naturalWidth * s) / 2, photoY + (photoH - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
    ctx.restore();

    // 信息
    ctx.textAlign = 'left';
    const info = [
      ['姓名', '••••••'],
      ['性别', '•'],
      ['国籍', '中国'],
      ['住址', '••••••••••••'],
      ['初次领证', '20••—••—••'],
      ['准驾车型', 'C1'],
    ];
    ctx.font = `${w * 0.02}px sans-serif`;
    info.forEach(([label, value], i) => {
      const ly = h * 0.15 + i * h * 0.055;
      ctx.fillStyle = '#666';
      ctx.fillText(label, w * 0.33, ly);
      ctx.fillStyle = '#333';
      ctx.font = `${w * 0.022}px sans-serif`;
      ctx.fillText(value, w * 0.33, ly + h * 0.025);
      ctx.font = `${w * 0.02}px sans-serif`;
    });

    // 编号
    ctx.fillStyle = '#999';
    ctx.font = `${w * 0.018}px sans-serif`;
    ctx.fillText('证号 110•••••••••••', w * 0.33, h * 0.78);
  },
};

// ============================================================
// 签证页（申根/美签风格）
// ============================================================

const visa: PreviewTemplate = {
  id: 'visa',
  name: '签证页',
  description: '签证页上照片位置效果',
  render: async (ctx, w, h, img) => {
    // 护照内页底色
    ctx.fillStyle = '#f0ebe4';
    ctx.fillRect(0, 0, w, h);

    // 底纹
    for (let i = 0; i < 50; i++) {
      ctx.fillStyle = `rgba(200,180,160,${0.02 + Math.random() * 0.04})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, Math.random() * 60 + 10, 1);
    }

    // 签证贴纸背景
    const sx = w * 0.08;
    const sy = h * 0.08;
    const sw2 = w * 0.84;
    const sh2 = h * 0.84;

    ctx.shadowColor = 'rgba(0,0,0,0.1)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#f5f0e8';
    drawRoundRect(ctx, sx, sy, sw2, sh2, 3);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 装饰边框
    ctx.strokeStyle = '#c0b090';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    drawRoundRect(ctx, sx + 8, sy + 8, sw2 - 16, sh2 - 16, 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 标题
    ctx.fillStyle = '#2c3e50';
    ctx.font = `bold ${w * 0.04}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('VISA', w / 2, h * 0.18);

    ctx.fillStyle = '#888';
    ctx.font = `${w * 0.023}px sans-serif`;
    ctx.fillText('Schengen States', w / 2, h * 0.23);

    // 照片（右上角）
    const photoW = w * 0.2;
    const photoH = photoW / (img.naturalWidth / img.naturalHeight || PHOTO_RATIO);
    const photoX = w * 0.72;
    const photoY = h * 0.28;

    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(photoX, photoY, photoW, photoH);

    // 照片外的白色边框（签证上照片通常有）
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(photoX, photoY, photoW, photoH);

    ctx.save();
    ctx.beginPath();
    ctx.rect(photoX, photoY, photoW, photoH);
    ctx.clip();
    const s = Math.max(photoW / img.naturalWidth, photoH / img.naturalHeight);
    ctx.drawImage(img, photoX + (photoW - img.naturalWidth * s) / 2, photoY + (photoH - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
    ctx.restore();

    // 信息字段
    ctx.textAlign = 'left';
    ctx.font = `${w * 0.017}px sans-serif`;
    const vFields = [
      ['VALID FOR', 'SCHENGEN STATES'],
      ['FROM', '•• ••• ••••'],
      ['UNTIL', '•• ••• ••••'],
      ['TYPE', 'C'],
      ['ENTRIES', 'MULT'],
      ['DURATION', '90 DAYS'],
      ['ISSUED IN', '••••••'],
      ['PASSPORT No.', 'P•••••••'],
    ];
    ctx.fillStyle = '#c00';
    vFields.forEach(([label, value], i) => {
      const ly = h * 0.33 + i * h * 0.06;
      ctx.fillStyle = '#666';
      ctx.font = `bold ${w * 0.016}px sans-serif`;
      ctx.fillText(label, w * 0.13, ly);
      ctx.fillStyle = '#333';
      ctx.font = `${w * 0.02}px sans-serif`;
      ctx.fillText(value, w * 0.13, ly + h * 0.025);
    });

    // 底部背景图案
    ctx.fillStyle = 'rgba(180,150,120,0.06)';
    ctx.font = `${w * 0.15}px serif`;
    ctx.textAlign = 'center';
    ctx.fillText('✦', w / 2, h * 0.72);
  },
};

// ============================================================
// 美国签证（方型51x51mm照片）
// ============================================================

const usVisa: PreviewTemplate = {
  id: 'us_visa',
  name: '美国签证',
  description: '美国签证照片位置效果',
  render: async (ctx, w, h, img) => {
    ctx.fillStyle = '#f5f0e8';
    ctx.fillRect(0, 0, w, h);

    // 签证贴纸
    const sx = w * 0.06;
    const sy = h * 0.06;
    const sw2 = w * 0.88;
    const sh2 = h * 0.88;

    ctx.shadowColor = 'rgba(0,0,0,0.1)';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#fefefe';
    drawRoundRect(ctx, sx, sy, sw2, sh2, 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 边框
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    drawRoundRect(ctx, sx + 4, sy + 4, sw2 - 8, sh2 - 8, 1);
    ctx.stroke();

    // 标题
    ctx.fillStyle = '#2563eb';
    ctx.font = `bold ${w * 0.038}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('UNITED STATES OF AMERICA', w / 2, h * 0.16);

    // 照片（方形，51×51）
    const photoSize = w * 0.22;
    const photoX = w * 0.68;
    const photoY = h * 0.22;

    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(photoX, photoY, photoSize, photoSize);
    ctx.save();
    ctx.beginPath();
    ctx.rect(photoX, photoY, photoSize, photoSize);
    ctx.clip();
    const s = Math.max(photoSize / img.naturalWidth, photoSize / img.naturalHeight);
    ctx.drawImage(img, photoX + (photoSize - img.naturalWidth * s) / 2, photoY + (photoSize - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
    ctx.restore();

    // 信息
    ctx.textAlign = 'left';
    ctx.fillStyle = '#333';
    ctx.font = `${w * 0.022}px sans-serif`;
    const fields = [
      'Surname: ••••••••',
      'Given Name: ••••••••',
      'Passport No: •••••••',
      'Nationality: CHN',
      'Entries: M',
      'Issued: •• ••• ••••',
    ];
    fields.forEach((field, i) => {
      ctx.fillText(field, w * 0.1, h * 0.28 + i * h * 0.055);
    });

    // 底部水印
    ctx.fillStyle = 'rgba(37,99,235,0.04)';
    ctx.font = `bold ${w * 0.18}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('USA', w / 2, h * 0.82);
  },
};

// ============================================================
// 求职简历 — 照片在简历左/右上方的效果
// ============================================================

const resume: PreviewTemplate = {
  id: 'resume',
  name: '求职简历',
  description: '简历上的头像位置效果',
  render: async (ctx, w, h, img) => {
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, w, h);

    // 左侧深色条
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, w * 0.32, h);

    // 圆形/圆角头像
    const photoSize = w * 0.2;
    const cx = w * 0.16;
    const cy = h * 0.18;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, photoSize / 2, 0, Math.PI * 2);
    ctx.clip();
    const s = Math.max(photoSize / img.naturalWidth, photoSize / img.naturalHeight);
    ctx.drawImage(img, cx - img.naturalWidth * s / 2, cy - img.naturalHeight * s / 2, img.naturalWidth * s, img.naturalHeight * s);
    ctx.restore();

    // 头像边框
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, photoSize / 2 + 1, 0, Math.PI * 2);
    ctx.stroke();

    // 左侧占位信息
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = `${w * 0.035}px sans-serif`;
    ctx.fillText('姓 名', cx, h * 0.35);
    ctx.fillStyle = '#fff';
    ctx.font = `${w * 0.04}px sans-serif`;
    ctx.fillText('••••••', cx, h * 0.40);

    const leftItems = ['📞 电话', '✉️ 邮箱', '📍 地址'];
    leftItems.forEach((item, i) => {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = `${w * 0.02}px sans-serif`;
      ctx.fillText(item, cx, h * 0.50 + i * h * 0.05);
    });

    // 右侧内容占位
    ctx.textAlign = 'left';
    ctx.fillStyle = '#333';
    ctx.font = `bold ${w * 0.028}px sans-serif`;
    ctx.fillText('工作经历', w * 0.38, h * 0.12);

    ctx.fillStyle = '#ccc';
    ctx.font = `${w * 0.02}px sans-serif`;
    const lines = [
      '————————————————————————————',
      '• 工作内容描述 •••••••••••••',
      '• 项目经验 •••••••••••••••••',
      '',
      '教育背景',
      '————————————————————————————',
      '• 学校名称 • 专业 • 学位',
    ];
    lines.forEach((line, i) => {
      if (line === '教育背景') {
        ctx.fillStyle = '#333';
        ctx.font = `bold ${w * 0.025}px sans-serif`;
      } else {
        ctx.fillStyle = '#ccc';
        ctx.font = `${w * 0.02}px sans-serif`;
      }
      ctx.fillText(line, w * 0.38, h * 0.20 + i * h * 0.04);
    });
  },
};

// ============================================================
// 结婚证
// ============================================================

const marriage: PreviewTemplate = {
  id: 'marriage',
  name: '结婚证',
  description: '结婚证双人合影位置效果',
  render: async (ctx, w, h, img) => {
    ctx.fillStyle = '#8b0000';
    ctx.fillRect(0, 0, w, h);

    // 金色装饰框
    ctx.strokeStyle = '#c5a55a';
    ctx.lineWidth = 3;
    drawRoundRect(ctx, w * 0.04, h * 0.04, w * 0.92, h * 0.92, 4);
    ctx.stroke();

    ctx.strokeStyle = '#d4b96a';
    ctx.lineWidth = 1;
    drawRoundRect(ctx, w * 0.06, h * 0.06, w * 0.88, h * 0.88, 3);
    ctx.stroke();

    // 标题
    ctx.fillStyle = '#c5a55a';
    ctx.font = `bold ${w * 0.06}px serif`;
    ctx.textAlign = 'center';
    ctx.fillText('结 婚 证', w / 2, h * 0.15);

    // 双人照片区域（结婚证是合影）
    const photoW = w * 0.4;
    const photoH = photoW / (img.naturalWidth / img.naturalHeight || PHOTO_RATIO);
    const photoX = (w - photoW) / 2;
    const photoY = h * 0.22;

    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 4;
    ctx.fillStyle = '#fff';
    ctx.fillRect(photoX - 2, photoY - 2, photoW + 4, photoH + 4);
    ctx.shadowBlur = 0;

    ctx.save();
    ctx.beginPath();
    ctx.rect(photoX, photoY, photoW, photoH);
    ctx.clip();
    const s = Math.max(photoW / img.naturalWidth, photoH / img.naturalHeight);
    ctx.drawImage(img, photoX + (photoW - img.naturalWidth * s) / 2, photoY + (photoH - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
    ctx.restore();

    // 文字
    ctx.fillStyle = '#c5a55a';
    ctx.font = `${w * 0.028}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('持 证 人 •••••', w / 2, h * 0.80);
    ctx.fillText('登记日期 20••年••月••日', w / 2, h * 0.88);
  },
};

// ============================================================
// 工牌/工作证
// ============================================================

const badge: PreviewTemplate = {
  id: 'badge',
  name: '工牌',
  description: '工牌照片位置效果',
  render: async (ctx, w, h, img) => {
    // 背景
    ctx.fillStyle = '#f0ece8';
    ctx.fillRect(0, 0, w, h);

    // 卡片
    const cw = w * 0.6;
    const ch = h * 0.85;
    const cx = (w - cw) / 2;
    const cy = (h - ch) / 2;

    ctx.shadowColor = 'rgba(0,0,0,0.1)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#fff';
    drawRoundRect(ctx, cx, cy, cw, ch, 8);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 顶条
    const barH = ch * 0.18;
    ctx.fillStyle = '#2563eb';
    drawRoundRect(ctx, cx, cy, cw, barH, 8);
    ctx.fill();
    // 覆盖底部圆角为直角
    ctx.fillRect(cx, cy + 8, cw, barH - 8);

    // 公司名
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${cw * 0.08}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('一 拍 即 合', cx + cw / 2, cy + barH * 0.55);

    // 照片
    const photoW = cw * 0.32;
    const photoH = photoW / (img.naturalWidth / img.naturalHeight || PHOTO_RATIO);
    const photoX = cx + (cw - photoW) / 2;
    const photoY = cy + barH + (ch - barH - photoH) * 0.3;

    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(photoX, photoY, photoW, photoH);
    ctx.save();
    ctx.beginPath();
    ctx.rect(photoX, photoY, photoW, photoH);
    ctx.clip();
    const s = Math.max(photoW / img.naturalWidth, photoH / img.naturalHeight);
    ctx.drawImage(img, photoX + (photoW - img.naturalWidth * s) / 2, photoY + (photoH - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
    ctx.restore();

    // 信息
    ctx.textAlign = 'center';
    ctx.fillStyle = '#555';
    ctx.font = `${cw * 0.048}px sans-serif`;
    ctx.fillText('••••••••', cx + cw / 2, photoY + photoH + ch * 0.07);
    ctx.fillStyle = '#999';
    ctx.font = `${cw * 0.035}px sans-serif`;
    ctx.fillText('••• 部 门', cx + cw / 2, photoY + photoH + ch * 0.13);
  },
};

// ============================================================
// 场景映射
// ============================================================

const SCENE_MAP: Record<string, PreviewTemplate> = {
  passport: passport,
  idcard: idCard,
  drivers_license: driversLicense,
  residence_permit: idCard,
  social_security: idCard,
  us_visa: usVisa,
  schengen_visa: visa,
  japan_visa: visa,
  uk_visa: visa,
  resume: resume,
  linkedin: resume,
  kaoyan: passport,
  teacher_cert: idCard,
  civil_service: passport,
  college_english: idCard,
  marriage: marriage,
  military: badge,
};

export function getTemplateForScene(sceneId: string): PreviewTemplate | null {
  return SCENE_MAP[sceneId] || badge;
}
