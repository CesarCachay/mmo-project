import { defineConfig } from "vite";

const REALTIME_VENDOR_RE =
  /(?:node_modules[\\/](?:socket\.io-client|engine\.io-client|socket\.io-parser|engine\.io-parser)[\\/]|node_modules[\\/]@socket\.io[\\/]component-emitter[\\/])/;

export default defineConfig({
  build: {
    manifest: true,
    chunkSizeWarningLimit: 500,
    reportCompressedSize: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "phaser-vendor",
              test: /node_modules[\\/]phaser[\\/]/,
              priority: 30,
            },
            {
              name: "realtime-vendor",
              test: REALTIME_VENDOR_RE,
              priority: 20,
            },
          ],
        },
      },
    },
  },
});
