import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  outputFileTracingIncludes: {
    '/api/ocr': [
      './node_modules/tesseract.js/src/worker-script/node/**/*',
      './node_modules/tesseract.js/src/worker-script/**/*',
      './node_modules/tesseract.js-core/**/*',
      './node_modules/wasm-feature-detect/**/*',
      './node_modules/sharp/**/*',
      './node_modules/@img/sharp-*/**/*',
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
