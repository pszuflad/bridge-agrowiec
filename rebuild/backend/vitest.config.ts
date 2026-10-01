import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // Każdy plik testowy tworzy własną bazę SQLite w katalogu tymczasowym,
    // a HTTP idzie przez supertest (bez zajmowania portu) — równoległość jest bezpieczna.
    // JEDEN wyjątek (ticket 139): `test/server.montaz-dostepnosci.test.ts` importuje prawdziwy
    // `src/server.ts`, który zawsze woła `listen()`, więc realnie wiąże port. Bierze go sondą
    // na porcie efemerycznym — ale numer nie jest zarezerwowany, więc to jedyne miejsce w suicie,
    // gdzie równoległy bieg może się teoretycznie zderzyć o port.
    environment: "node",
    // Ponowienia synchronizacji (ticket 179, Etap 4a) czekają w produkcji 120 s między próbami; testy nie czekają.
    env: { SYNC_ODSTEP_PONOWIEN_MS: "0" },
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
