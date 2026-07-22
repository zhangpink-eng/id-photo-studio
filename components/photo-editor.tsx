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
import PreviewTemplates from '@/components/preview-templates';
import { autoFixPipeline } from '@/lib/auto-fix';
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
  /** 自动修正结果（用于展示给用户） */
  const [fixResults, setFixResults] = useState<{ id: string; name: string; message: string; action: string }[]>([]);

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

  // ---- AI 抠图（内含自动修正管线）----
  const handleRemoveBackground = useCallback(async () => {
    setStep('uploading');
    setError(null);
    setActiveStageIndex(0);
    setProgress(5);
    setStatusText('正在检查照片质量...');
    setFixResults([]);

    try {
      // Step 0: 加载原图 → 自动修正（曝光/色偏/分辨率检测）
      const rawImg = await loadImage(imageUrl);
      const rawCanvas = document.createElement('canvas');
      rawCanvas.width = rawImg.naturalWidth;
      rawCanvas.height = rawImg.naturalHeight;
      const rawCtx = rawCanvas.getContext('2d')!;
      rawCtx.drawImage(rawImg, 0, 0);
      const rawImageData = rawCtx.getImageData(0, 0, rawImg.naturalWidth, rawImg.naturalHeight);

      const fixes = autoFixPipeline(rawImageData, {
        width: effectiveWidthPx,
        height: effectiveHeightPx,
      });
      const fixLogs: { id: string; name: string; message: string; action: string }[] = [];

      let fixedImageData = rawImageData;
      let reEncode = false;

      for (const fix of fixes) {
        if (fix.action === 'fatal') {
          // 不可修复的问题 → 提前退出
          setStep('error');
          setError(fix.message);
          setStatusText('❌ ' + fix.message);
          return;
        }
        if (fix.action === 'fixed' && fix.imageData) {
          fixedImageData = fix.imageData;
          reEncode = true;
          fixLogs.push({ id: fix.id, name: fix.name, message: fix.message, action: 'fixed' });
        }
        if (fix.action === 'suggestion') {
          fixLogs.push({ id: fix.id, name: fix.name, message: fix.message, action: 'suggestion' });
        }
      }
      setFixResults(fixLogs);

      // 将修正后的图转为 Blob
      const fixCanvas = document.createElement('canvas');
      fixCanvas.width = rawImg.naturalWidth;
      fixCanvas.height = rawImg.naturalHeight;
      const fixCtx = fixCanvas.getContext('2d')!;
      fixCtx.putImageData(fixedImageData, 0, 0);
      let sourceBlob = await new Promise<Blob>((resolve) =>
        fixCanvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.95)
      );

      setProgress(10);
      setStatusText('正在应用美颜...');

      // Step 1: 美颜（以修正后的图为基础）
      if (showBeautyRef.current) {
        const img = await loadImage(sourceBlob);
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
      }
      setProgress(15);

      // Step 2: 抠图推理
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

      // Step 3: 检查抠图结果是否有效
      const hasPerson = await checkHasPerson(blob);
      if (!hasPerson) {
        setStep('error');
        setError('未检测到人物，请使用正面半身照片或调整光线');
        setStatusText('❌ 未检测到人物');
        return;
      }

      // Step 4: 合成预览
      setStep('compositing');
      setActiveStageIndex(2);
      setStatusText('正在合成效果...');

      setPersonBlob(blob);
      setStep('done');
      setProgress(100);
      setStatusText('✅ 完成');
    } catch (err) {
      console.error('处理失败:', err);
      setStep('error');
      setError('处理失败，请尝试其他照片');
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

        const result = await compositeImage(
          personBlob,
          fillStyle,
          targetW,
          targetH,
          scene?.headRatio,
        );

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
    <>
      {/* ====== 全屏处理遮罩层 ====== */}
      {(isProcessing || step === 'error') && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm">
          <div className="w-full max-w-md mx-auto px-6">
            {step === 'error' ? (
              /* 错误状态 */
              <div className="text-center">
                <div className="text-6xl mb-6">😅</div>
                <h3 className="text-xl font-bold text-gray-800 mb-3">处理失败</h3>
                <div className="bg-red-50 rounded-xl px-5 py-4 mb-6 text-sm text-red-700 border border-red-200">
                  {error}
                </div>
              </div>
            ) : (
              /* 处理中 */
              <div className="text-center">
                {/* 场景信息（顶部） */}
                {scene && (
                  <div className="mb-8">
                    <span className="text-4xl block mb-2">{scene.icon}</span>
                    <h2 className="text-lg font-semibold text-gray-700">{scene.name}</h2>
                    <p className="text-sm text-gray-400 mt-0.5">
                      {scene.sizeId} · {scene.bgColor === '#FFFFFF' ? '白底' : scene.bgColor === '#4476C7' ? '蓝底' : scene.bgColor === '#E53935' ? '红底' : '自定义'}
                    </p>
                  </div>
                )}

                {/* 环形进度 */}
                <div className="relative w-24 h-24 mx-auto mb-8">
                  <svg className="animate-spin w-24 h-24 text-brand-200" viewBox="0 0 100 100" style={{animationDuration:'3s'}}>
                    <circle className="opacity-25" cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="6" fill="none" />
                  </svg>
                  <svg className="absolute inset-0 w-24 h-24 text-brand-500 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="6" fill="none"
                      strokeDasharray={`${2 * Math.PI * 45}`}
                      strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 0.4s ease-out' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold text-brand-600">{progress}%</span>
                  </div>
                </div>

                {/* 当前状态 */}
                <p className="text-base font-medium text-gray-700 mb-1">{statusText}</p>
                <p className="text-xs text-gray-400">请稍候，正在生成证件照...</p>

                {/* 自动修正报告 */}
                {fixResults.length > 0 && (
                  <div className="mt-5 bg-amber-50 rounded-xl px-4 py-3 border border-amber-200 text-left">
                    <p className="text-xs font-medium text-amber-700 mb-1.5">🔧 照片自动优化</p>
                    {fixResults.map((fix) => (
                      <p key={fix.id} className="text-xs text-amber-600 flex items-start gap-1.5">
                        <span>{fix.action === 'fixed' ? '✅' : '💡'}</span>
                        <span>{fix.message}</span>
                      </p>
                    ))}
                  </div>
                )}

                {/* 阶段指示 */}
                <div className="mt-6 space-y-1.5 text-left max-w-xs mx-auto">
                  {PROCESSING_STAGES.map((stage, i) => {
                    const active = activeStageIndex === i;
                    const done = i < activeStageIndex;
                    return (
                      <div key={stage.key} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm ${
                        active ? 'bg-brand-50' : done ? 'bg-green-50' : 'opacity-30'
                      }`}>
                        <span className="shrink-0 w-4 h-4 flex items-center justify-center text-xs">
                          {done ? '✅' : active ? '🔄' : '⏳'}
                        </span>
                        <span className={active ? 'font-medium text-brand-700' : done ? 'text-green-600' : 'text-gray-400'}>
                          {stage.icon} {stage.label}
                        </span>
                        {active && <span className="ml-auto text-xs text-brand-500">{progress}%</span>}
                        {done && <span className="ml-auto text-xs text-green-500">完成</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ====== 编辑器内容（完成/空闲时可见）====== */}
      <div className={`space-y-8 ${isProcessing ? 'hidden' : ''}`}>
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

        {/* ---- 合规检测 + 场景提醒 ---- */}
        {hasPreview && (
          <div className="pt-2 space-y-3">
            <CompliancePanel
              sceneName={scene?.name}
              sizeName={isCustom ? `自定义 ${effectiveWidthPx}×${effectiveHeightPx}` : selectedSize.name}
              bgLabel={bgColor === '#FFFFFF' ? '白色' : bgColor === '#4476C7' ? '蓝色' : bgColor === '#E53935' ? '红色' : bgColor === 'gradient' ? '渐变' : '自定义'}
              fixResults={fixResults}
            />

            {/* 场景着装/表情提醒（用户自查项） */}
            {scene && step === 'done' && (
              <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
                <div className="text-xs font-medium text-blue-700 mb-1.5">
                  📋 还需要检查这些
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {scene.tips.map((tip) => (
                    <span key={tip} className="inline-flex items-center gap-1 bg-white/80 px-2 py-1 rounded text-xs text-blue-600">
                      {tip}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---- 场景预览 ---- */}
        {hasPerson && (
          <div className="pt-2">
            <PreviewTemplates
              personBlob={personBlob}
              fallbackUrl={previewUrl}
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

          {/* ====== 控制面板结束 ====== */}
        </div>
      </div>
    </>
  );
}
