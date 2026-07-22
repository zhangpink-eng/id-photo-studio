'use client';

import { useRef, useEffect } from 'react';
import type { SceneConfig } from '@/lib/scenes';
import { PHOTO_SIZES } from '@/lib/constants';

interface PreviewTemplatesProps {
  previewUrl: string | null;
  scene?: SceneConfig | null;
}

/**
 * 在成品照片上叠加证件照标准尺寸框 + 头部占比数据
 */
export default function PreviewTemplates({ previewUrl, scene = null }: PreviewTemplatesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!previewUrl || !canvasRef.current || !containerRef.current || !scene) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;

    const img = new Image();
    img.onload = () => {
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const cw = container.clientWidth;
      if (cw === 0) return;

      // 保持照片比例
      const aspect = ih / iw;
      canvas.width = cw;
      canvas.height = Math.round(cw * aspect);
      const h = canvas.height;

      const ctx = canvas.getContext('2d')!;

      // 1. 绘制完整照片
      ctx.drawImage(img, 0, 0, cw, h);

      // 2. 检测人像边界（用第一版的方法：找 alpha 通道）
      const imageData = ctx.getImageData(0, 0, cw, h);
      const data = imageData.data;
      let top = -1, bottom = -1;
      for (let y = 0; y < h && top === -1; y++)
        for (let x = 0; x < cw; x++)
          if (data[(y * cw + x) * 4 + 3] > 128) { top = y; break; }
      for (let y = h - 1; y >= 0 && bottom === -1; y--)
        for (let x = 0; x < cw; x++)
          if (data[(y * cw + x) * 4 + 3] > 128) { bottom = y; break; }

      // 3. 画证件照尺寸框（居中，维持目标宽高比）
      // 从场景匹配真实照片尺寸比例
      const sceneSize = PHOTO_SIZES.find((s) => s.id === scene.sizeId);
      const sizeRatio = sceneSize ? sceneSize.widthMm / sceneSize.heightMm : 0.7;
      const boxW = Math.round(cw * 0.75);
      const boxH = Math.round(boxW / sizeRatio);
      const boxX = (cw - boxW) / 2;
      const boxY = (h - boxH) / 2;

      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(boxX, boxY, boxW, boxH);
      ctx.setLineDash([]);

      // 4. 计算头部占比
      if (top !== -1 && bottom !== -1) {
        const headPx = bottom - top;
        const frameHeightPx = boxH;
        const headRatio = headPx / frameHeightPx;

        // 框左上角显示头部占比数据
        ctx.fillStyle = 'rgba(59,130,246,0.9)';
        const fontSize = Math.max(13, Math.round(cw * 0.03));
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'left';

        // 背景标签
        const label = `头部占比 ${Math.round(headRatio * 100)}%`;
        const metrics = ctx.measureText(label);
        const labelPad = 6;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(boxX + 4, boxY + 4, metrics.width + labelPad * 2, fontSize + labelPad * 2);

        ctx.fillStyle = '#3b82f6';
        ctx.fillText(label, boxX + 4 + labelPad, boxY + 4 + fontSize + labelPad);

        // 头部占比是否符合
        const isOk = headRatio >= scene.headRatio.min && headRatio <= scene.headRatio.max;
        ctx.fillStyle = isOk ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)';
        ctx.font = `bold ${Math.max(12, Math.round(cw * 0.028))}px sans-serif`;
        const status = isOk ? '✅ 符合要求' : '⚠️ 超出范围';
        ctx.textAlign = 'right';
        ctx.fillText(status, boxX + boxW - 8, boxY + fontSize + labelPad + 4);

        // 场景要求值
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.font = `${Math.max(10, Math.round(cw * 0.022))}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(
          `${scene.name} 标准: ${Math.round(scene.headRatio.min * 100)}%-${Math.round(scene.headRatio.max * 100)}%`,
          boxX + 4,
          boxY - 6,
        );
      }
    };
    img.src = previewUrl;
  }, [previewUrl, scene]);

  if (!previewUrl || !scene) return null;

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
        蓝色虚线框为证件照标准边界，检测头部在框内的占比
      </p>
    </div>
  );
}
