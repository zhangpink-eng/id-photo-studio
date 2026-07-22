'use client';

import { useRef, useEffect } from 'react';
import type { SceneConfig } from '@/lib/scenes';
import { PHOTO_SIZES } from '@/lib/constants';

interface PreviewTemplatesProps {
  personBlob: Blob | null;
  scene?: SceneConfig | null;
}

/**
 * 头部占比检测
 *
 * 把人像按证件照标准宽高比缩放到框内（cover模式，与合成时一致），
 * 框外的部分半透明遮罩，框内就是证件照裁切后的真实效果。
 * 头部占比 = 人像高度 / 框高度，与场景标准对比。
 */
export default function PreviewTemplates({ personBlob, scene = null }: PreviewTemplatesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!personBlob || !canvasRef.current || !containerRef.current || !scene) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    const img = new Image();

    img.onload = () => {
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const cw = container.clientWidth;
      if (cw === 0) return;

      // 画布宽度撑满容器，按原图比例定高
      const ch = Math.round(cw * (ih / iw));
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d')!;

      // === 先画出完整人像（透明区域为黑色背景） ===
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(img, 0, 0, cw, ch);

      // === 计算证件照尺寸框 ===
      const sceneSize = PHOTO_SIZES.find((s) => s.id === scene.sizeId);
      const ratio = sceneSize ? sceneSize.widthMm / sceneSize.heightMm : 0.7;

      // 框的尺寸：cover 模式下，人像填满框，
      // 所以框的比例 = 证件照比例，框的大小 = 人像擦边的大小
      // 用 contain 的逻辑算框：让人像完整可见的情况下尽量大
      const containScale = Math.min(cw / iw, ch / ih);
      const personW = iw * containScale;
      const personH = ih * containScale;

      // 框按证件照比例，宽度和人像宽度相同（cover模式）
      const boxW = personW;
      const boxH = boxW / ratio;
      const boxX = (cw - boxW) / 2;
      const boxY = (ch - boxH) / 2;

      // === 检测人像边界 ===
      const imageData = ctx.getImageData(0, 0, cw, ch);
      const data = imageData.data;
      let top = -1, bottom = -1;
      for (let y = 0; y < ch && top === -1; y++)
        for (let x = 0; x < cw; x++)
          if (data[(y * cw + x) * 4 + 3] > 128) { top = y; break; }
      for (let y = ch - 1; y >= 0 && bottom === -1; y--)
        for (let x = 0; x < cw; x++)
          if (data[(y * cw + x) * 4 + 3] > 128) { bottom = y; break; }

      // === 重新绘制：框内保留人像，框外遮罩 ===
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, cw, ch);

      // 先画人像到框内（cover模式）
      ctx.save();
      ctx.beginPath();
      ctx.rect(boxX, boxY, boxW, boxH);
      ctx.clip();

      // cover: 放大到框完全填满
      const coverScale = Math.max(boxW / iw, boxH / ih);
      const sx = (cw - iw * coverScale) / 2;
      const sy = (ch - ih * coverScale) / 2;
      ctx.drawImage(img, sx, sy, iw * coverScale, ih * coverScale);
      ctx.restore();

      // === 框外半透明遮罩 ===
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, cw, boxY);                     // 上
      ctx.fillRect(0, boxY + boxH, cw, ch - boxY - boxH); // 下
      ctx.fillRect(0, boxY, boxX, boxH);                 // 左
      ctx.fillRect(boxX + boxW, boxY, cw - boxX - boxW, boxH); // 右

      // === 蓝色虚线框 ===
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(boxX, boxY, boxW, boxH);
      ctx.setLineDash([]);

      // === 框上方标注 ===
      const label1 = sceneSize
        ? `${scene.name} · ${sceneSize.widthMm}×${sceneSize.heightMm}mm`
        : scene.name;
      const fs1 = Math.max(11, Math.round(cw * 0.025));
      ctx.fillStyle = '#3b82f6';
      ctx.font = `bold ${fs1}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(label1, boxX, boxY - 8);

      // === 头部占比 ===
      if (top !== -1 && bottom !== -1) {
        const headRatio = (bottom - top) / boxH;
        const isOk = headRatio >= scene.headRatio.min && headRatio <= scene.headRatio.max;

        // 百分比标签
        const label2 = `头部占比 ${Math.round(headRatio * 100)}%`;
        const fs2 = Math.max(14, Math.round(cw * 0.032));
        ctx.font = `bold ${fs2}px sans-serif`;
        const m = ctx.measureText(label2);
        const pad = 8;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(boxX + 6, boxY + 6, m.width + pad * 2, fs2 + pad * 2);
        ctx.fillStyle = '#fff';
        ctx.fillText(label2, boxX + 6 + pad, boxY + 6 + fs2 + pad - 1);

        // 状态
        const status = isOk ? '✅ 符合要求' : `⚠️ 需要调整`;
        ctx.font = `bold ${Math.max(12, Math.round(cw * 0.028))}px sans-serif`;
        ctx.textAlign = 'right';
        ctx.fillStyle = isOk ? '#16a34a' : '#dc2626';
        ctx.fillText(status, boxX + boxW - 6, boxY + 6 + fs2 + pad - 1);

        // 标准范围
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = `${Math.max(10, Math.round(cw * 0.02))}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(`标准 ${Math.round(scene.headRatio.min * 100)}%-${Math.round(scene.headRatio.max * 100)}%`, boxX + 6, boxY + boxH - 6);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('未检测到人像边界', cw / 2, ch / 2);
      }
    };

    const blobUrl = URL.createObjectURL(personBlob);
    img.src = blobUrl;
    return () => URL.revokeObjectURL(blobUrl);
  }, [personBlob, scene]);

  if (!personBlob || !scene) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
        <span>📐</span>
        头部占比检测
      </h3>

      <div ref={containerRef} className="bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
        <canvas ref={canvasRef} className="w-full" />
      </div>

      <p className="text-xs text-gray-400">
        蓝色虚线框为 {scene.name} 裁切边界，头部占比需在 {Math.round(scene.headRatio.min * 100)}%-{Math.round(scene.headRatio.max * 100)}% 之间
      </p>
    </div>
  );
}
