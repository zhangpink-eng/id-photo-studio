/** @type {import('next').NextConfig} */
const nextConfig = {
  // @imgly/background-removal 在浏览器端通过 CDN 动态加载，
  // 为了 WASM 多线程需要 SharedArrayBuffer
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
    ];
  },
};

export default nextConfig;
