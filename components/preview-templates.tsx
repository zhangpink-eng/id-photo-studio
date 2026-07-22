'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { TEMPLATES, renderTemplate } from '@/lib/preview-templates';

interface PreviewTemplatesProps {
  /** 成品预览 URL（blob: URL，带背景色的最终效果） */
  previewUrl: string | null;
}

export default function PreviewTemplates({ previewUrl }: PreviewTemplatesProps) {
  const [selectedTemplate, setSelectedTemplate] = useState('plain');
  const [rendering, setRendering] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /** 图片元素 ref — 用同一个 img 对象，避免重复加载 */
  const imgRef = useRef<HTMLImageElement | null>(null);
  const prevUrlRef = useRef<string | null>(null);

  const renderPreview = useCallback(
    async (templateId: string) => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const img = imgRef.current;
      if (!img || !img.complete || img.naturalWidth === 0) return;

      setRendering(true);
      try {
        canvas.width = container.clientWidth;
        canvas.height = Math.round(canvas.width * 0.7);

        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const tpl = TEMPLATES.find((t) => t.id === templateId);
        if (tpl) {
          await tpl.render(ctx, canvas.width, canvas.height, img);
        }
      } catch (err) {
        console.error('模板渲染失败:', err);
      } finally {
        setRendering(false);
      }
    },
    [],
  );

  // previewUrl 变化 → 创建新的 Image
  useEffect(() => {
    if (!previewUrl) { imgRef.current = null; prevUrlRef.current = null; return; }
    if (previewUrl === prevUrlRef.current) return;
    prevUrlRef.current = previewUrl;

    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      renderPreview(selectedTemplate);
    };
    img.src = previewUrl;
  }, [previewUrl, selectedTemplate, renderPreview]);

  // 切换模板时重新渲染
  useEffect(() => {
    if (imgRef.current) renderPreview(selectedTemplate);
  }, [selectedTemplate, renderPreview]);

  // 容器尺寸变化
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      if (imgRef.current) renderPreview(selectedTemplate);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [selectedTemplate, renderPreview]);

  if (!previewUrl) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
        <span>🎭</span>
        场景预览
      </h3>

      {/* 模板选择栏 */}
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
            title={tpl.description}
          >
            <span className="mr-1">{tpl.icon}</span>
            {tpl.name}
          </button>
        ))}
      </div>

      {/* 画布 */}
      <div ref={containerRef} className="relative bg-gray-100 rounded-xl overflow-hidden border border-gray-200 min-h-[120px]">
        <canvas
          ref={canvasRef}
          className="w-full h-auto"
        />
        {rendering && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50">
            <svg className="animate-spin w-6 h-6 text-brand-500" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}
        {!imgRef.current && !rendering && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
            加载中...
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center">
        {TEMPLATES.find((t) => t.id === selectedTemplate)?.description || ''}
      </p>
    </div>
  );
}
