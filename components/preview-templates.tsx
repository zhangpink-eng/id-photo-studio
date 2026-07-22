'use client';

import { useRef, useEffect, useState } from 'react';
import { TEMPLATES } from '@/lib/preview-templates';
import type { SceneConfig } from '@/lib/scenes';

interface PreviewTemplatesProps {
  previewUrl: string | null;
  scene?: SceneConfig | null;
}

/** 场景ID → 模板ID 映射 */
function pickTemplate(scene: SceneConfig | null) {
  if (!scene) return null;
  // 按场景分类选择对应模板
  if (scene.id === 'idcard' || scene.id === 'drivers_license' || scene.id === 'social_security') {
    return TEMPLATES.find((t) => t.id === 'frame') || null;
  }
  if (scene.id === 'badge' || scene.category === '求职招聘') {
    return TEMPLATES.find((t) => t.id === 'badge') || null;
  }
  if (scene.category === '出国签证' || scene.id === 'passport') {
    return TEMPLATES.find((t) => t.id === 'frame') || null;
  }
  // 默认相框效果
  return TEMPLATES.find((t) => t.id === 'frame') || null;
}

export default function PreviewTemplates({ previewUrl, scene = null }: PreviewTemplatesProps) {
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const template = pickTemplate(scene);

  if (!canvasRef.current && typeof document !== 'undefined') {
    canvasRef.current = document.createElement('canvas');
  }

  useEffect(() => {
    if (!previewUrl || !canvasRef.current || !template) return;

    const img = new Image();
    img.onload = async () => {
      const canvas = canvasRef.current!;
      canvas.width = 600;
      canvas.height = 420;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, 600, 420);
      try {
        await template.render(ctx, 600, 420, img);
        canvas.toBlob((blob) => {
          if (blob) {
            setResultUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return URL.createObjectURL(blob);
            });
          }
        });
      } catch (e) {
        console.error(e);
      }
    };
    img.src = previewUrl;
  }, [previewUrl, template]);

  if (!previewUrl || !scene || !template) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
        <span>🎭</span>
        {scene.icon} {scene.name} · 效果预览
      </h3>

      <div className="relative bg-gray-100 rounded-xl overflow-hidden border border-gray-200 aspect-[10/7] flex items-center justify-center">
        {resultUrl ? (
          <img src={resultUrl} alt="场景预览" className="w-full h-full object-contain" />
        ) : (
          <div className="text-sm text-gray-400">渲染中...</div>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center">{template.description}</p>
    </div>
  );
}
