'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { TEMPLATES, renderTemplate } from '@/lib/preview-templates';

interface PreviewTemplatesProps {
  personBlob: Blob | null;
  /** 预览图片 URL（没有 personBlob 时降级用）*/
  fallbackUrl: string | null;
}

export default function PreviewTemplates({ personBlob, fallbackUrl }: PreviewTemplatesProps) {
  const [selectedTemplate, setSelectedTemplate] = useState('plain');
  const [rendering, setRendering] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeBlob = personBlob || (fallbackUrl ? null : null);

  const renderPreview = useCallback(
    async (templateId: string) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (!personBlob) return;

      setRendering(true);
      try {
        const container = containerRef.current;
        if (container) {
          canvas.width = container.clientWidth;
          canvas.height = Math.round(canvas.width * 0.7);
        }
        await renderTemplate(templateId, canvas, personBlob);
      } catch (err) {
        console.error('模板渲染失败:', err);
      } finally {
        setRendering(false);
      }
    },
    [personBlob],
  );

  // 切换模板或 personBlob 变化时重新渲染
  useEffect(() => {
    if (personBlob) renderPreview(selectedTemplate);
  }, [selectedTemplate, personBlob, renderPreview]);

  // 容器尺寸变化时重新渲染
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !personBlob) return;

    const observer = new ResizeObserver(() => {
      renderPreview(selectedTemplate);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [selectedTemplate, personBlob, renderPreview]);

  if (!personBlob) return null;

  return (
    <div className="space-y-4">
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
      <div ref={containerRef} className="relative bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
        <canvas
          ref={canvasRef}
          className="w-full h-auto"
          style={{ imageRendering: 'auto' }}
        />
        {rendering && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50">
            <svg className="animate-spin w-6 h-6 text-brand-500" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center">
        {TEMPLATES.find((t) => t.id === selectedTemplate)?.description || ''}
      </p>
    </div>
  );
}
