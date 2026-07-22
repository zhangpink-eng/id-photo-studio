'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { removeImageBackground } from '@/lib/background-removal';
import { compositeImage } from '@/lib/image-utils';
import { PHOTO_SIZES, BG_COLORS, DEFAULT_BG_COLOR, createGradient, type PhotoSize } from '@/lib/constants';

interface PhotoEditorProps {
  image: File;
  imageUrl: string;
  onReset: () => void;
}

type ProcessingStep = 'idle' | 'downloading' | 'processing' | 'completing' | 'done' | 'error';

export default function PhotoEditor({ image, imageUrl, onReset }: PhotoEditorProps) {
  // ---- Core State ----
  const [personBlob, setPersonBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // ---- Background ----
  const [bgColor, setBgColor] = useState(DEFAULT_BG_COLOR);
  const [customColor, setCustomColor] = useState('#4476C7');
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  // ---- Size ----
  const [selectedSize, setSelectedSize] = useState<PhotoSize>(PHOTO_SIZES[0]);

  // ---- Processing State ----
  const [step, setStep] = useState<ProcessingStep>('idle');
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState<string | null>(null);

  // ---- Download ----
  const [downloading, setDownloading] = useState(false);

  // ---- Cleanup ----
  const previewUrlRef = useRef<string | null>(null);

  // 清理预览 URL
  const updatePreviewUrl = useCallback((url: string | null) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    previewUrlRef.current = url;
    setPreviewUrl(url);
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  // ---- AI 抠图 ----
  const handleRemoveBackground = useCallback(async () => {
    setStep('downloading');
    setProgress(0);
    setError(null);
    setStatusText('正在加载 AI 模型...');

    try {
      const blob = await removeImageBackground(image, (pct, key) => {
        setProgress(pct);
        if (key === 'wasm') setStatusText('正在加载 AI 模型...');
        else if (key === 'inference') setStatusText('正在识别人物轮廓...');
        else setStatusText(`处理中 ${pct}%`);
      });
      setPersonBlob(blob);
      setStep('done');
      setStatusText('抠图完成 ✓');
    } catch (err) {
      console.error('抠图失败:', err);
      setStep('error');
      setError('背景移除失败，请尝试其他照片或重试');
      setStatusText('处理失败');
    }
  }, [image]);

  // ---- 合成预览（依赖变化时自动重算） ----
  useEffect(() => {
    if (!personBlob) {
      updatePreviewUrl(null);
      return;
    }

    let cancelled = false;

    const doComposite = async () => {
      const targetW = selectedSize.widthPx;
      const targetH = selectedSize.heightPx;

      try {
        // 确定填充样式
        let fillStyle: string | CanvasGradient;

        if (bgColor === 'gradient') {
          // 创建渐变画布
          const gradCanvas = document.createElement('canvas');
          gradCanvas.width = targetW;
          gradCanvas.height = targetH;
          const gradCtx = gradCanvas.getContext('2d')!;
          fillStyle = createGradient(gradCtx, targetW, targetH);
        } else if (bgColor === 'custom') {
          fillStyle = customColor;
        } else {
          fillStyle = bgColor;
        }

        const result = await compositeImage(personBlob, fillStyle, targetW, targetH);

        if (!cancelled) {
          const url = URL.createObjectURL(result);
          updatePreviewUrl(url);
        }
      } catch (err) {
        console.error('合成失败:', err);
        if (!cancelled) {
          setError('图片合成失败，请重试');
        }
      }
    };

    doComposite();

    return () => {
      cancelled = true;
    };
  }, [personBlob, bgColor, customColor, selectedSize, updatePreviewUrl]);

  // ---- 下载 ----
  const handleDownload = useCallback(async () => {
    if (!previewUrl) return;
    setDownloading(true);

    try {
      const response = await fetch(previewUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `证件照_${selectedSize.name}_${selectedSize.widthPx}x${selectedSize.heightPx}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('下载失败:', err);
      setError('下载失败，请重试');
    } finally {
      setDownloading(false);
    }
  }, [previewUrl, selectedSize]);

  // ---- 背景色按钮点击 ----
  const handleBgSelect = (value: string) => {
    setBgColor(value);
    setShowCustomPicker(value === 'custom');
  };

  // ---- 当前实际填充颜色（用于预览色块） ----
  const currentBgSwatch = bgColor === 'custom' ? customColor : bgColor;

  // ---- 按钮状态 ----
  const isProcessing = step === 'downloading' || step === 'processing';
  const hasPerson = personBlob !== null;
  const hasPreview = previewUrl !== null;

  return (
    <div className="space-y-8">
      {/* ====== 图片展示区 ====== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 原始照片 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-500 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-gray-400" />
              原始照片
            </h3>
            <span className="text-xs text-gray-400">
              {image.name.replace(/^(.{20}).*$/, '$1…')}
            </span>
          </div>
          <div className="aspect-[3/4] relative overflow-hidden rounded-xl bg-gray-100">
            <img
              src={imageUrl}
              alt="原始照片"
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* 预览效果 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-500 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              效果预览
            </h3>
            {hasPreview && (
              <span className="text-xs text-gray-400">
                {selectedSize.widthPx} × {selectedSize.heightPx}px
              </span>
            )}
          </div>
          <div className="aspect-[3/4] relative overflow-hidden rounded-xl bg-gray-100 flex items-center justify-center">
            {hasPreview ? (
              <img
                src={previewUrl}
                alt="合成预览"
                className="w-full h-full object-contain"
                style={{ imageRendering: 'auto' }}
              />
            ) : hasPerson ? (
              <div className="flex flex-col items-center gap-2 text-gray-400">
                <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm">正在合成...</span>
              </div>
            ) : (
              <div className="text-center text-gray-400 p-8">
                <p className="text-lg mb-2">👤</p>
                <p className="text-sm">点击下方按钮移除背景</p>
                <p className="text-xs text-gray-300 mt-1">移除了背景才能更换底色和尺寸</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ====== 控制面板 ====== */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-6">
        {/* ---- 进度 / 错误 ---- */}
        {isProcessing && (
          <div className="bg-brand-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-brand-700">{statusText}</span>
              <span className="text-sm font-medium text-brand-600">{progress}%</span>
            </div>
            <div className="w-full h-2 bg-brand-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-red-700">
            <span className="mt-0.5 shrink-0">⚠️</span>
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
              ✕
            </button>
          </div>
        )}

        {/* ---- 背景色 ---- */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            背景颜色 <span className="text-gray-400 font-normal">— 选择底色后自动合成预览</span>
          </label>
          <div className="flex flex-wrap items-center gap-3">
            {BG_COLORS.map((c) => {
              let swatchStyle: React.CSSProperties;
              if (c.value === 'gradient') {
                swatchStyle = { background: 'linear-gradient(135deg, #667eea, #764ba2)' };
              } else if (c.value === 'custom') {
                swatchStyle = { background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' };
              } else {
                swatchStyle = { backgroundColor: c.value };
              }

              const isActive = bgColor === c.value;

              return (
                <button
                  key={c.value}
                  onClick={() => handleBgSelect(c.value)}
                  className={`relative w-10 h-10 rounded-full border-2 transition-all shrink-0 ${
                    isActive
                      ? 'border-brand-500 scale-110 shadow-md'
                      : 'border-gray-200 hover:scale-105 hover:border-gray-300'
                  }`}
                  style={swatchStyle}
                  title={c.description}
                />
              );
            })}

            {showCustomPicker && (
              <input
                type="color"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="w-10 h-10 rounded-full cursor-pointer border-2 border-brand-500"
                title="选择自定义颜色"
              />
            )}

            {/* 当前颜色标签 */}
            <span className="text-xs text-gray-400 ml-1">
              {bgColor === 'gradient' ? '渐变' : bgColor === 'custom' ? customColor : ''}
            </span>
          </div>
        </div>

        {/* ---- 尺寸选择 ---- */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            照片尺寸 <span className="text-gray-400 font-normal">— 选择标准证件照尺寸</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {PHOTO_SIZES.map((size) => {
              const isActive = selectedSize.id === size.id;
              return (
                <button
                  key={size.id}
                  onClick={() => setSelectedSize(size)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-200'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <span className="font-semibold">{size.name}</span>
                  <span className={`ml-1.5 ${isActive ? 'text-white/75' : 'text-gray-400'}`}>
                    {size.widthPx}×{size.heightPx}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 尺寸详情 */}
          {selectedSize && (
            <div className="mt-3 text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2 inline-block">
              {selectedSize.description} · {selectedSize.widthMm}×{selectedSize.heightMm}mm · {selectedSize.widthPx}×{selectedSize.heightPx}px @ 300DPI
            </div>
          )}
        </div>

        {/* ---- 操作按钮 ---- */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100">
          {/* 抠图按钮 */}
          <button
            onClick={handleRemoveBackground}
            disabled={isProcessing}
            className={`px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2 ${
              isProcessing
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : hasPerson
                  ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                  : 'bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-200'
            }`}
          >
            {isProcessing ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {progress}%
              </>
            ) : hasPerson ? (
              '🔄 重新抠图'
            ) : (
              '✨ AI 智能抠图'
            )}
          </button>

          {/* 下载按钮 */}
          <button
            onClick={handleDownload}
            disabled={!hasPreview || downloading}
            className={`px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2 ${
              hasPreview && !downloading
                ? 'bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-200'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {downloading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                下载中...
              </>
            ) : (
              '📥 下载证件照'
            )}
          </button>

          {/* 重新上传 */}
          <button
            onClick={onReset}
            className="px-6 py-3 rounded-xl font-medium bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200 transition-all"
          >
            🔄 重新上传
          </button>

          {/* 状态提示 */}
          {statusText && step !== 'done' && !isProcessing && (
            <span className="text-sm text-gray-400">{statusText}</span>
          )}
        </div>
      </div>
    </div>
  );
}
