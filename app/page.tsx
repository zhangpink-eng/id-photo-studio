'use client';

import { useState, useCallback } from 'react';
import UploadZone from '@/components/upload-zone';
import PhotoEditor from '@/components/photo-editor';

export default function Home() {
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const handleImageSelect = useCallback((file: File) => {
    // 释放之前的内存
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImage(file);
    setImageUrl(URL.createObjectURL(file));
  }, [imageUrl]);

  const handleReset = useCallback(() => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImage(null);
    setImageUrl(null);
  }, [imageUrl]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* ====== 顶栏 ====== */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📷</span>
              <h1 className="text-lg font-bold text-gray-800">
                一拍即合 <span className="text-sm font-normal text-gray-400 hidden sm:inline">· 证件照制作</span>
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                本地处理 · 隐私安全
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ====== 主内容 ====== */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {!image ? (
          <>
            {/* Hero + 上传 */}
            <UploadZone onImageSelect={handleImageSelect} />

            {/* 产品特性 */}
            <div className="mt-16 max-w-4xl mx-auto">
              <h3 className="text-center text-sm font-medium text-gray-400 uppercase tracking-wider mb-8">
                产品特性
              </h3>
              <div className="grid sm:grid-cols-3 gap-6">
                {[
                  {
                    icon: '🤖',
                    title: 'AI 智能抠图',
                    desc: '基于深度学习的人像分割模型，精准识别并分离人物与背景，无需手动操作。',
                  },
                  {
                    icon: '🎨',
                    title: '灵活定制',
                    desc: '支持白、蓝、红等多种背景色，内置渐变效果，覆盖所有标准证件照尺寸。',
                  },
                  {
                    icon: '🔒',
                    title: '完全本地化',
                    desc: '所有计算在浏览器内完成，图片不上传任何服务器，保护你的隐私安全。',
                  },
                ].map((feat) => (
                  <div
                    key={feat.title}
                    className="text-center p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="text-3xl mb-4">{feat.icon}</div>
                    <h4 className="font-semibold text-gray-800 mb-2">{feat.title}</h4>
                    <p className="text-sm text-gray-500 leading-relaxed">{feat.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <PhotoEditor image={image} imageUrl={imageUrl!} onReset={handleReset} />
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
              <span>全部本地处理</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
