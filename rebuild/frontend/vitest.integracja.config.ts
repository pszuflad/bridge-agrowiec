import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Testy integracyjne przeciw ŻYWEMU backendowi z `rebuild/backend` — bez mocków.
 * Osobna konfiguracja, bo:
 *  - wymagają zainstalowanych zależności backendu, a job `frontend` w CI ich nie ma
 *    (`.github/workflows/ci.yml` instaluje wyłącznie `rebuild/frontend`),
 *  - startują prawdziwy serwer, więc potrzebują dłuższego limitu czasu.
 * Uruchomienie: `npm run test:integracja` (patrz README).
 */
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    globals: true,
    environment: "jsdom",
    environmentOptions: { jsdom: { url: "http://localhost:5173/" } },
    include: ["test/integracja/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
