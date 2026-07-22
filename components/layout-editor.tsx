'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  PAPER_SIZES,
  calculateLayout,
  layoutSummary,
  renderLayout,
  type LayoutConfig,
  type LayoutResult,
} from '@/lib/layout';

interface LayoutEditorProps {
  personBlob: Blob;
  cellSizePx: { width: number; height: number };
  cellSizeMm: { width: number; height: number };
  fillStyle: string | CanvasGradient;
  onDownload: (blob: Blob, label: string) => void;
}

export default function LayoutEditor({
  personBlob,
  cellSizePx,
  cellSizeMm,
  fillStyle,
  onDownload,
}: LayoutEditorProps) {
  const [selectedPaper, setSelectedPaper] = useState(PAPER_SIZES[0].id); // 6寸
  const [margin, setMargin] = useState(5);
  const [spacing, setSpacing] = useState(3);
  const [showCropMarks, setShowCropMarks] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [cellThumbUrl, setCellThumbUrl] = useState<string | null>(null);

  const layoutConfig: LayoutConfig = useMemo(
    () => ({
      paperId: selectedPaper,
      cellW: cellSizeMm.width,
      cellH: cellSizeMm.height,
      margin,
      spacing,
      showCropMarks,
    }),
    [selectedPaper, cellSizeMm, margin, spacing, showCropMarks],
  );

  const layoutResult = useMemo<LayoutResult>(() => {
    try {
      return calculateLayout(layoutConfig);
    } catch {
      return null as unknown as LayoutResult;
    }
  }, [layoutConfig]);

  const summaryText = useMemo(() => {
    try {
      return layoutSummary(layoutConfig);
    } catch {
      return '排版参数有误';
    }
  }, [layoutConfig]);

  const paperInfo = useMemo(
    () => PAPER_SIZES.find((p) => p.id === selectedPaper),
    [selectedPaper],
  );

  const handleRender = useCallback(async () => {
    if (!personBlob) return;
    setRendering(true);
    try {
      const blob = await renderLayout(personBlob, fillStyle, layoutConfig, cellSizePx);
      onDownload(blob, summaryText.replace(' · ', '_'));
    } catch (err) {
      console.error('排版渲染失败:', err);
    } finally {
      setRendering(false);
    }
  }, [personBlob, fillStyle, layoutConfig, cellSizePx, onDownload, summaryText]);

  const paperAspect = paperInfo ? paperInfo.widthMm / paperInfo.heightMm : 1;

  // ---- 渲染一张缩略图供排版预览使用 ----
  useEffect(() => {
    if (!personBlob) return;
    const canvas = document.createElement('canvas');
    const PH = 150;
    const PW = Math.round(PH * (cellSizePx.width / cellSizePx.height));
    canvas.width = PW;
    canvas.height = PH;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = typeof fillStyle === 'string' ? fillStyle : '#4476C7';
    ctx.fillRect(0, 0, PW, PH);

    const img = new Image();
    img.onload = () => {
      const scale = Math.max(PW / img.naturalWidth, PH / img.naturalHeight);
      ctx.drawImage(img, (PW - img.naturalWidth * scale) / 2, (PH - img.naturalHeight * scale) / 2, img.naturalWidth * scale, img.naturalHeight * scale);
      setCellThumbUrl(canvas.toDataURL('image/png'));
    };
    const url = URL.createObjectURL(personBlob);
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [personBlob, fillStyle, cellSizePx]);

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
        <span>🖨️</span>
        排版打印
      </h3>

      {/* 纸张选择 */}
      <div>
        <label className="block text-xs text-gray-500 mb-2">选择相纸 / 纸张</label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {PAPER_SIZES.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPaper(p.id)}
              className={`touch-btn px-3 py-2.5 rounded-xl text-sm transition-all ${
                selectedPaper === p.id
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
              title={p.description}
            >
              <div className="font-medium">{p.name}</div>
              <div className={`text-xs mt-0.5 ${selectedPaper === p.id ? 'text-white/70' : 'text-gray-400'}`}>
                {p.widthMm}×{p.heightMm}mm
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 参数调整 */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">
            边距: {margin}mm
          </label>
          <input
            type="range"
            min={0}
            max={20}
            value={margin}
            onChange={(e) => setMargin(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
              [&::-webkit-slider-thumb]:bg-brand-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">
            间距: {spacing}mm
          </label>
          <input
            type="range"
            min={0}
            max={10}
            value={spacing}
            onChange={(e) => setSpacing(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
              [&::-webkit-slider-thumb]:bg-brand-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md"
          />
        </div>
      </div>

      {/* 选项 */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={showCropMarks}
          onChange={(e) => setShowCropMarks(e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
        />
        <span className="text-sm text-gray-600">显示裁切线</span>
      </label>

      {/* 大排版预览 */}
      {layoutResult && paperInfo && (
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-center justify-between text-sm mb-3">
            <span className="text-gray-600">
              <span className="font-medium text-gray-800">{layoutResult.cols}列×{layoutResult.rows}行</span>
              {' = '}
              <span className="font-semibold text-brand-600">{layoutResult.total}张</span>
              {' / 页'}
            </span>
            <span className="text-gray-400 text-xs">
              {paperInfo.name} · {layoutResult.actualWidthMm.toFixed(0)}×{layoutResult.actualHeightMm.toFixed(0)}mm
            </span>
          </div>

          {/* 预览图 — 宽度 100%，按纸比例定高 */}
          <div
            className="relative w-full bg-white rounded-lg border border-gray-200 overflow-hidden"
            style={{ aspectRatio: `${paperInfo.widthMm} / ${paperInfo.heightMm}` }}
          >
            {/* 纸张底色 */}
            <div className="absolute inset-0 bg-gray-50" />

            {/* 排版单元格 — 每格显示实际照片 */}
            {layoutResult.cells.map((cell, i) => (
              <div
                key={i}
                className="absolute"
                style={{
                  left: `${(cell.x / paperInfo.widthMm) * 100}%`,
                  top: `${(cell.y / paperInfo.heightMm) * 100}%`,
                  width: `${(cell.w / paperInfo.widthMm) * 100}%`,
                  height: `${(cell.h / paperInfo.heightMm) * 100}%`,
                  backgroundImage: cellThumbUrl ? `url(${cellThumbUrl})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundColor: '#f0f0f0',
                }}
              />
            ))}

            {/* 裁切线 */}
            {showCropMarks && layoutResult.cells.map((cell, i) => (
              <div
                key={`crop-${i}`}
                className="absolute border border-dashed border-gray-300/40 pointer-events-none"
                style={{
                  left: `${(cell.x / paperInfo.widthMm) * 100}%`,
                  top: `${(cell.y / paperInfo.heightMm) * 100}%`,
                  width: `${(cell.w / paperInfo.widthMm) * 100}%`,
                  height: `${(cell.h / paperInfo.heightMm) * 100}%`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <button
        onClick={handleRender}
        disabled={rendering || !layoutResult || layoutResult.total < 1}
        className={`w-full touch-btn py-3.5 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
          rendering
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
            : 'bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-200'
        }`}
      >
        {rendering ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            排版生成中...
          </>
        ) : (
          <>
            📥 下载排版文件（{layoutResult?.total || 0}张/页）
          </>
        )}
      </button>

      <p className="text-[11px] text-gray-400 text-center">
        排版完成后可到打印店冲洗或自行打印，沿裁切线裁剪即可
      </p>
    </div>
  );
}
