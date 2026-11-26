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
    // No manual vendor chunks: routes, the pay flow (wallet stack) and the
    // landing simulator (charts) are lazy imports, so each page downloads only
    // what it renders.
    chunkSizeWarningLimit: 900,
  },
});
