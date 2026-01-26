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
        target: 'http://localhost:7777',
        ws: true,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ws/, ''),
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('Proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Proxying WS request to:', proxyReq.path);
          });
        },
      },
    },
  },
  build: {
    target: "esnext",
  },
});
