import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '一拍即合 · 证件照制作',
  description: '在线证件照制作工具 — AI智能抠图，多种背景色和尺寸可选，免费使用',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
