'use client';

import { useState, useCallback } from 'react';
import {
  checkCompliance,
  getOverallStatus,
  type CheckResult,
} from '@/lib/compliance-check';

interface CompliancePanelProps {
  /** 预览图片 URL（用于提取 ImageData 进行分析） */
  previewUrl: string | null;
  /** 目标场景名称（可选） */
  sceneName?: string;
  /** 目标最小尺寸（可选） */
  minSize?: { width: number; height: number };
}

/** 从 URL 加载图片并提取 ImageData */
async function getImageDataFromUrl(url: string): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // 缩小到最长边 1200px 做分析就够了
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      const MAX = 1200;
      if (w > MAX || h > MAX) {
        const ratio = MAX / Math.max(w, h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(ctx.getImageData(0, 0, w, h));
    };
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = url;
  });
}

export default function CompliancePanel({
  previewUrl,
  sceneName,
  minSize,
}: CompliancePanelProps) {
  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [checked, setChecked] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleCheck = useCallback(async () => {
    if (!previewUrl) return;
    setChecking(true);
    try {
      const imageData = await getImageDataFromUrl(previewUrl);
      const res = checkCompliance(imageData, {
        minWidthPx: minSize?.width,
        minHeightPx: minSize?.height,
        sceneName,
      });
      setResults(res);
      setChecked(true);
    } catch (err) {
      console.error('合规检测图片加载失败:', err);
    } finally {
      setChecking(false);
    }
  }, [previewUrl, minSize, sceneName]);

  return (
    <div className="w-full">
      <button
        onClick={handleCheck}
        disabled={!previewUrl || checking}
        className={`touch-btn px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
          checking
            ? 'bg-gray-100 text-gray-400 cursor-wait'
            : checked
              ? 'bg-green-50 text-green-700 border border-green-200'
              : !previewUrl
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
        }`}
      >
        {checking ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            检测中...
          </>
        ) : checked ? (
          '✅ 已检测'
        ) : (
          '🔍 合规检测'
        )}
      </button>

      {/* 检测结果 */}
      {results && results.length > 0 && (
        <div className="mt-3 space-y-2">
          {results.map((r) => (
            <div
              key={r.id}
              className={`flex items-start gap-2.5 text-sm p-3 rounded-xl ${
                r.status === 'pass'
                  ? 'bg-green-50'
                  : r.status === 'warn'
                    ? 'bg-amber-50'
                    : 'bg-red-50'
              }`}
            >
              <span className="mt-0.5 shrink-0">
                {r.status === 'pass' ? '✅' : r.status === 'warn' ? '⚠️' : '❌'}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-gray-800">{r.name}</div>
                <div
                  className={`text-xs mt-0.5 ${
                    r.status === 'pass'
                      ? 'text-green-600'
                      : r.status === 'warn'
                        ? 'text-amber-600'
                        : 'text-red-600'
                  }`}
                >
                  {r.message}
                </div>
                {r.suggestion && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    💡 {r.suggestion}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* 汇总状态 */}
          <div
            className={`text-xs font-medium text-right ${
              getOverallStatus(results).color
            }`}
          >
            {getOverallStatus(results).label}
          </div>

          <div className="text-[11px] text-gray-400">
            注：此检测为预览性参考，不能替代政务系统的正式审核。正式提交请以官方要求为准。
          </div>
        </div>
      )}
    </div>
  );
}
