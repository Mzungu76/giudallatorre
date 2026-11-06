import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// Le risorse statiche (carte, ritagli, scena, manifest, icone) stanno in /public alla radice del repository.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  publicDir: fileURLToPath(new URL("../../public", import.meta.url)),
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true, target: "es2022" },
  server: { port: 5173, proxy: { "/api": "http://127.0.0.1:8787", "/ws": { target: "ws://127.0.0.1:8787", ws: true } } },
});
