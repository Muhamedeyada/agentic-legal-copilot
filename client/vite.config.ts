import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/health": "http://127.0.0.1:3001",
      "/events": "http://127.0.0.1:3001",
      "/reviews": "http://127.0.0.1:3001",
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
        timeout: 0,
      },
    },
  },
});
