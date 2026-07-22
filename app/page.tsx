'use client';

import { useState, useCallback } from 'react';
import SceneSelector from '@/components/scene-selector';
import UploadZone from '@/components/upload-zone';
import PhotoEditor from '@/components/photo-editor';
import HistoryPanel from '@/components/history-panel';
import type { SceneConfig } from '@/lib/scenes';

type FlowStep = 'upload' | 'scene' | 'edit';

export default function Home() {
  const [step, setStep] = useState<FlowStep>('upload');
  const [scene, setScene] = useState<SceneConfig | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // 上传照片 → 进入选场景
  const handleImageSelect = useCallback(
    (file: File) => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      setImage(file);
      setImageUrl(URL.createObjectURL(file));
      setStep('scene');
    },
    [imageUrl],
  );

  // 选择场景 → 进入编辑
  const handleSceneSelect = useCallback((selected: SceneConfig) => {
    setScene(selected);
    setStep('edit');
  }, []);

  // 编辑页 → 换场景
  const handleChangeScene = useCallback(() => {
    setStep('scene');
  }, []);

  // 选场景页 → 换照片
  const handleBackToUpload = useCallback(() => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImage(null);
    setImageUrl(null);
    setScene(null);
    setStep('upload');
  }, [imageUrl]);

  // 编辑页 → 重头开始
  const handleReset = useCallback(() => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImage(null);
    setImageUrl(null);
    setScene(null);
    setStep('upload');
  }, [imageUrl]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* ====== 顶栏 ====== */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-2xl shrink-0">📷</span>
              <h1 className="text-lg font-bold text-gray-800 truncate">
                一拍即合{' '}
                <span className="text-sm font-normal text-gray-400 hidden sm:inline">
                  · 证件照制作
                </span>
              </h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* 流程步进指示器 */}
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400 mr-3">
                <StepDot active={step === 'upload'} done={step !== 'upload'} label="上传" />
                <span className="text-gray-300">▸</span>
                <StepDot active={step === 'scene'} done={step === 'edit'} label="场景" />
                <span className="text-gray-300">▸</span>
                <StepDot active={step === 'edit'} done={false} label="编辑" />
              </div>
              <button
                onClick={() => setShowHistory(true)}
                className="text-xs text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-full whitespace-nowrap transition-colors"
                title="查看历史记录"
              >
                📂 历史
              </button>
              <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full whitespace-nowrap">
                🔒 本地处理
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ====== 主内容 ====== */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* 面包屑导航 */}
        {step === 'scene' && (
          <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
            <button onClick={handleBackToUpload} className="hover:text-gray-600 transition-colors">
              ← 重新上传照片
            </button>
          </div>
        )}
        {step === 'edit' && (
          <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
            <button onClick={handleChangeScene} className="hover:text-gray-600 transition-colors">
              ← 更换场景
            </button>
            <span className="text-gray-300">|</span>
            <button onClick={handleBackToUpload} className="hover:text-gray-600 transition-colors">
              重新上传
            </button>
          </div>
        )}

        {/* 第一步：上传 */}
        {step === 'upload' && <UploadZone onImageSelect={handleImageSelect} />}

        {/* 第二步：选场景（带照片预览） */}
        {step === 'scene' && imageUrl && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <SceneSelector onSelect={handleSceneSelect} />
            </div>
            <div className="hidden lg:block">
              <div className="sticky top-24">
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                    已上传照片
                  </h3>
                  <div className="aspect-[3/4] rounded-xl bg-gray-100 overflow-hidden">
                    <img
                      src={imageUrl}
                      alt="已上传照片"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-2 text-center">
                    选择用途后进入编辑
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 第三步：编辑 */}
        {step === 'edit' && image && imageUrl && (
          <PhotoEditor
            key={image.name}
            image={image}
            imageUrl={imageUrl}
            scene={scene}
            onReset={handleReset}
          />
        )}
      </main>

      {/* ====== 底部 ====== */}
      <footer className="border-t border-gray-100 bg-white/50 mt-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span>📷</span>
              <span>一拍即合 · 证件照制作</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span>基于 @imgly/background-removal</span>
              <span>·</span>
              <span>全部浏览器本地处理</span>
              <span>·</span>
              <span className="text-gray-300 cursor-help" title="数据不上传服务器，请放心使用">
                🔒 隐私安全
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* 历史记录面板 */}
      <HistoryPanel
        open={showHistory}
        onClose={() => setShowHistory(false)}
      />
    </div>
  );
}

/* ---- 步进指示点 ---- */
function StepDot({
  active,
  done,
  label,
}: {
  active: boolean;
  done: boolean;
  label: string;
}) {
  let bg: string;
  if (done) bg = 'bg-green-500';
  else if (active) bg = 'bg-brand-500';
  else bg = 'bg-gray-300';

  return (
    <span className="flex items-center gap-1">
      <span className={`w-2 h-2 rounded-full ${bg}`} />
      <span className={active ? 'text-gray-600 font-medium' : ''}>{label}</span>
    </span>
  );
}
