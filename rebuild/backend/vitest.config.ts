import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // Każdy plik testowy tworzy własną bazę SQLite w katalogu tymczasowym,
    // a HTTP idzie przez supertest (bez zajmowania portu) — równoległość jest bezpieczna.
    environment: "node",
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
