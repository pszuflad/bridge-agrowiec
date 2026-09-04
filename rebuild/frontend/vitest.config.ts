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
    /**
     * Domyślne 5 s to za mało dla tego zestawu, gdy vitest zrównolegli pliki na obciążonej
     * maszynie. Dwie kategorie testów regularnie ocierały się o próg: te renderujące CAŁĄ
     * `<App/>` z leniwie ładowaną trasą `/analityka` (osobny chunk z Recharts) i `tokeny.test.ts`,
     * które buduje arkusz Tailwinda. Efekt: `npm test` wywalał się na dwóch–trzech plikach
     * przy pełnym przebiegu i przechodził, gdy te same pliki puszczało się osobno — czyli
     * fałszywa czerwień zależna od tego, co akurat działa obok (znalezione w review bloku 10c).
     * Podniesienie progu nie spowalnia testów, które i tak przechodzą: `findBy*` i `waitFor`
     * kończą się w chwili spełnienia warunku, a nie po upływie limitu.
     */
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // Szpiedzy na `fetch` wracają do oryginału automatycznie po każdym teście —
    // nawet gdy test padnie przed `mockRestore()`.
    restoreMocks: true,
    include: ["test/**/*.test.{ts,tsx}"],
    exclude: ["test/integracja/**"],
    css: false,
  },
});
