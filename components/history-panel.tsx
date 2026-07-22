'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getAllHistoryRecords,
  deleteHistoryRecord,
  clearAllHistory,
  getHistoryCount,
  type HistoryRecord,
} from '@/lib/history';

interface HistoryPanelProps {
  /** 是否显示 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 点击某条记录重新下载 */
  onSelect?: (record: HistoryRecord) => void;
}

export default function HistoryPanel({ open, onClose, onSelect }: HistoryPanelProps) {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getAllHistoryRecords();
      setRecords(all);
      setCount(all.length);
    } catch (err) {
      console.error('加载历史记录失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) loadRecords();
  }, [open, loadRecords]);

  const handleDelete = useCallback(
    async (id: number, e: React.MouseEvent) => {
      e.stopPropagation();
      await deleteHistoryRecord(id);
      setRecords((prev) => prev.filter((r) => r.id !== id));
      setCount((c) => c - 1);
    },
    [],
  );

  const handleClearAll = useCallback(async () => {
    if (!confirm('确定清空所有历史记录？此操作不可撤销。')) return;
    await clearAllHistory();
    setRecords([]);
    setCount(0);
  }, []);

  const handleSelect = useCallback(
    (record: HistoryRecord) => {
      setSelectedId(record.id);
      if (onSelect) onSelect(record);
    },
    [onSelect],
  );

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const bgColorLabel = (color: string) => {
    if (color === '#FFFFFF') return '白底';
    if (color === '#4476C7') return '蓝底';
    if (color === '#E53935') return '红底';
    return color;
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-20">
      {/* 遮罩层 */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* 面板 */}
      <div className="relative w-full max-w-2xl mx-4 bg-white rounded-2xl shadow-2xl border border-gray-100 max-h-[80vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-800">📸 我的证件照相册</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {loading ? '加载中...' : `共 ${count} 条记录（保存在本地浏览器）`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {count > 0 && (
              <button
                onClick={handleClearAll}
                className="text-xs text-red-500 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
              >
                清空
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <svg className="animate-spin h-8 w-8 mb-3" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm">加载中...</span>
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <span className="text-5xl mb-4">🖼️</span>
              <p className="text-base font-medium">暂无历史记录</p>
              <p className="text-xs mt-1">制作并下载证件照后，记录将自动保存到这里</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {records.map((record) => (
                <div
                  key={record.id}
                  onClick={() => handleSelect(record)}
                  className={`group relative bg-white rounded-xl border overflow-hidden cursor-pointer transition-all hover:shadow-md ${
                    selectedId === record.id ? 'ring-2 ring-brand-500 border-brand-500' : 'border-gray-100'
                  }`}
                >
                  {/* 缩略图 */}
                  <div className="aspect-[3/4] bg-gray-50 overflow-hidden">
                    <img
                      src={record.thumbnailDataUrl}
                      alt={record.sizeName}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  {/* 信息 */}
                  <div className="p-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      {record.sceneName && (
                        <span className="text-xs font-medium text-gray-800 truncate">
                          {record.sceneName}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">{record.sizeName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-gray-400">{formatDate(record.createdAt)}</span>
                      <span className="text-[11px] text-gray-400">{bgColorLabel(record.bgColor)}</span>
                    </div>
                  </div>

                  {/* 删除按钮（hover 显示） */}
                  <button
                    onClick={(e) => handleDelete(record.id, e)}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center
                      opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                    title="删除"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部 */}
        {selectedId !== null && (
          <div className="border-t border-gray-100 px-6 py-3 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">已选中一条记录</span>
              <button
                onClick={() => setSelectedId(null)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                取消选择
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
