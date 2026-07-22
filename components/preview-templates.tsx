'use client';

import { useRef, useEffect } from 'react';
import type { SceneConfig } from '@/lib/scenes';
import { PHOTO_SIZES } from '@/lib/constants';

interface PreviewTemplatesProps {
  /** 抠图后的人像 Blob（透明 PNG，用于检测人像边界） */
  personBlob: Blob | null;
  scene?: SceneConfig | null;
}

/**
 * 在原始照片上叠加证件照标准尺寸框 + 头部占比检测
 * 让用户看到：我拍的照片，头部在框里占百分之多少
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
      const cw = container.clientWidth;
      if (cw === 0) return;

      const ch = Math.round(cw * (img.naturalHeight / img.naturalWidth));
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d')!;

      // 1. 绘制原始照片
      ctx.drawImage(img, 0, 0, cw, ch);

      // 2. 检测人像边界
      const imageData = ctx.getImageData(0, 0, cw, ch);
      const data = imageData.data;
      let top = -1, bottom = -1;
      for (let y = 0; y < ch && top === -1; y++)
        for (let x = 0; x < cw; x++)
          if (data[(y * cw + x) * 4 + 3] > 128) { top = y; break; }
      for (let y = ch - 1; y >= 0 && bottom === -1; y--)
        for (let x = 0; x < cw; x++)
          if (data[(y * cw + x) * 4 + 3] > 128) { bottom = y; break; }

      // 3. 画目标证件照尺寸框
      const sceneSize = PHOTO_SIZES.find((s) => s.id === scene.sizeId);
      const ratio = sceneSize ? sceneSize.widthMm / sceneSize.heightMm : 0.7;
      const boxW = Math.round(cw * 0.75);
      const boxH = Math.round(boxW / ratio);
      const boxX = (cw - boxW) / 2;
      const boxY = (ch - boxH) / 2;

      // 框外半透明遮罩（让框更突出）
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(0, 0, cw, boxY);
      ctx.fillRect(0, boxY + boxH, cw, ch - boxY - boxH);
      ctx.fillRect(0, boxY, boxX, boxH);
      ctx.fillRect(boxX + boxW, boxY, cw - boxX - boxW, boxH);

      // 蓝色虚线框
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(boxX, boxY, boxW, boxH);
      ctx.setLineDash([]);

      // 框上方：目标尺寸标注
      const fs = Math.max(11, Math.round(cw * 0.025));
      ctx.fillStyle = '#3b82f6';
      ctx.font = `bold ${fs}px sans-serif`;
      ctx.textAlign = 'left';
      const targetLabel = sceneSize
        ? `${scene.name} · ${sceneSize.widthMm}×${sceneSize.heightMm}mm`
        : scene.name;
      ctx.fillText(targetLabel, boxX, boxY - 8);

      // 4. 头部占比
      if (top !== -1 && bottom !== -1) {
        const headRatio = (bottom - top) / boxH;
        const isOk = headRatio >= scene.headRatio.min && headRatio <= scene.headRatio.max;

        // 百分比标签
        const label = `头部占比 ${Math.round(headRatio * 100)}%`;
        const fs2 = Math.max(14, Math.round(cw * 0.032));
        ctx.font = `bold ${fs2}px sans-serif`;
        const m = ctx.measureText(label);
        const pad = 8;
        const lx = boxX + 6;
        const ly = boxY + 6;

        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(lx, ly, m.width + pad * 2, fs2 + pad * 2);
        ctx.fillStyle = '#fff';
        ctx.fillText(label, lx + pad, ly + fs2 + pad - 1);

        // 状态
        const status = isOk ? '✅ 符合要求' : `⚠️ 需要调整 (${Math.round(scene.headRatio.min * 100)}%-${Math.round(scene.headRatio.max * 100)}%)`;
        ctx.font = `bold ${Math.max(12, Math.round(cw * 0.028))}px sans-serif`;
        ctx.textAlign = 'right';
        ctx.fillStyle = isOk ? '#16a34a' : '#dc2626';
        ctx.fillText(status, boxX + boxW - 6, ly + fs2 + pad - 1);

        // 标准范围
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.font = `${Math.max(10, Math.round(cw * 0.02))}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(`标准 ${Math.round(scene.headRatio.min * 100)}%-${Math.round(scene.headRatio.max * 100)}%`, boxX + 6, boxY + boxH - 5);
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
        蓝色虚线框为 {scene.name} 标准尺寸，检测头部在框内的占比
      </p>
    </div>
  );
}
