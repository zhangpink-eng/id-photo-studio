'use client';

import { useRef, useEffect } from 'react';
import type { SceneConfig } from '@/lib/scenes';

interface PreviewTemplatesProps {
  previewUrl: string | null;
  scene?: SceneConfig | null;
}

/**
 * 头部占比参考 — 在成品照片上叠加头部占比参考线
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
      const cw = container.clientWidth;
      if (cw === 0) return;

      // 保持照片比例，宽度撑满
      const aspect = img.naturalHeight / img.naturalWidth;
      const ch = Math.round(cw * aspect);

      canvas.width = cw;
      canvas.height = ch;
      canvas.style.width = `${cw}px`;
      canvas.style.height = `${ch}px`;

      const ctx = canvas.getContext('2d')!;

      // 绘制照片（填满画布，保持比例）
      ctx.drawImage(img, 0, 0, cw, ch);

      const w = cw;
      const h = ch;

      // 头部占比参考线
      const minY = h * (1 - scene.headRatio.max);
      const maxY = h * (1 - scene.headRatio.min);

      // 头部区间半透明底色
      ctx.fillStyle = 'rgba(59,130,246,0.06)';
      ctx.fillRect(0, minY, w, maxY - minY);

      // 上限线
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(0, minY);
      ctx.lineTo(w, minY);
      ctx.stroke();
      ctx.setLineDash([]);

      // 上限标签
      ctx.fillStyle = '#3b82f6';
      ctx.font = `bold ${Math.max(12, Math.round(w * 0.025))}px sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText(`头部 ≤ ${Math.round(scene.headRatio.max * 100)}%`, w - 8, minY - 6);

      // 下限线
      ctx.strokeStyle = 'rgba(59,130,246,0.35)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(0, maxY);
      ctx.lineTo(w, maxY);
      ctx.stroke();
      ctx.setLineDash([]);

      // 下限标签
      ctx.fillStyle = 'rgba(59,130,246,0.55)';
      ctx.font = `${Math.max(11, Math.round(w * 0.022))}px sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText(`头部 ≥ ${Math.round(scene.headRatio.min * 100)}%`, w - 8, maxY - 5);

      // 场景名
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.font = `11px sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(scene.name, 8, 16);
    };
    img.src = previewUrl;
  }, [previewUrl, scene]);

  if (!previewUrl || !scene) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
        <span>📐</span>
        头部占比参考线
      </h3>

      <div ref={containerRef} className="bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
        <canvas ref={canvasRef} className="w-full" />
      </div>

      <p className="text-xs text-gray-400">
        {scene.name}要求头部占比 {Math.round(scene.headRatio.min * 100)}%-{Math.round(scene.headRatio.max * 100)}%
      </p>
    </div>
  );
}
