import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    globals: true,
    environment: "jsdom",
    // Aplikacja woła ścieżki względne (`/api/login`) — jak w przeglądarce.
    // Ten adres jest bazą, względem której rozwiązuje je `test/setup.ts`.
    environmentOptions: { jsdom: { url: "http://localhost:5173/" } },
    setupFiles: ["./test/setup.ts"],
    // Szpiedzy na `fetch` wracają do oryginału automatycznie po każdym teście —
    // nawet gdy test padnie przed `mockRestore()`.
    restoreMocks: true,
    include: ["test/**/*.test.{ts,tsx}"],
    exclude: ["test/integracja/**"],
    css: false,
  },
});
