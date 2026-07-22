'use client';

import { useState, useCallback } from 'react';
import { PHOTO_SIZES, CUSTOM_SIZE_ID, createGradient, type PhotoSize } from '@/lib/constants';
import { compositeImage } from '@/lib/image-utils';

interface BatchGeneratorProps {
  /** 抠图后的人像 Blob（透明背景） */
  personBlob: Blob;
  /** 背景色 */
  bgColor: string;
  /** 自定义颜色（当 bgColor === 'custom' 时） */
  customColor?: string;
  /** 默认选中的尺寸 ID 列表（可预选当前场景的尺寸） */
  defaultSelected?: string[];
  /** 完成后的回调 */
  onComplete?: (total: number) => void;
}

interface SizeProgress {
  sizeId: string;
  name: string;
  status: 'pending' | 'generating' | 'done' | 'error';
  blob?: Blob;
}

export default function BatchGenerator({
  personBlob,
  bgColor,
  customColor,
  defaultSelected,
  onComplete,
}: BatchGeneratorProps) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(defaultSelected || []),
  );
  const [progress, setProgress] = useState<SizeProgress[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [doneCount, setDoneCount] = useState(0);

  const toggleSize = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBatchGenerate = useCallback(async () => {
    if (selected.size === 0 || !personBlob) return;

    const sizeList = PHOTO_SIZES.filter((s) => selected.has(s.id) && s.id !== CUSTOM_SIZE_ID);
    if (sizeList.length === 0) return;

    setIsRunning(true);
    setDoneCount(0);
    const initProgress: SizeProgress[] = sizeList.map((s) => ({
      sizeId: s.id,
      name: s.name,
      status: 'pending',
    }));
    setProgress(initProgress);

    for (let i = 0; i < sizeList.length; i++) {
      const size = sizeList[i];

      // 标记为 generating
      setProgress((prev) =>
        prev.map((p) =>
          p.sizeId === size.id ? { ...p, status: 'generating' } : p,
        ),
      );

      try {
        // 处理背景色
        let fillStyle: string | CanvasGradient = bgColor;
        if (bgColor === 'custom') {
          fillStyle = customColor || '#4476C7';
        } else if (bgColor === 'gradient') {
          const canvas = document.createElement('canvas');
          canvas.width = size.widthPx;
          canvas.height = size.heightPx;
          const ctx = canvas.getContext('2d')!;
          fillStyle = createGradient(ctx, size.widthPx, size.heightPx);
        }

        const resultBlob = await compositeImage(
          personBlob,
          fillStyle,
          size.widthPx,
          size.heightPx,
        );

        // 逐个下载
        const url = URL.createObjectURL(resultBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `证件照_${size.name}_${size.widthPx}x${size.heightPx}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        // 延迟释放 url（确保浏览器开始下载）
        setTimeout(() => URL.revokeObjectURL(url), 1000);

        setProgress((prev) =>
          prev.map((p) =>
            p.sizeId === size.id
              ? { ...p, status: 'done', blob: resultBlob as Blob }
              : p,
          ),
        );
        setDoneCount((c) => c + 1);
      } catch (err) {
        console.error(`批量生成失败 ${size.name}:`, err);
        setProgress((prev) =>
          prev.map((p) =>
            p.sizeId === size.id ? { ...p, status: 'error' } : p,
          ),
        );
      }
    }

    setIsRunning(false);
    onComplete?.(doneCount);
  }, [selected, personBlob, bgColor, customColor]);

  // 可选的尺寸列表（排除自定义）
  const availableSizes = PHOTO_SIZES.filter((s) => s.id !== CUSTOM_SIZE_ID);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
        <span>📦</span>
        批量生成多规格
      </h3>
      <p className="text-xs text-gray-400">
        一次选择多个尺寸，系统逐一生成并自动下载
      </p>

      {/* 尺寸选择网格 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {availableSizes.map((size) => {
          const isSelected = selected.has(size.id);
          const prog = progress.find((p) => p.sizeId === size.id);
          return (
            <button
              key={size.id}
              onClick={() => {
                if (!isRunning) toggleSize(size.id);
              }}
              disabled={isRunning}
              className={`touch-btn px-3 py-3 rounded-xl text-sm transition-all border ${
                prog?.status === 'done'
                  ? 'bg-green-50 border-green-300 text-green-700'
                  : prog?.status === 'generating'
                    ? 'bg-amber-50 border-amber-200 text-amber-700 cursor-wait'
                    : prog?.status === 'error'
                      ? 'bg-red-50 border-red-200 text-red-600'
                      : isSelected
                        ? 'bg-brand-50 border-brand-300 text-brand-700 shadow-sm'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <div className="font-medium">{size.name}</div>
              <div className={`text-xs mt-0.5 ${
                prog?.status === 'done'
                  ? 'text-green-500'
                  : isSelected ? 'text-brand-400' : 'text-gray-400'
              }`}>
                {prog?.status === 'done'
                  ? '✅ 已下载'
                  : prog?.status === 'generating'
                    ? '⏳ 生成中...'
                    : prog?.status === 'error'
                      ? '❌ 失败'
                      : `${size.widthPx}×${size.heightPx}`}
              </div>
            </button>
          );
        })}
      </div>

      {/* 进度条 */}
      {isRunning && (
        <div className="bg-amber-50 rounded-xl p-3">
          <div className="flex items-center justify-between text-xs text-amber-700 mb-1.5">
            <span>正在批量生成...</span>
            <span>{doneCount}/{selected.size}</span>
          </div>
          <div className="w-full h-2 bg-amber-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-300"
              style={{
                width: `${selected.size > 0 ? (doneCount / selected.size) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <button
        onClick={handleBatchGenerate}
        disabled={selected.size === 0 || isRunning || !personBlob}
        className={`w-full touch-btn py-3.5 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
          selected.size > 0 && !isRunning && personBlob
            ? 'bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-200'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        }`}
      >
        {isRunning ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            正在生成 {doneCount}/{selected.size}...
          </>
        ) : (
          `📥 批量下载 ${selected.size} 个规格`
        )}
      </button>

      {!personBlob && (
        <p className="text-xs text-gray-400 text-center">
          ⚠️ 请先完成抠图后再使用批量生成
        </p>
      )}
    </div>
  );
}
