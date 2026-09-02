import compression from "compression";
import express, { type Express } from "express";
import type { Env } from "./config/env.js";
import type { Baza } from "./db/index.js";
import { optionalAuth } from "./middleware/auth.js";
import { corsZAllowlisty } from "./middleware/cors.js";
import { bladHandler, nieZnalezionoHandler } from "./middleware/errors.js";
import { trasyAuth } from "./routes/auth.js";
import { trasyHistorii } from "./routes/history.js";
import { trasyDostawcow } from "./routes/suppliers.js";
import { trasyImportu } from "./routes/import.js";
import { trasyProduktow } from "./routes/products.js";
import { trasyStagingu } from "./routes/staging.js";
import { trasyMutacjiStagingu } from "./routes/staging-mutacje.js";
import { trasyOverrides } from "./routes/overrides.js";
import { trasyNarzutow } from "./routes/markups.js";
import { trasyPromocji } from "./routes/promotions.js";
import type { OpcjeSynchronizacji, WynikSynchronizacji } from "./import/synchronizuj.js";

export type ZaleznosciApp = {
  env: Env;
  db: Baza;
  /**
   * JEDNA instancja `synchronizujDostawce` na proces (nota 3f-2). `server.ts` tworzy ją raz
   * i podaje TU oraz schedulerowi z 3f-3 — bez tego trasa i automat dostałyby własne
   * `silnikStagingu`. Pominięta (testy, dev) ⇒ `trasyDostawcow` tworzy własną, jak dotąd.
   */
  synchronizuj?: (kod: string, opcje?: OpcjeSynchronizacji) => Promise<WynikSynchronizacji>;
  /**
   * Przeplanowanie schedulera po udanym `PATCH /api/dostawcy/{id}` (blok 3f-3).
   *
   * ODSTĘPSTWO ŚWIADOME, decyzja użytkownika 2026-09-01. Oryginalne `D4()` nie jest wołane
   * z ŻADNEJ trasy — zweryfikowane grafem wywołań: jedyne wywołanie jest w `M4()` (`:48167`).
   * Skutek w produkcji: Ania zmienia „co 4 godz.", dostaje „Zapisano", a automat chodzi ze
   * starym interwałem AŻ DO RESTARTU procesu. Do 3f-2 było to niewidoczne (częstotliwość
   * zmieniało się PATCH-em z konsoli), ale po wchłonięciu `freq-injection.js` jest na to
   * przycisk w panelu, więc cisza po zapisie stała się zachowaniem mylącym.
   * Pominięte (testy, dev) ⇒ zachowanie 1:1 z oryginałem, czyli brak przeplanowania.
   */
  przeplanujScheduler?: () => void;
};

/**
 * Fabryka aplikacji Express — BEZ `listen()`, żeby testy mogły ją tworzyć w pamięci
 * (supertest) bez zajmowania portu. Nasłuch startuje dopiero `server.ts`.
 */
export function stworzApp({
  env,
  db,
  synchronizuj,
  przeplanujScheduler,
}: ZaleznosciApp): Express {
  const app = express();

  // Staging i produkcja stoją za proxy Apache (X-Forwarded-*) — bez tego
  // req.ip i req.protocol pokazywałyby adres proxy zamiast klienta.
  app.set("trust proxy", true);
  app.disable("x-powered-by");

  // Kolejność jak w oryginale: najpierw CORS (żeby preflight OPTIONS nie przechodził
  // przez parser ciała), potem parsery (backend-index.cjs:48926-48940).
  if (env.CORS_ORIGINS.length > 0) app.use(corsZAllowlisty(env.CORS_ORIGINS));

  // ODSTĘPSTWO ŚWIADOME (ticket 3-FEATURE-katalog-odczyt, D2): oryginał nie kompresuje
  // odpowiedzi. Katalog wierny produkcji pobiera CAŁĄ tabelę produktów jednym żądaniem
  // (routes/products.ts — wariant „goła tablica"), co przy ~7 400 pozycjach daje ok. 15 MB
  // JSON-a. Kompresja to warstwa TRANSPORTU: ciało odpowiedzi, kontrakt i kształt danych
  // pozostają identyczne, zmienia się tylko liczba bajtów w locie.
  app.use(compression());

  // Limit 50 MB — 1:1 z oryginałem (backend-index.cjs:48932, :48939). Import z Iteracji 3
  // przesyła duże pakiety danych, więc obniżenie limitu byłoby cichą zmianą zachowania.
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: false, limit: "50mb" }));

  // Odpowiednik globalnego `e.use(C4)` z oryginału (backend-index.cjs:48156):
  // wypełnia req.user, gdy żądanie niesie ważny token. O dostępie decyduje requireAuth.
  app.use(optionalAuth(env.JWT_SECRET));

  // Publiczne z definicji: healthcheck dla PM2/monitoringu (nie zwraca żadnych danych).
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use(trasyAuth({ db, jwtSecret: env.JWT_SECRET, cookieSecure: env.cookieSecure }));
  app.use(trasyProduktow({ db }));
  app.use(
    trasyDostawcow({
      db,
      katalogArchiwum: env.IMPORT_ARCHIVE_DIR,
      synchronizuj,
      przeplanujScheduler,
    }),
  );
  app.use(trasyStagingu({ db }));
  app.use(trasyMutacjiStagingu({ db }));
  app.use(trasyOverrides({ db }));
  app.use(trasyNarzutow({ db }));
  app.use(trasyPromocji({ db }));
  app.use(trasyHistorii({ db }));
  app.use(trasyImportu({ db, katalogArchiwum: env.IMPORT_ARCHIVE_DIR }));

  app.use(nieZnalezionoHandler);
  app.use(bladHandler);

  return app;
}
