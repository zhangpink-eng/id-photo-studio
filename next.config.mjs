/** @type {import('next').NextConfig} */
const nextConfig = {
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
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // onnxruntime-web 的 .mjs 文件经过 patch 后包含 CJS 语法 + export default，
      // 需要让 webpack 以 auto 模式解析（非严格 ESM），避免 SWC/terser 报错。
      config.module.rules.push({
        test: /ort\.\w+.*\.mjs$/,
        include: /node_modules[\\/]onnxruntime-web/,
        type: 'javascript/auto',
      });
    }
    return config;
  },
};

export default nextConfig;
