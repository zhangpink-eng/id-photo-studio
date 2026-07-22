'use client';

import { useState, useEffect, useCallback } from 'react';
import { quickPrecheck, type PrecheckResult, type PrecheckItem } from '@/lib/precheck';
import type { SceneConfig } from '@/lib/scenes';

interface PrecheckOverlayProps {
  imageUrl: string;
  scene: SceneConfig | null;
  onConfirm: () => void;
  onReject: () => void;
}

export default function PrecheckOverlay({
  imageUrl,
  scene,
  onConfirm,
  onReject,
}: PrecheckOverlayProps) {
  const [result, setResult] = useState<PrecheckResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    quickPrecheck(imageUrl, scene?.name).then((res) => {
      if (!cancelled) {
        setResult(res);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [imageUrl, scene?.name]);

  const items = result?.items || [];
  const fails = items.filter((i) => i.level === 'fail');
  const warns = items.filter((i) => i.level === 'warn');
  const passes = items.filter((i) => i.level === 'pass');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-sm">
      <div className="w-full max-w-xl mx-auto px-6">
        {loading ? (
          /* 加载中 */
          <div className="text-center py-16">
            <svg className="animate-spin w-10 h-10 mx-auto mb-4 text-brand-500" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-gray-500 text-sm">正在检测照片...</p>
          </div>
        ) : result ? (
          <>
            {/* 标题 */}
            <div className="flex items-center gap-4 mb-8">
              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-100 shrink-0 border border-gray-200">
                <img src={imageUrl} alt="预览" className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-gray-800">确认照片</h2>
                {scene && (
                  <p className="text-sm text-gray-500 mt-0.5">
                    {scene.icon} {scene.name} · {scene.sizeId}
                  </p>
                )}
                <p className="text-sm text-gray-400 mt-0.5">
                  {result.summary}
                </p>
              </div>
            </div>

            {/* 检测结果列表 */}
            <div className="space-y-2 mb-8">
              {/* 不合格项 */}
              {fails.map((item) => (
                <PrecheckItemRow key={item.id} item={item} />
              ))}
              {/* 警告项 */}
              {warns.map((item) => (
                <PrecheckItemRow key={item.id} item={item} />
              ))}
              {/* 通过项 */}
              {passes.map((item) => (
                <PrecheckItemRow key={item.id} item={item} />
              ))}
            </div>

            {/* 场景着装/表情提醒 */}
            {scene && scene.tips.length > 0 && (
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 mb-8">
                <p className="text-xs font-medium text-blue-700 mb-2">
                  📋 此场景还需要您确认以下几点
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {scene.tips.map((tip) => (
                    <span key={tip} className="text-xs bg-white/80 text-blue-600 px-2.5 py-1 rounded-full border border-blue-100">
                      {tip}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex items-center gap-3">
              <button
                onClick={onReject}
                className="flex-1 touch-btn py-3.5 rounded-xl font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
              >
                🔄 换一张照片
              </button>
              <button
                onClick={onConfirm}
                className="flex-[2] touch-btn py-3.5 rounded-xl font-medium bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-200 transition-all active:scale-95"
              >
                {fails.length > 0 ? '忽略问题，继续处理' : '✅ 确认无误，开始处理'}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

/** 单条检测项 */
function PrecheckItemRow({ item }: { item: PrecheckItem }) {
  const icon = item.level === 'pass' ? '✅' : item.level === 'warn' ? '⚠️' : '❌';
  const bg = item.level === 'pass' ? 'bg-green-50' : item.level === 'warn' ? 'bg-amber-50' : 'bg-red-50';
  const textColor = item.level === 'pass' ? 'text-green-700' : item.level === 'warn' ? 'text-amber-700' : 'text-red-700';

  return (
    <div className={`flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm ${bg}`}>
      <span className="shrink-0 mt-0.5">{icon}</span>
      <div className="min-w-0">
        <div className={`font-medium ${textColor}`}>{item.name}：{item.message}</div>
        {item.suggestion && (
          <div className="text-xs text-gray-500 mt-0.5">💡 {item.suggestion}</div>
        )}
      </div>
    </div>
  );
}
