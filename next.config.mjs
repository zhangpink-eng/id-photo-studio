/** @type {import('next').NextConfig} */
const nextConfig = {
  // wasm 文件从 public 目录本地加载，无需 COEP/COOP 头
  // 单线程 WASM 模式（不依赖 SharedArrayBuffer），兼容所有浏览器
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // onnxruntime-web 的 .mjs 文件经过 patch 后包含 CJS 语法 + export default，
      // 需要让 webpack 以 auto 模式解析，避免 SWC 报错。
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
