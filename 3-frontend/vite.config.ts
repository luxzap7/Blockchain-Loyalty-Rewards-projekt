import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The backend (Part 2) runs on port 3001. The Vite server forwards every /api request to it,
// so the browser only talks to one address and no CORS setup is needed.
const proxy = { "/api": "http://localhost:3001" };

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true, proxy },
  preview: { port: 4173, strictPort: true, proxy },
});
