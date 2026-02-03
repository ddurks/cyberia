import { defineConfig } from "vite";
import { cp } from "fs/promises";
import path from "path";

const copyAssetsPlugin = {
  name: "copy-assets",
  async writeBundle(options) {
    const assetsDir = path.resolve(__dirname, "assets");
    const outDir = options.dir;
    const outAssetsDir = path.join(outDir, "assets");

    try {
      await cp(assetsDir, outAssetsDir, { recursive: true, force: true });
      console.log("✓ Assets copied to dist/assets");
    } catch (err) {
      console.error("Failed to copy assets:", err);
    }
  },
};

export default defineConfig({
  server: {
    port: 3000,
    host: "0.0.0.0", // Allow network access
    open: false,
    hmr: {
      overlay: true,
    },
    // Proxy WebSocket connections to work around iOS Safari WebSocket bug
    proxy: {
      "/ws": {
        target: "http://localhost:7777",
        ws: true,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ws/, ""),
        configure: (proxy, options) => {
          proxy.on("error", (err, req, res) => {
            console.log("Proxy error:", err);
          });
          proxy.on("proxyReq", (proxyReq, req, res) => {
            console.log("Proxying WS request to:", proxyReq.path);
          });
        },
      },
      "/world-ws": {
        target: "wss://world.drawvid.com",
        ws: true,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/world-ws/, ""),
      },
    },
  },
  build: {
    target: "esnext",
  },
  plugins: [copyAssetsPlugin],
});
