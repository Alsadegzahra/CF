import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Same base for dev and prod so FastAPI can serve the SPA at http://127.0.0.1:8000/ (no /app/ prefix).
export default defineConfig(() => ({
  plugins: [react()],
  base: "/",
  server: {
    port: 5173,
    proxy: {
      // Prefix match: /matches, /matches/foo/report, … → FastAPI
      "/matches": { target: "http://127.0.0.1:8000", changeOrigin: true },
      "/health": { target: "http://127.0.0.1:8000", changeOrigin: true },
    },
  },
}));
