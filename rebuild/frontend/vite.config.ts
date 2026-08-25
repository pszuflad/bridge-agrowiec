import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Kontrakt z tools/deploy-staging.sh: `npm run build` produkuje dist/ serwowane
// z korzenia docroota subdomeny (base "/"), a /api jest proxowane przez Apache
// do backendu na 127.0.0.1:5001 (deploy/staging/htaccess:12).
export default defineConfig({
  base: "/",
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  build: {
    outDir: "dist",
    // Bez sourcemap: `deploy-staging.sh` rsynkuje CAŁE dist/ do publicznego docroota
    // (bez żadnej autoryzacji), więc mapy wystawiłyby pełne źródła panelu w internet.
    // Produkcja też ich nie serwuje (mirror/frontend/index.html linkuje sam bundle).
    sourcemap: false,
  },
  server: {
    port: 5173,
    // Lokalny dev jest same-origin tak samo jak staging — dzięki temu cookie
    // `bridge_session` działa bez żadnych wyjątków na CORS.
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5001",
        changeOrigin: false,
      },
    },
  },
});
