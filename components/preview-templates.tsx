'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { TEMPLATES } from '@/lib/preview-templates';

interface PreviewTemplatesProps {
  previewUrl: string | null;
}

export default function PreviewTemplates({ previewUrl }: PreviewTemplatesProps) {
  const [selectedTemplate, setSelectedTemplate] = useState('plain');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 创建离屏 canvas
  if (!canvasRef.current && typeof document !== 'undefined') {
    canvasRef.current = document.createElement('canvas');
  }

  const doRender = useCallback(async () => {
    if (!previewUrl || !canvasRef.current) return;

    const img = new Image();
    img.onload = async () => {
      const canvas = canvasRef.current!;
      canvas.width = 600;
      canvas.height = 420;

      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, 600, 420);

      const tpl = TEMPLATES.find((t) => t.id === selectedTemplate);
      if (!tpl) return;

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
        console.error('模板渲染失败:', e);
      }
    };
    img.src = previewUrl;
  }, [previewUrl, selectedTemplate]);

  useEffect(() => { doRender(); }, [doRender]);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
        <span>🎭</span>
        场景预览
      </h3>

      <div className="flex flex-wrap gap-1.5">
        {TEMPLATES.map((tpl) => (
          <button
            key={tpl.id}
            onClick={() => setSelectedTemplate(tpl.id)}
            className={`touch-btn px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
              selectedTemplate === tpl.id
                ? 'bg-brand-600 text-white shadow-md border-brand-600'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200'
            }`}
          >
            <span className="mr-1">{tpl.icon}</span>
            {tpl.name}
          </button>
        ))}
      </div>

      <div className="relative bg-gray-100 rounded-xl overflow-hidden border border-gray-200 aspect-[10/7] flex items-center justify-center">
        {resultUrl ? (
          <img src={resultUrl} alt="场景预览" className="w-full h-full object-contain" />
        ) : (
          <div className="text-sm text-gray-400">加载中...</div>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center">
        {TEMPLATES.find((t) => t.id === selectedTemplate)?.description || ''}
      </p>
    </div>
  );
}
