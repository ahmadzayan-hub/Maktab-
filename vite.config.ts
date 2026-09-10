import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// Lahza — front-end SPA build config.
// Manual chunking keeps the initial bundle small (router split from vendor)
// to protect the LCP / INP performance targets.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    target: "es2020",
    cssCodeSplit: true,
    rolldownOptions: {
      output: {
        // Rolldown (Vite 8) only accepts the function form of manualChunks.
        manualChunks(id) {
          if (id.includes("node_modules/react-router")) return "router";
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/scheduler/")
          ) {
            return "react";
          }
        },
      },
    },
  },
});
