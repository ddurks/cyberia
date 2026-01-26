import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0', // Allow network access
    open: false,
    hmr: {
      overlay: true,
    },
    // Proxy WebSocket connections to work around iOS Safari WebSocket bug
    proxy: {
      '/ws': {
        target: 'ws://localhost:7777',
        ws: true,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ws/, ''),
      },
    },
  },
  build: {
    target: "esnext",
  },
});
