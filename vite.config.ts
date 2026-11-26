import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

// The API runs on its own port in dev (see `npm run dev`); Vite proxies /api.
const api = `http://localhost:${process.env.API_PORT ?? 8787}`;

export default defineConfig({
  root: "web",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./web/src", import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: { "/api": { target: api, changeOrigin: true } },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router"],
          wallet: ["wagmi", "viem"],
          charts: ["recharts"],
          motion: ["motion"],
        },
      },
    },
  },
});
