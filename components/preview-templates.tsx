'use client';

import { useRef, useEffect, useState } from 'react';
import type { SceneConfig } from '@/lib/scenes';

interface PreviewTemplatesProps {
  previewUrl: string | null;
  scene?: SceneConfig | null;
}

/**
 * 场景尺寸预览 — 把照片放在实际证件尺寸的框里，
 * 加上头部占比参考线，让用户直观判断是否合适。
 * 不画假证件，只展示真实可验证的尺寸信息。
 */
export default function PreviewTemplates({ previewUrl, scene = null }: PreviewTemplatesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!previewUrl || !canvasRef.current || !scene || !containerRef.current) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;

    const img = new Image();
    img.onload = () => {
      const containerW = container.clientWidth;
      if (containerW === 0) return;

      // 用 300DPI 还原真实尺寸比例
      // 证件的真实显示比例 = widthMm : heightMm
      // 我们找一个基准：在 400px 宽度下按比例缩放
      const baseW = 400;
      const baseH = baseW * (scene.headRatio.max || 0.7) * 1.4; // 留出上下空间

      canvas.width = containerW;
      canvas.height = Math.round(containerW * (baseH / baseW));
      const ctx = canvas.getContext('2d')!;

      const cw = canvas.width;
      const ch = canvas.height;

      // 底色
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(0, 0, cw, ch);

      // === 证件照尺寸框 ===
      // 用场景尺寸按 300DPI 转像素
      const mmToPx = (mm: number) => Math.round(mm / 25.4 * 300 * (cw / 600));
      const frameW = mmToPx(scene.headRatio.max * 80); // 视觉宽度
      const frameH = mmToPx(scene.headRatio.max * 100); // 视觉高度
      const frameX = (cw - frameW) / 2;
      const frameY = (ch - frameH) / 2;

      // 阴影
      ctx.shadowColor = 'rgba(0,0,0,0.08)';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(frameX, frameY, frameW, frameH, 4);
      ctx.fill();
      ctx.shadowBlur = 0;

      // 照片区域（占满证件框）
      const innerPad = 2;
      const photoX = frameX + innerPad;
      const photoY = frameY + innerPad;
      const photoW = frameW - innerPad * 2;
      const photoH = frameH - innerPad * 2;

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(photoX, photoY, photoW, photoH, 2);
      ctx.clip();

      // 绘制照片（cover 模式铺满）
      const scale = Math.max(photoW / img.naturalWidth, photoH / img.naturalHeight);
      const dx = photoX + (photoW - img.naturalWidth * scale) / 2;
      const dy = photoY + (photoH - img.naturalHeight * scale) / 2;
      ctx.drawImage(img, dx, dy, img.naturalWidth * scale, img.naturalHeight * scale);
      ctx.restore();

      // === 头部占比参考线 ===
      // 从底部往上画一根横线，表示头部在框内占的比例
      const headLineY = photoY + photoH * (1 - scene.headRatio.max);
      ctx.strokeStyle = 'rgba(59,130,246,0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(photoX + 4, headLineY);
      ctx.lineTo(photoX + photoW - 4, headLineY);
      ctx.stroke();
      ctx.setLineDash([]);

      // 头部占比文字
      ctx.fillStyle = 'rgba(59,130,246,0.7)';
      ctx.font = `11px sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(
        `头部占比 ≤ ${Math.round(scene.headRatio.max * 100)}%`,
        photoX + 6,
        headLineY - 4,
      );

      // 底部黑色虚线框 — 表示头部最小占比
      const headMinY = photoY + photoH * (1 - scene.headRatio.min);
      ctx.strokeStyle = 'rgba(59,130,246,0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(photoX + 4, headMinY);
      ctx.lineTo(photoX + photoW - 4, headMinY);
      ctx.stroke();
      ctx.setLineDash([]);

      // === 场景信息角标 ===
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.font = `10px sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(`${scene.name} · 头部 ${Math.round(scene.headRatio.min * 100)}%-${Math.round(scene.headRatio.max * 100)}%`, 8, ch - 6);
    };
    img.src = previewUrl;
  }, [previewUrl, scene]);

  if (!previewUrl || !scene) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
        <span>📐</span>
        尺寸比例参考
      </h3>

      <div ref={containerRef} className="relative bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
        <canvas ref={canvasRef} className="w-full" />
      </div>

      <p className="text-xs text-gray-400">
        白色区域为证件照边界，蓝线为头部占比上限参考
      </p>
    </div>
  );
}
