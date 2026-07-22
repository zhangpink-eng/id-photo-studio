'use client';

import { useCallback, useRef, useState, type DragEvent, type ChangeEvent } from 'react';
import { ACCEPTED_IMAGE_TYPES, MAX_FILE_SIZE } from '@/lib/constants';

interface UploadZoneProps {
  onImageSelect: (file: File) => void;
}

export default function UploadZone({ onImageSelect }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
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
    // 允许重复选择同一文件
    e.target.value = '';
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

      {/* 主上传区域 */}
      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className="upload-zone min-h-[300px]"
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          className="hidden"
          onChange={handleInputChange}
        />

        <div className="w-20 h-20 mb-6 rounded-2xl bg-gradient-to-br from-brand-50 to-blue-100 flex items-center justify-center">
          <svg className="w-10 h-10 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </div>

        <p className="text-lg font-semibold text-gray-700 mb-2">
          点击或拖拽选取照片
        </p>
        <p className="text-sm text-gray-400 mb-6">
          支持 JPG / PNG / WebP，最大 20MB
        </p>

        {/* 移动端拍照入口 */}
        <label className="sm:hidden inline-flex items-center gap-2 px-6 py-3 bg-brand-600 text-white rounded-xl text-sm font-medium cursor-pointer active:scale-95 transition-transform">
          <span>📸</span>
          <span>拍照上传</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleCameraCapture}
          />
        </label>

        {error && (
          <div className="mt-4 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}
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

      {/* 规格一览表 */}
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
