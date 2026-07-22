import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '一拍即合 - 免费在线证件照制作 | AI智能抠图 换底色 标准尺寸',
  description:
    '免费在线证件照制作工具，AI智能抠图一键去除背景，支持一寸二寸身份证护照签证等标准尺寸，白底蓝底红底换色，自带美颜。浏览器本地处理，照片不上传服务器，隐私安全。',
  keywords: [
    '证件照',
    '一寸照',
    '二寸照',
    '证件照制作',
    'AI抠图',
    '证件照换底色',
    '证件照在线制作',
    '免费证件照',
    '证件照美颜',
    'id photo',
  ],
  authors: [{ name: '一拍即合' }],
  openGraph: {
    title: '一拍即合 - 免费在线证件照制作',
    description: 'AI智能抠图 · 多色背景 · 标准尺寸 · 完全本地处理，隐私无忧',
    type: 'website',
    locale: 'zh_CN',
  },
  robots: 'index, follow',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#3b82f6',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📷</text></svg>" />
        <meta name="application-name" content="一拍即合证件照" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body>{children}</body>
    </html>
  );
}
