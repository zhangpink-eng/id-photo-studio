'use client';

import { useState, useEffect } from 'react';
import { quickPrecheck, type PrecheckResult } from '@/lib/precheck';
import type { SceneConfig } from '@/lib/scenes';
import type { PrecheckItem } from '@/lib/precheck';

interface PrecheckOverlayProps {
  imageUrl: string;
  scene: SceneConfig | null;
  onConfirm: () => void;
  onReject: () => void;
}

function PrecheckIcon({ level }: { level: string }) {
  if (level === 'pass') return <span className="text-green-500">✅</span>;
  if (level === 'autoFix') return <span className="text-blue-500">🔧</span>;
  if (level === 'warn') return <span className="text-amber-500">⚠️</span>;
  return <span className="text-red-500">❌</span>;
}

function PrecheckRow({ item }: { item: PrecheckItem }) {
  const bg = item.level === 'pass' ? 'bg-green-50'
    : item.level === 'autoFix' ? 'bg-blue-50'
    : item.level === 'warn' ? 'bg-amber-50'
    : 'bg-red-50';
  const textColor = item.level === 'pass' ? 'text-green-700'
    : item.level === 'autoFix' ? 'text-blue-700'
    : item.level === 'warn' ? 'text-amber-700'
    : 'text-red-700';

  return (
    <div className={`flex items-start gap-2.5 px-4 py-2.5 rounded-xl text-sm ${bg}`}>
      <span className="shrink-0 mt-0.5"><PrecheckIcon level={item.level} /></span>
      <div className="min-w-0 flex-1">
        <div className={`font-medium ${textColor}`}>
          {item.name}：{item.message}
        </div>
        {item.level === 'autoFix' && (
          <div className="text-xs text-blue-600 mt-0.5">{item.autoAction}</div>
        )}
        {(item.level === 'warn' || item.level === 'fail') && item.userAction && (
          <div className="text-xs text-gray-500 mt-0.5">💡 {item.userAction}</div>
        )}
      </div>
    </div>
  );
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
      if (!cancelled) { setResult(res); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [imageUrl, scene?.name]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-sm">
      <div className="w-full max-w-xl mx-auto px-6">
        {loading ? (
          <div className="text-center py-16">
            <svg className="animate-spin w-10 h-10 mx-auto mb-4 text-brand-500" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-gray-500 text-sm">正在检测照片...</p>
          </div>
        ) : result ? (
          <>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-100 shrink-0 border border-gray-200">
                <img src={imageUrl} alt="预览" className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-gray-800">确认照片</h2>
                {scene && <p className="text-sm text-gray-500 mt-0.5">{scene.icon} {scene.name}</p>}
                <p className="text-sm text-gray-400 mt-0.5">{result.summary}</p>
              </div>
            </div>

            <div className="space-y-2 mb-6">
              {result.items.map((item) => <PrecheckRow key={item.id} item={item} />)}
            </div>

            {scene && scene.tips.length > 0 && (
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 mb-6">
                <p className="text-xs font-medium text-blue-700 mb-2">📋 此场景还需要您确认：</p>
                <div className="flex flex-wrap gap-1.5">
                  {scene.tips.map((tip) => (
                    <span key={tip} className="text-xs bg-white/80 text-blue-600 px-2.5 py-1 rounded-full border border-blue-100">{tip}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button onClick={onReject} className="flex-1 touch-btn py-3.5 rounded-xl font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all">
                🔄 换一张照片
              </button>
              <button onClick={onConfirm} className="flex-[2] touch-btn py-3.5 rounded-xl font-medium bg-brand-600 text-white hover:bg-brand-700 shadow-lg transition-all active:scale-95">
                ✅ 确认，开始处理
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
