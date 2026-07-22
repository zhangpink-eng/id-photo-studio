'use client';

interface CompliancePanelProps {
  sceneName?: string;
  sizeName?: string;
  bgLabel?: string;
  /** 自动修正结果 */
  fixResults?: { id: string; name: string; message: string; action: string }[];
}

export default function CompliancePanel({ sceneName, sizeName, bgLabel, fixResults }: CompliancePanelProps) {
  const hasFixes = fixResults && fixResults.length > 0;

  return (
    <div className={`rounded-xl p-3 border ${hasFixes ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
      {/* 规格确认 */}
      {sceneName && (
        <>
          <div className="text-xs font-medium text-green-700 mb-1.5">
            ✅ 规格确认
          </div>
          <div className="flex flex-wrap gap-2 text-xs mb-2">
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
        </>
      )}

      {/* 自动修正报告 */}
      {hasFixes && (
        <>
          <div className="text-xs font-medium text-amber-700 mb-1.5">
            🔧 照片自动优化
          </div>
          <div className="space-y-1">
            {fixResults.map((fix) => (
              <div key={fix.id} className="flex items-start gap-1.5 text-xs">
                <span className="shrink-0 mt-0.5">
                  {fix.action === 'fixed' ? '✅' : '💡'}
                </span>
                <span className={fix.action === 'fixed' ? 'text-amber-700' : 'text-gray-500'}>
                  {fix.message}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {!fixResults && sceneName && (
        <div className="text-xs text-green-600">
          全部标准已达标，照片已自动优化完成
        </div>
      )}
    </div>
  );
}
