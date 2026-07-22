'use client';

import { useState, useMemo } from 'react';
import { getScenesByCategory, getHotScenes, searchScenes, type SceneConfig } from '@/lib/scenes';

interface SceneSelectorProps {
  onSelect: (scene: SceneConfig) => void;
}

export default function SceneSelector({ onSelect }: SceneSelectorProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SceneConfig | null>(null);

  const grouped = useMemo(() => getScenesByCategory(), []);
  const hotScenes = useMemo(() => getHotScenes(), []);
  const searchResults = useMemo(() => searchScenes(search), [search]);

  const categories = useMemo(() => Object.keys(grouped), [grouped]);

  const handleConfirm = () => {
    if (selected) onSelect(selected);
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* 标题 */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-3">
          你想用照片做什么？
        </h2>
        <p className="text-gray-500">
          选择用途后，系统自动匹配尺寸、底色和规格要求
        </p>
      </div>

      {/* 搜索框 */}
      <div className="relative mb-8">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍  搜索场景，如「护照」「考研」「签证」…"
          className="w-full px-5 py-4 rounded-2xl border border-gray-200 bg-white text-base shadow-sm
            focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
            placeholder:text-gray-400"
        />
      </div>

      {search ? (
        /* 搜索结果 */
        <div className="space-y-2">
          {searchResults.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-3">🔍</p>
              <p>未找到匹配的场景</p>
              <p className="text-sm mt-1">试试其他关键词</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {searchResults.map((scene) => (
                <SceneCard
                  key={scene.id}
                  scene={scene}
                  isSelected={selected?.id === scene.id}
                  onClick={() => setSelected(scene)}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* 热门场景 */}
          <div className="mb-8">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
              热门场景
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {hotScenes.map((scene) => (
                <SceneCard
                  key={scene.id}
                  scene={scene}
                  isSelected={selected?.id === scene.id}
                  onClick={() => setSelected(scene)}
                />
              ))}
            </div>
          </div>

          {/* 全部分类 */}
          <div className="space-y-8">
            {categories.map((cat) => (
              <div key={cat}>
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
                  {cat}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {grouped[cat].map((scene) => (
                    <SceneCard
                      key={scene.id}
                      scene={scene}
                      isSelected={selected?.id === scene.id}
                      onClick={() => setSelected(scene)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 选中场景的规格卡片 */}
      {selected && (
        <div className="mt-8 bg-gradient-to-r from-brand-50 to-blue-50 rounded-2xl border border-brand-100 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{selected.icon}</span>
                <h4 className="text-lg font-bold text-gray-800">{selected.name}</h4>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div className="bg-white rounded-xl px-3 py-2.5 shadow-sm">
                  <span className="text-gray-400 block text-xs">照片尺寸</span>
                  <span className="font-medium text-gray-800">{selected.sizeId}</span>
                </div>
                <div className="bg-white rounded-xl px-3 py-2.5 shadow-sm">
                  <span className="text-gray-400 block text-xs">背景颜色</span>
                  <span className="flex items-center gap-2">
                    <span
                      className="w-4 h-4 rounded-full border border-gray-200"
                      style={{ backgroundColor: selected.bgColor }}
                    />
                    <span className="font-medium text-gray-800">{selected.bgColor === '#FFFFFF' ? '白色' : selected.bgColor === '#4476C7' ? '蓝色' : selected.bgColor === '#E53935' ? '红色' : selected.bgColor}</span>
                  </span>
                </div>
                <div className="bg-white rounded-xl px-3 py-2.5 shadow-sm">
                  <span className="text-gray-400 block text-xs">头部占比</span>
                  <span className="font-medium text-gray-800">
                    {Math.round(selected.headRatio.min * 100)}% - {Math.round(selected.headRatio.max * 100)}%
                  </span>
                </div>
              </div>

              {/* 着装提示 */}
              <div>
                <span className="text-xs font-medium text-gray-500 block mb-1.5">着装要求</span>
                <div className="flex flex-wrap gap-1.5">
                  {selected.tips.map((tip) => (
                    <span
                      key={tip}
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-white/80 text-gray-600 border border-brand-100"
                    >
                      {tip}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleConfirm}
              className="shrink-0 px-6 py-3 bg-brand-600 text-white rounded-xl font-medium
                hover:bg-brand-700 transition-all shadow-lg shadow-brand-200
                active:scale-95 touch-btn"
            >
              使用此规格
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- 单个场景卡片 ---- */
function SceneCard({
  scene,
  isSelected,
  onClick,
}: {
  scene: SceneConfig;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left touch-btn
        ${
          isSelected
            ? 'border-brand-500 bg-brand-50 shadow-md'
            : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'
        }`}
    >
      <span className="text-2xl shrink-0">{scene.icon}</span>
      <div className="min-w-0">
        <div className="font-medium text-gray-800 truncate">{scene.name}</div>
        <div className="text-xs text-gray-400 mt-0.5">
          {scene.category}
        </div>
      </div>
      {isSelected && (
        <span className="ml-auto text-brand-500 shrink-0">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      )}
    </button>
  );
}
