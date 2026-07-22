'use client';

import { useEffect, useState, useRef } from 'react';
import type { SceneConfig } from '@/lib/scenes';
import { PHOTO_SIZES } from '@/lib/constants';

interface PreviewTemplatesProps {
  personBlob: Blob | null;
  scene?: SceneConfig | null;
}

/**
 * 头部占比检测 — 从透明人像自动计算头部在证件照框中的占比
 */
export default function PreviewTemplates({ personBlob, scene = null }: PreviewTemplatesProps) {
  const [headRatio, setHeadRatio] = useState<number | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!personBlob || !scene) { setHeadRatio(null); doneRef.current = false; return; }
    if (doneRef.current) return;
    doneRef.current = true;

    const blobUrl = URL.createObjectURL(personBlob);
    const img = new Image();
    img.onload = () => {
      const iw = img.naturalWidth, ih = img.naturalHeight;
      if (iw === 0 || ih === 0) { URL.revokeObjectURL(blobUrl); return; }

      const canvas = document.createElement('canvas');
      canvas.width = iw; canvas.height = ih;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, iw, ih).data;

      let top = -1, bottom = -1;
      for (let y = 0; y < ih && top === -1; y++)
        for (let x = 0; x < iw; x++)
          if (data[(y * iw + x) * 4 + 3] > 128) { top = y; break; }
      for (let y = ih - 1; y >= 0 && bottom === -1; y--)
        for (let x = 0; x < iw; x++)
          if (data[(y * iw + x) * 4 + 3] > 128) { bottom = y; break; }

      if (top !== -1 && bottom !== -1) {
        const sz = PHOTO_SIZES.find((s) => s.id === scene.sizeId);
        const rt = sz ? sz.widthMm / sz.heightMm : 0.7;
        const headPct = (bottom - top) / ih;
        const inFrame = Math.min(99, Math.round(headPct * (ih / iw) * (1 / rt) * 100));
        setHeadRatio(inFrame);
      }
      URL.revokeObjectURL(blobUrl);
    };
    img.src = blobUrl;
    return () => { doneRef.current = false; };
  }, [personBlob, scene]);

  if (!personBlob || !scene) return null;
  const sceneSize = PHOTO_SIZES.find((s) => s.id === scene.sizeId);
  const isOk = headRatio !== null && headRatio >= scene.headRatio.min * 100 && headRatio <= scene.headRatio.max * 100;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-700">📐 头部占比检测</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
          <div className="text-xs text-gray-400 mb-0.5">头部占比</div>
          <div className="text-2xl font-bold text-gray-800">
            {headRatio !== null ? `${headRatio}%` : '计算中...'}
          </div>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
          <div className="text-xs text-gray-400 mb-0.5">{scene.name} 标准</div>
          <div className="text-2xl font-bold text-gray-800">
            {Math.round(scene.headRatio.min * 100)}%–{Math.round(scene.headRatio.max * 100)}%
          </div>
          {headRatio !== null && (
            <div className={`text-xs font-medium mt-1 ${isOk ? 'text-green-600' : 'text-red-500'}`}>
              {isOk ? '✅ 符合要求' : `⚠️ 当前 ${headRatio}%，${headRatio < scene.headRatio.min * 100 ? '偏小' : '偏大'}`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
