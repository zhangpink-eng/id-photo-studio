'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { removeImageBackground } from '@/lib/background-removal';
import { compositeImage, loadImage } from '@/lib/image-utils';
import {
  PHOTO_SIZES,
  BG_COLORS,
  DEFAULT_BG_COLOR,
  CUSTOM_SIZE_ID,
  createGradient,
  type PhotoSize,
} from '@/lib/constants';
import { applyBeauty, type BeautyParams, DEFAULT_BEAUTY, BEAUTY_PRESETS } from '@/lib/beauty';
import type { SceneConfig } from '@/lib/scenes';
import LayoutEditor from '@/components/layout-editor';
import CompliancePanel from '@/components/compliance-panel';
import BatchGenerator from '@/components/batch-generator';
import { addHistoryRecord, generateThumbnail } from '@/lib/history';

interface PhotoEditorProps {
  image: File;
  imageUrl: string;
  scene?: SceneConfig | null;
  onReset: () => void;
}

type ProcessingStep = 'idle' | 'uploading' | 'downloading' | 'inference' | 'compositing' | 'done' | 'error';

/** 处理阶段定义 */
interface ProcessingStage {
  key: ProcessingStep;
  label: string;
  detail: string;
  icon: string;
}

const PROCESSING_STAGES: ProcessingStage[] = [
  { key: 'uploading',   label: '正在上传到服务器', detail: '上传照片到服务器处理...',     icon: '📤' },
  { key: 'inference',   label: 'AI 智能抠图',     detail: '服务器正在识别处理人物轮廓...', icon: '✂️' },
  { key: 'compositing', label: '合成效果',         detail: '正在合成预览图...',           icon: '🎨' },
];

/**
 * 检查抠图结果是否有足够的人像像素
 * 空/无效照片 → 提前退出并提示
 */
async function checkHasPerson(blob: Blob): Promise<boolean> {
  try {
    const img = await loadImage(blob);
    // 缩到 200px 检测就够了
    const MAX = 200;
    let w = img.naturalWidth, h = img.naturalHeight;
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
    const data = ctx.getImageData(0, 0, w, h).data;
    let opaquePixels = 0;
    for (let i = 0; i < w * h; i++) {
      if (data[i * 4 + 3] > 128) opaquePixels++;
    }
    const ratio = opaquePixels / (w * h);
    // 至少 3% 像素不透明才认为有人物
    return ratio > 0.03;
  } catch {
    return true; // 检测失败时继续，不阻塞用户
  }
}

export default function PhotoEditor({ image, imageUrl, scene, onReset }: PhotoEditorProps) {
  // ---- Core State ----
  const [personBlob, setPersonBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // ---- Beauty ----
  const [beauty, setBeauty] = useState<BeautyParams>({ ...DEFAULT_BEAUTY });
  const [beautyUrl, setBeautyUrl] = useState<string>(imageUrl);
  const [showBeauty, setShowBeauty] = useState(false);
  const beautyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 应用美颜（带防抖）
  useEffect(() => {
    if (!showBeauty) {
      setBeautyUrl(imageUrl);
      return;
    }

    if (beautyTimerRef.current) clearTimeout(beautyTimerRef.current);

    beautyTimerRef.current = setTimeout(async () => {
      try {
        const img = await loadImage(imageUrl);
        // 缩小到最长边 800px 再做美颜（原始照片太大，全分辨率极卡）
        const MAX_DIM = 800;
        let w = img.naturalWidth, h = img.naturalHeight;
        if (w > MAX_DIM || h > MAX_DIM) {
          const ratio = MAX_DIM / Math.max(w, h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const processed = applyBeauty(imageData, beauty);
        ctx.putImageData(processed, 0, 0);

        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            setBeautyUrl((prev) => {
              if (prev !== imageUrl) URL.revokeObjectURL(prev);
              return url;
            });
          }
        }, 'image/jpeg', 0.92);
      } catch (err) {
        console.error('美颜处理失败:', err);
      }
    }, 200); // 200ms 防抖

    return () => {
      if (beautyTimerRef.current) clearTimeout(beautyTimerRef.current);
    };
  }, [showBeauty, beauty, imageUrl]);

  // 清理 beautyUrl
  useEffect(() => {
    return () => {
      if (beautyUrl !== imageUrl) URL.revokeObjectURL(beautyUrl);
    };
  }, [beautyUrl, imageUrl]);

  /** 场景变化时只更新尺寸和底色，不重新 AI 抠图 */
  useEffect(() => {
    if (!scene) return;
    const newSize = PHOTO_SIZES.find((s) => s.id === scene.sizeId);
    if (newSize) setSelectedSize(newSize);
    const newBg = BG_COLORS.find((c) => c.value === scene.bgColor);
    if (newBg) setBgColor(newBg.value);
    setError(null);
  }, [scene?.id]);

  // ---- Background ----
  const [bgColor, setBgColor] = useState(
    scene
      ? BG_COLORS.find((c) => c.value === scene.bgColor)?.value || DEFAULT_BG_COLOR
      : DEFAULT_BG_COLOR,
  );
  const [customColor, setCustomColor] = useState('#4476C7');
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  // ---- Size ----
  const [selectedSize, setSelectedSize] = useState<PhotoSize>(
    scene
      ? PHOTO_SIZES.find((s) => s.id === scene.sizeId) || PHOTO_SIZES[0]
      : PHOTO_SIZES[0],
  );
  const [customW, setCustomW] = useState(400);
  const [customH, setCustomH] = useState(500);

  // ---- Processing State ----
  const [step, setStep] = useState<ProcessingStep>('idle');
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeStageIndex, setActiveStageIndex] = useState(-1);

  // ---- 下载状态 ----
  const [downloading, setDownloading] = useState(false);
  // ---- 下载模式: 'single' | 'layout' | 'batch' ----
  const [downloadMode, setDownloadMode] = useState<'single' | 'layout' | 'batch'>('single');

  // ---- 实际生效的尺寸（自定义时覆盖） ----
  const isCustom = selectedSize.id === CUSTOM_SIZE_ID;

  const effectiveWidthPx = isCustom ? customW : selectedSize.widthPx;
  const effectiveHeightPx = isCustom ? customH : selectedSize.heightPx;

  // ---- Cleanup ----
  const previewUrlRef = useRef<string | null>(null);

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

  /** ref 方式存 showBeauty/beauty，解决闭包旧值问题 */
  const showBeautyRef = useRef(showBeauty);
  showBeautyRef.current = showBeauty;
  const beautyRef = useRef(beauty);
  beautyRef.current = beauty;

  // ---- AI 抠图 ----
  const handleRemoveBackground = useCallback(async () => {
    setStep('uploading');
    setError(null);
    setActiveStageIndex(0);
    setProgress(5);
    setStatusText('正在准备照片...');

    try {
      // Stage 0: 准备照片
      let sourceBlob;
      if (showBeautyRef.current) {
        const img = await loadImage(imageUrl);
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const processed = applyBeauty(imageData, beautyRef.current);
        ctx.putImageData(processed, 0, 0);
        sourceBlob = await new Promise<Blob>((resolve) =>
          canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.95)
        );
      } else {
        sourceBlob = await fetch(imageUrl).then((r) => r.blob());
      }
      setProgress(15);

      // Stage 1: 抠图推理（调用服务器或本地 AI）
      setStep('inference');
      setActiveStageIndex(1);
      setStatusText('正在上传到服务器处理...');

      const blob = await removeImageBackground(sourceBlob, (pct, key, stage) => {
        const mappedPct = 15 + Math.round(pct * 0.7);
        setProgress(mappedPct);
        if (stage === 'uploading' || key === 'uploading') {
          setStatusText('正在上传照片到服务器...');
        } else if (key === 'inference' || stage === 'inference') {
          setStatusText(`AI 正在抠图中 ${pct}%`);
        } else if (key === 'done') {
          setStatusText('抠图完成');
        } else {
          setStatusText(`处理中 ${pct}%`);
        }
      });
      setProgress(85);

      // 检测抠图结果是否有效（是否有足够的人像像素）
      const hasPerson = await checkHasPerson(blob);
      if (!hasPerson) {
        setStep('error');
        setError('未检测到人物，请使用正面半身照片或调整光线');
        setStatusText('❌ 未检测到人物');
        return;
      }

      // Stage 2: 合成预览
      setStep('compositing');
      setActiveStageIndex(2);
      setStatusText('正在合成效果...');

      setPersonBlob(blob);
      setStep('done');
      setProgress(100);
      setStatusText('✅ 完成');
    } catch (err) {
      console.error('抠图失败:', err);
      setStep('error');
      setError('背景移除失败，请尝试其他照片或重试');
      setStatusText('❌ 处理失败');
    }
  }, [beautyUrl]);

  /** 标记是否已自动开始处理（避免重复触发） */
  const autoStartedRef = useRef(false);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const removeBgRef = useRef(handleRemoveBackground);
  removeBgRef.current = handleRemoveBackground;

  // 自动处理：进入编辑时如果选了场景，自动美颜 + 抠图 + 换底
  useEffect(() => {
    if (autoStartedRef.current) return;
    if (!sceneRef.current) return;

    autoStartedRef.current = true;
    // 同时更新 state 和 ref（抠图回调用 ref，不依赖 state 刷新）
    const freshPreset = { smoothing: 50, spotHeal: 40, brightness: 25, sharpness: 30 };
    setBeauty(freshPreset);
    beautyRef.current = freshPreset;
    setShowBeauty(true);
    showBeautyRef.current = true;
    removeBgRef.current();
  }, []);

  // ---- 合成预览（依赖变化时自动重算） ----
  useEffect(() => {
    if (!personBlob) {
      updatePreviewUrl(null);
      return;
    }

    let cancelled = false;

    const doComposite = async () => {
      const targetW = effectiveWidthPx;
      const targetH = effectiveHeightPx;

      if (targetW < 1 || targetH < 1) {
        updatePreviewUrl(null);
        return;
      }

      try {
        let fillStyle: string | CanvasGradient;

        if (bgColor === 'gradient') {
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
  }, [personBlob, bgColor, customColor, effectiveWidthPx, effectiveHeightPx, updatePreviewUrl]);

  // ---- 下载 ----
  const handleDownload = useCallback(async () => {
    if (!previewUrl) return;
    setDownloading(true);

    const sizeLabel = isCustom ? `自定义_${effectiveWidthPx}x${effectiveHeightPx}` : selectedSize.name;

    try {
      const response = await fetch(previewUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `证件照_${sizeLabel}_${effectiveWidthPx}x${effectiveHeightPx}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // 自动保存到历史记录（异步，不阻塞下载）
      saveToHistory(blob);
    } catch (err) {
      console.error('下载失败:', err);
      setError('下载失败，请重试');
    } finally {
      setDownloading(false);
    }
  }, [previewUrl, selectedSize, effectiveWidthPx, effectiveHeightPx, isCustom, imageUrl, scene]);

  /** 自动保存到本地历史记录 */
  const saveToHistory = useCallback(
    async (resultBlob: Blob) => {
      try {
        const thumbnailDataUrl = await generateThumbnail(resultBlob);
        // 原图也保存一个小型版本供回顾
        const origResp = await fetch(imageUrl);
        const origBlob = await origResp.blob();
        await addHistoryRecord({
          createdAt: new Date().toISOString(),
          sceneName: scene?.name,
          sizeName: isCustom ? `自定义 ${effectiveWidthPx}×${effectiveHeightPx}` : selectedSize.name,
          widthPx: effectiveWidthPx,
          heightPx: effectiveHeightPx,
          bgColor: bgColor === 'custom' ? customColor : bgColor === 'gradient' ? '渐变蓝' : bgColor,
          thumbnailDataUrl,
          originalBlob: origBlob,
          resultBlob,
        });
      } catch (err) {
        // 静默失败——历史记录保存失败不应中断用户体验
        console.warn('历史记录保存失败:', err);
      }
    },
    [imageUrl, scene, selectedSize, isCustom, effectiveWidthPx, effectiveHeightPx, bgColor, customColor],
  );

  // ---- 背景色按钮点击 ----
  const handleBgSelect = (value: string) => {
    setBgColor(value);
    setShowCustomPicker(value === 'custom');
  };

  // ---- 按钮状态 ----
  const isProcessing = step === 'uploading' || step === 'downloading' || step === 'inference' || step === 'compositing';
  const hasPerson = personBlob !== null;
  const hasPreview = previewUrl !== null;
  const sizeInvalid = isCustom && (effectiveWidthPx < 10 || effectiveHeightPx < 10);

  return (
    <div className="space-y-8">
      {/* ====== 场景提示条 ====== */}
      {scene && (
        <div className="bg-gradient-to-r from-brand-50 to-blue-50 rounded-2xl border border-brand-100 p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0">{scene.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-800">{scene.name}</span>
                <span className="text-xs bg-white/80 text-brand-600 px-2 py-0.5 rounded-full border border-brand-200">
                  {scene.sizeId} · {scene.bgColor === '#FFFFFF' ? '白底' : scene.bgColor === '#4476C7' ? '蓝底' : scene.bgColor === '#E53935' ? '红底' : '自定义底色'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {scene.tips.slice(0, 4).map((tip) => (
                  <span key={tip} className="text-xs text-gray-500 bg-white/60 px-2 py-0.5 rounded-full">
                    {tip}
                  </span>
                ))}
                {scene.tips.length > 4 && (
                  <span className="text-xs text-gray-400">+{scene.tips.length - 4}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====== 图片展示区 ====== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 原始照片 / 美颜预览 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${showBeauty ? 'bg-pink-400' : 'bg-gray-400'}`} />
              <h3 className="text-sm font-medium text-gray-500">
                {showBeauty ? '美颜预览' : '原始照片'}
              </h3>
            </div>
            <button
              onClick={() => setShowBeauty(!showBeauty)}
              className={`text-xs px-3 py-1 rounded-full transition-all ${
                showBeauty
                  ? 'bg-pink-100 text-pink-600'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {showBeauty ? '美颜 ON' : '美颜 OFF'}
            </button>
          </div>
          <div className="aspect-[3/4] relative overflow-hidden rounded-xl bg-gray-100">
            <img
              src={beautyUrl}
              alt={showBeauty ? '美颜后' : '原始照片'}
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
                {effectiveWidthPx} × {effectiveHeightPx}px
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
                <div className="relative">
                  <svg className="animate-spin h-10 w-10 text-brand-400" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-500 animate-pulse">
                  {isProcessing ? statusText : '正在合成...'}
                </span>
                {isProcessing && progress > 0 && (
                  <span className="text-xs text-gray-400">{progress}%</span>
                )}
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
        {/* ---- 多阶段进度 ---- */}
        {/* ---- 处理完成提示 ---- */}
        {step === 'done' && (
          <div className="bg-green-50 rounded-xl p-4 border border-green-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-2xl">✅</span>
                <div className="min-w-0">
                  <div className="font-medium text-green-800">处理完成</div>
                  <div className="text-xs text-green-600 mt-0.5 truncate">{statusText}</div>
                </div>
              </div>
              <span className="shrink-0 text-sm font-medium text-green-600 bg-green-100 px-3 py-1 rounded-full">100%</span>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="bg-white rounded-xl border border-brand-100 overflow-hidden">
            {/* 阶段列表 */}
            <div className="divide-y divide-brand-50">
              {PROCESSING_STAGES.map((stage, i) => {
                const isActive = activeStageIndex === i;
                const isDone = i < activeStageIndex;

                return (
                  <div
                    key={stage.key}
                    className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                      isActive ? 'bg-brand-50' : isDone ? 'bg-green-50/50' : 'opacity-40'
                    }`}
                  >
                    {/* 状态图标 */}
                    <span className="shrink-0 w-6 h-6 flex items-center justify-center">
                      {isDone ? (
                        <span className="text-green-500">✅</span>
                      ) : isActive ? (
                        <svg className="animate-spin w-4 h-4 text-brand-600" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <span className="text-gray-300">⏳</span>
                      )}
                    </span>

                    {/* 阶段名 */}
                    <div className="min-w-0 flex-1">
                      <div className={`font-medium ${isActive ? 'text-brand-700' : isDone ? 'text-gray-500' : 'text-gray-400'}`}>
                        {stage.icon} {stage.label}
                      </div>
                      <div className={`text-xs ${isActive ? 'text-brand-500' : 'text-gray-400'}`}>
                        {isActive ? statusText || stage.detail : isDone ? '已完成' : '等待中'}
                      </div>
                    </div>

                    {/* 当前阶段进度 */}
                    {isActive && (
                      <span className="shrink-0 text-xs font-medium text-brand-600">{progress}%</span>
                    )}
                    {isDone && (
                      <span className="shrink-0 text-xs text-green-500">完成</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 总进度条 */}
            <div className="h-1.5 bg-gray-100">
              <div
                className="h-full bg-gradient-to-r from-brand-500 to-green-500 transition-all duration-500 ease-out"
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

        {/* ---- 美颜 ---- */}
        {showBeauty && (
          <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-xl p-5 border border-pink-100">
            <label className="block text-sm font-medium text-gray-700 mb-4">
              ✨ 美颜参数 <span className="text-gray-400 font-normal">— 拖动滑块实时预览效果</span>
            </label>

            {/* 美颜预设 */}
            <div className="mb-5 pb-5 border-b border-pink-100">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-medium text-gray-500">快速预设</span>
                <button
                  onClick={() => {
                    const preset = BEAUTY_PRESETS.find((p) => p.id === 'fresh')!;
                    setBeauty({ ...preset.params });
                  }}
                  className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                >
                  🤖 一键美颜
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {BEAUTY_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => setBeauty({ ...preset.params })}
                    className={`touch-btn px-3.5 py-2 rounded-lg text-xs font-medium transition-all border ${
                      beauty.smoothing === preset.params.smoothing &&
                      beauty.spotHeal === preset.params.spotHeal &&
                      beauty.brightness === preset.params.brightness &&
                      beauty.sharpness === preset.params.sharpness
                        ? 'bg-white border-pink-300 text-pink-700 shadow-sm'
                        : 'bg-white/60 border-pink-100 text-gray-600 hover:bg-white hover:border-pink-200'
                    }`}
                    title={preset.description}
                  >
                    {preset.icon} {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 去痘印 */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-gray-600">去痘印</span>
                <span className="text-sm font-medium text-red-500">{beauty.spotHeal}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={beauty.spotHeal}
                onChange={(e) => setBeauty((prev) => ({ ...prev, spotHeal: Number(e.target.value) }))}
                className="w-full h-2 bg-red-100 rounded-full appearance-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                  [&::-webkit-slider-thumb]:bg-red-400 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md
                  [&::-webkit-slider-thumb]:cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>关闭</span>
                <span>强力去印</span>
              </div>
            </div>

            {/* 磨皮 */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-gray-600">平滑皮肤</span>
                <span className="text-sm font-medium text-pink-600">{beauty.smoothing}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={beauty.smoothing}
                onChange={(e) => setBeauty((prev) => ({ ...prev, smoothing: Number(e.target.value) }))}
                className="w-full h-2 bg-pink-100 rounded-full appearance-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                  [&::-webkit-slider-thumb]:bg-pink-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md
                  [&::-webkit-slider-thumb]:cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>自然</span>
                <span>柔和</span>
              </div>
            </div>

            {/* 提亮 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-gray-600">提亮肤色</span>
                <span className="text-sm font-medium text-amber-600">{beauty.brightness}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={beauty.brightness}
                onChange={(e) => setBeauty((prev) => ({ ...prev, brightness: Number(e.target.value) }))}
                className="w-full h-2 bg-amber-100 rounded-full appearance-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                  [&::-webkit-slider-thumb]:bg-amber-400 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md
                  [&::-webkit-slider-thumb]:cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>自然</span>
                <span>明亮</span>
              </div>
            </div>

            {/* 清晰度 */}
            <div className="mt-5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-gray-600">清晰度</span>
                <span className="text-sm font-medium text-sky-600">{beauty.sharpness}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={beauty.sharpness}
                onChange={(e) => setBeauty((prev) => ({ ...prev, sharpness: Number(e.target.value) }))}
                className="w-full h-2 bg-sky-100 rounded-full appearance-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                  [&::-webkit-slider-thumb]:bg-sky-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md
                  [&::-webkit-slider-thumb]:cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>柔和</span>
                <span>锐利</span>
              </div>
            </div>
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
                  className={`relative w-10 h-10 sm:w-10 sm:h-10 rounded-full border-2 transition-all shrink-0 ${
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

            <span className="text-xs text-gray-400 ml-1">
              {bgColor === 'gradient' ? '渐变' : bgColor === 'custom' ? customColor : ''}
            </span>
          </div>
        </div>

        {/* ---- 尺寸选择 ---- */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            照片尺寸 <span className="text-gray-400 font-normal">— 选择标准尺寸或自定义</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {PHOTO_SIZES.map((size) => {
              const isActive = selectedSize.id === size.id;
              return (
                <button
                  key={size.id}
                  onClick={() => setSelectedSize(size)}
                  className={`touch-btn px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-200'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <span className="font-semibold">{size.name}</span>
                  {size.id !== CUSTOM_SIZE_ID && (
                    <span className={`ml-1.5 ${isActive ? 'text-white/75' : 'text-gray-400'}`}>
                      {size.widthPx}×{size.heightPx}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* 自定义尺寸输入 */}
          {isCustom && (
            <div className="mt-4 flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">宽度 (px)</label>
                <input
                  type="number"
                  min={10}
                  max={8000}
                  value={customW}
                  onChange={(e) => setCustomW(Math.max(10, Number(e.target.value) || 0))}
                  className="w-28 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>
              <div className="text-gray-300 pb-2">×</div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">高度 (px)</label>
                <input
                  type="number"
                  min={10}
                  max={8000}
                  value={customH}
                  onChange={(e) => setCustomH(Math.max(10, Number(e.target.value) || 0))}
                  className="w-28 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>
              <div className="text-xs text-gray-400 pb-2">
                {effectiveWidthPx}×{effectiveHeightPx}px ={' '}
                {(effectiveWidthPx / 300 * 25.4).toFixed(1)}×{(effectiveHeightPx / 300 * 25.4).toFixed(1)}mm
              </div>
            </div>
          )}

          {/* 尺寸详情 */}
          {selectedSize && !isCustom && (
            <div className="mt-3 text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2 inline-block">
              {selectedSize.description} · {selectedSize.widthMm}×{selectedSize.heightMm}mm · {selectedSize.widthPx}×{selectedSize.heightPx}px @ 300DPI
            </div>
          )}
        </div>

        {/* ---- 合规检测 ---- */}
        {hasPreview && (
          <div className="pt-2">
            <CompliancePanel
              previewUrl={previewUrl}
              sceneName={scene?.name}
              minSize={{ width: effectiveWidthPx, height: effectiveHeightPx }}
            />
          </div>
        )}

        {/* ---- 操作按钮 ---- */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
          {/* 下载模式切换 */}
          {hasPerson && (
            <div className="w-full mb-2 flex items-center gap-1 bg-gray-100 rounded-xl p-0.5">
              <button
                onClick={() => setDownloadMode('single')}
                className={`flex-1 touch-btn px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  downloadMode === 'single'
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                📄 单张
              </button>
              <button
                onClick={() => setDownloadMode('layout')}
                className={`flex-1 touch-btn px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  downloadMode === 'layout'
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                🖨️ 排版
              </button>
              <button
                onClick={() => setDownloadMode('batch')}
                className={`flex-1 touch-btn px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  downloadMode === 'batch'
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                📦 批量
              </button>
            </div>
          )}

          {/* 单张下载模式 */}
          {downloadMode === 'single' && (
            <>
              <button
                onClick={handleDownload}
                disabled={!hasPreview || sizeInvalid}
                className={`touch-btn px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2 ${
                  hasPreview && !sizeInvalid
                    ? 'bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-200'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                📥 下载证件照
              </button>
              <button
                onClick={onReset}
                className="touch-btn px-6 py-3 rounded-xl font-medium bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200 transition-all"
              >
                🔄 重新上传
              </button>
            </>
          )}

          {statusText && step !== 'done' && !isProcessing && (
            <span className="text-sm text-gray-400">{statusText}</span>
          )}
        </div>

        {/* 排版打印区域 */}
        {hasPerson && downloadMode === 'layout' && (
          <div className="border-t border-gray-100 pt-4">
            <LayoutEditor
              personBlob={personBlob}
              cellSizePx={{ width: effectiveWidthPx, height: effectiveHeightPx }}
              cellSizeMm={{ width: isCustom ? (effectiveWidthPx / 300 * 25.4) : selectedSize.widthMm, height: isCustom ? (effectiveHeightPx / 300 * 25.4) : selectedSize.heightMm }}
              fillStyle={bgColor === 'custom' ? customColor : bgColor}
              onDownload={(blob, label) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `证件照排版_${label}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
            />
          </div>
        )}

        {/* 批量生成区域 */}
        {hasPerson && downloadMode === 'batch' && (
          <div className="border-t border-gray-100 pt-4">
            <BatchGenerator
              personBlob={personBlob}
              bgColor={bgColor}
              customColor={customColor}
              defaultSelected={scene ? [scene.sizeId] : undefined}
            />
          </div>
        )}
      </div>
    </div>
  );
}
