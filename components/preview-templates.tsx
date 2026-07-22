'use client';

import { useRef, useEffect, useState } from 'react';
import { getTemplateForScene } from '@/lib/preview-templates';
import type { SceneConfig } from '@/lib/scenes';

interface PreviewTemplatesProps {
  previewUrl: string | null;
  scene?: SceneConfig | null;
}

export default function PreviewTemplates({ previewUrl, scene = null }: PreviewTemplatesProps) {
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  if (!canvasRef.current && typeof document !== 'undefined') {
    canvasRef.current = document.createElement('canvas');
  }

  useEffect(() => {
    if (!previewUrl || !canvasRef.current || !scene) return;

    const tpl = getTemplateForScene(scene.id);
    if (!tpl) return;

    const img = new Image();
    img.onload = async () => {
      const canvas = canvasRef.current!;
      canvas.width = 600;
      canvas.height = 420;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, 600, 420);
      try {
        await tpl.render(ctx, 600, 420, img);
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
  }, [previewUrl, scene]);

  if (!previewUrl || !scene) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
        <span>🎭</span>
        {scene.name} · 效果预览
      </h3>

      <div className="relative bg-gray-100 rounded-xl overflow-hidden border border-gray-200 aspect-[10/7] flex items-center justify-center">
        {resultUrl ? (
          <img src={resultUrl} alt="场景预览" className="w-full h-full object-contain" />
        ) : (
          <div className="text-sm text-gray-400">渲染中...</div>
        )}
      </div>
    </div>
  );
}
