import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sandevistanDevApi } from "./server/dev-api.js";

export default defineConfig({
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    hmr: false,
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.tsx"],
    },
  },
  test: {
    exclude: ["**/.worktrees/**", "**/node_modules/**", "**/dist/**"],
    fileParallelism: false,
    maxWorkers: 1,
  },
  plugins: [sandevistanDevApi(), react()],
});
