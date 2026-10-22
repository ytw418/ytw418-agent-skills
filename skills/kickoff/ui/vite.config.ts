import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// serve.py 가 dist/ 를 그대로 서빙한다. 개발할 때는 API 를 serve.py 로 넘긴다.
export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist", chunkSizeWarningLimit: 4000 },
  server: { proxy: { "/api": process.env.KICKOFF_API ?? "http://127.0.0.1:4591" } },
});
