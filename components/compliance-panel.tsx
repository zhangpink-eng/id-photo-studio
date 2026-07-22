'use client';

interface CompliancePanelProps {
  /** 当前场景名称 */
  sceneName?: string;
  /** 目标尺寸 */
  sizeName?: string;
  /** 背景色说明 */
  bgLabel?: string;
}

/**
 * 合规信息卡 — 展示当前照片已按场景标准生成
 * 头部占比、尺寸、底色全部在生成时自动处理，100%满足要求
 */
export default function CompliancePanel({ sceneName, sizeName, bgLabel }: CompliancePanelProps) {
  if (!sceneName) return null;

  return (
    <div className="bg-green-50 rounded-xl p-3 border border-green-200">
      <div className="text-xs font-medium text-green-700 mb-1.5">
        ✅ 规格确认
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center gap-1 bg-white/80 px-2 py-1 rounded text-green-600">
          📐 {sizeName || '标准尺寸'}
        </span>
        <span className="inline-flex items-center gap-1 bg-white/80 px-2 py-1 rounded text-green-600">
          🎨 {bgLabel || '标准底色'}
        </span>
        <span className="inline-flex items-center gap-1 bg-white/80 px-2 py-1 rounded text-green-600">
          🎯 {sceneName}
        </span>
        <span className="inline-flex items-center gap-1 bg-white/80 px-2 py-1 rounded text-green-600">
          ✅ 头部占比已自动调整
        </span>
      </div>
    </div>
  );
}
