'use client';

import { useCallback, useRef, useState, type DragEvent, type ChangeEvent } from 'react';
import { ACCEPTED_IMAGE_TYPES, MAX_FILE_SIZE } from '@/lib/constants';

interface UploadZoneProps {
  onImageSelect: (file: File) => void;
}

export default function UploadZone({ onImageSelect }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = (file: File): boolean => {
    setError(null);

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setError('不支持的图片格式，请上传 JPG、PNG 或 WebP 格式');
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('图片大小超过 20MB 限制');
      return false;
    }
    return true;
  };

  const handleFile = useCallback(
    (file: File) => {
      if (validateFile(file)) {
        onImageSelect(file);
      }
    },
    [onImageSelect],
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleClick = () => inputRef.current?.click();

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleCameraCapture = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* 标题 */}
      <div className="text-center mb-8">
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-3">
          在线制作专业证件照
        </h2>
        <p className="text-gray-500 max-w-lg mx-auto">
          AI 智能抠图 · 多色背景 · 标准尺寸 · 完全本地处理，隐私无忧
        </p>
      </div>

      {/* 快速操作区 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div
          onClick={handleClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`upload-zone min-h-[260px] ${dragOver ? 'drag-over' : ''}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(',')}
            className="hidden"
            onChange={handleInputChange}
          />

          <div className="w-16 h-16 mb-4 rounded-2xl bg-gradient-to-br from-brand-50 to-blue-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <p className="text-base font-medium text-gray-700 mb-1">
            从相册选择
          </p>
          <p className="text-xs text-gray-400">
            支持 JPG / PNG / WebP，最大 20MB
          </p>
          {error && (
            <div className="mt-3 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs">
              {error}
            </div>
          )}
        </div>

        {/* 拍照入口（桌面隐藏，移动端显示） */}
        <label className="upload-zone min-h-[260px] cursor-pointer sm:hidden">
          <div className="w-16 h-16 mb-4 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
          </div>
          <p className="text-base font-medium text-gray-700 mb-1">
            拍照上传
          </p>
          <p className="text-xs text-gray-400">
            使用摄像头拍摄
          </p>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleCameraCapture}
          />
        </label>
      </div>

      {/* 桌面端额外提示 */}
      <div className="hidden sm:block text-center mb-8">
        <p className="text-sm text-gray-400">
          也可以
          <button onClick={handleClick} className="text-brand-600 hover:text-brand-700 font-medium mx-1">
            点击选择文件
          </button>
          或拖拽照片到上方区域
        </p>
      </div>

      {/* 拍摄提示 */}
      <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: '👤', title: '正面免冠', desc: '面向镜头，双耳露出' },
          { icon: '☀️', title: '光线均匀', desc: '面部无阴影和反光' },
          { icon: '🎯', title: '居中构图', desc: '头部在画面中央' },
        ].map((tip) => (
          <div key={tip.title} className="text-center p-4 bg-white rounded-xl border">
            <div className="text-2xl mb-2">{tip.icon}</div>
            <div className="font-medium text-gray-700 text-sm mb-1">{tip.title}</div>
            <div className="text-xs text-gray-400">{tip.desc}</div>
          </div>
        ))}
      </div>

      {/* 什么场景用什么尺寸 */}
      <div className="mt-10 bg-white rounded-2xl border border-gray-100 p-6">
        <h3 className="text-sm font-medium text-gray-500 text-center mb-5">
          📋 常见证件照规格一览
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { name: '护照/通行证', size: '33×48mm', bg: '蓝底' },
            { name: '身份证', size: '26×32mm', bg: '白底' },
            { name: '驾驶证', size: '22×32mm', bg: '白底' },
            { name: '美国签证', size: '51×51mm', bg: '白底' },
            { name: '1寸照', size: '25×35mm', bg: '蓝/白/红' },
            { name: '2寸照', size: '35×49mm', bg: '蓝/白/红' },
            { name: '考研报名', size: '33×48mm', bg: '蓝底' },
            { name: '结婚证', size: '35×53mm', bg: '红底' },
          ].map((item) => (
            <div key={item.name} className="text-center p-3 rounded-xl bg-gray-50">
              <div className="text-sm font-medium text-gray-700">{item.name}</div>
              <div className="text-xs text-gray-400 mt-0.5">{item.size} · {item.bg}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
