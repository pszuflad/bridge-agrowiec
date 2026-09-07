import compression from "compression";
import express, { type Express } from "express";
import type { Env } from "./config/env.js";
import type { Baza, BazaSqlite } from "./db/index.js";
import { optionalAuth } from "./middleware/auth.js";
import { corsZAllowlisty } from "./middleware/cors.js";
import { bladHandler, nieZnalezionoHandler } from "./middleware/errors.js";
import { trasyAlertow } from "./routes/alerts.js";
import { trasyAtrybutow } from "./routes/atrybuty.js";
import { trasyAnalityki } from "./routes/analytics.js";
import { zasiejSlownikAtrybutow } from "./repos/atrybuty.js";
import { trasyAuth } from "./routes/auth.js";
import { trasyKonfiguracji } from "./routes/config.js";
import { trasyAdmina } from "./routes/admin.js";
import { trasyUtrzymania } from "./routes/maintenance.js";
import { trasyKonta } from "./routes/konto.js";
import { trasyHistorii } from "./routes/history.js";
import { trasyDostawcow } from "./routes/suppliers.js";
import { trasyImportu } from "./routes/import.js";
import { trasyProduktow } from "./routes/products.js";
import { trasyStagingu } from "./routes/staging.js";
import { trasyMutacjiStagingu } from "./routes/staging-mutacje.js";
import { trasyOverrides } from "./routes/overrides.js";
import { trasyNarzutow } from "./routes/markups.js";
import { trasyPromocji } from "./routes/promotions.js";
import { trasySelly } from "./routes/selly.js";
import { trasyEksportuShoper } from "./routes/export-shoper.js";
import { trasySpedycji } from "./routes/spedycja.js";
import { trasyWagiGabarytowej } from "./routes/waga-gabarytowa.js";
import type { OpcjeSynchronizacji, WynikSynchronizacji } from "./import/synchronizuj.js";
import { stworzKlientaSelly, type KlientSelly } from "./selly/klient.js";
import { opakujKlientaTrybem } from "./selly/tryb.js";

export type ZaleznosciApp = {
  env: Env;
  db: Baza;
  /**
   * Uchwyt do SQLite stojącego pod `db`. Potrzebny WYŁĄCZNIE `POST /api/products/clear`,
   * żeby przed kopią pliku bazy zrzucić WAL (`routes/maintenance.ts`, plan.md D5).
   * Pominięty ⇒ kopia powstaje bez checkpointu, czyli dokładnie jak w oryginale.
   */
  sqlite?: BazaSqlite;
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
  /**
   * Klient REST Selly (Iteracja 8a). Pominięty ⇒ `stworzApp` buduje własny z `env`.
   *
   * Wstrzykiwany po to, żeby testy mogły podać ATRAPĘ (plan.md D2): sześć tras panelu wychodzi
   * do realnego sklepu `agroopony.selly24.pl`, a `POST /api/selly/sync-supplier`
   * z `dry_run=false` tworzy i modyfikuje tam produkty. Żaden bieg `npm test` nie może tego
   * dotknąć nawet przez pomyłkę.
   */
  klientSelly?: KlientSelly;
};

/**
 * Fabryka aplikacji Express — BEZ `listen()`, żeby testy mogły ją tworzyć w pamięci
 * (supertest) bez zajmowania portu. Nasłuch startuje dopiero `server.ts`.
 */
export function stworzApp({
  env,
  db,
  sqlite,
  synchronizuj,
  przeplanujScheduler,
  klientSelly,
}: ZaleznosciApp): Express {
  const app = express();

  // Seed słownika atrybutów — 1:1 z pozycją `seed()` w oryginale, który woła je przy
  // rejestracji modułu (`mirror/backend/atrybuty_module.cjs:99`), czyli przy każdym starcie
  // procesu. Decyzja użytkownika (ticket 29-FEATURE-atrybuty-backend, plan.md D1).
  //
  // ⚠ To NIE jest migracja i nie należy jej za taką brać: seed dosypuje 6 wbudowanych rodzajów
  // ORAZ wartości `marka`/`bieznik` odczytane z aktualnej zawartości `products`, więc jego wynik
  // zmienia się z każdym importem. Steruje tym, co Ania zobaczy w kolejce pending — wartość
  // obecna w słowniku jest przy skanie pomijana. Szczegóły i quirk „bieżnik z modelu”:
  // `repos/atrybuty.ts`.
  //
  // W `try/catch`, bo seed NIE JEST krytyczny dla startu: na bazie bez tabel atrybutów (stary
  // `DB_PATH`, na którym nie puszczono `npm run migrate`) niezabezpieczone wywołanie wywracałoby
  // CAŁY backend przed `listen()`, choć dotąd taka baza pozwalała mu wstać i psuła tylko
  // konkretne trasy. Oryginał nie miał tego problemu, bo wołał `ensureSchema()` przed `seed()`
  // (`atrybuty_module.cjs:98-99`) — my schematu w runtime nie tworzymy (kanonem jest
  // `001_schema.sql`), więc tę samą odporność daje złapanie błędu. Ta sama defensywa, co
  // w oryginale wokół SELECT-ów z `products` („products może nie istnieć", `:78`).
  try {
    zasiejSlownikAtrybutow(db);
  } catch (e) {
    console.error("[atrybuty] seed pominięty:", e instanceof Error ? e.message : e);
  }

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
  app.use(trasyAnalityki({ db }));
  app.use(trasyAlertow({ db }));
  app.use(trasyImportu({ db, katalogArchiwum: env.IMPORT_ARCHIVE_DIR }));
  app.use(trasyKonfiguracji({ db }));
  app.use(trasyKonta({ db }));
  app.use(trasyAdmina({ db, przeplanujScheduler }));
  app.use(trasyUtrzymania({ db, dbPath: env.DB_PATH, sqlite }));
  app.use(trasySpedycji({ db }));
  app.use(
    trasySelly({
      db,
      /*
       * ⚠ Blokada trybu obejmuje TYLKO klienta budowanego z env (ticket 34, D3).
       * Klient wstrzyknięty z zewnątrz (`klientSelly`) idzie nietknięty — to atrapa testowa
       * (`test/gate/selly-atrapa.ts`), a test sam decyduje, co sprawdza; opakowanie jej
       * domyślnym `wylaczony` wywróciłoby GATE 8a/8b, który z blokadą nie ma nic wspólnego.
       */
      klient:
        klientSelly ??
        opakujKlientaTrybem(
          stworzKlientaSelly({
            shopUrl: env.SELLY_SHOP_URL,
            clientId: env.SELLY_CLIENT_ID,
            clientSecret: env.SELLY_CLIENT_SECRET,
            scope: env.SELLY_SCOPE,
          }),
          env.SELLY_TRYB,
        ),
      sciezkiCsv: {
        katalog: env.SELLY_CSV_DIR,
        plik: env.SELLY_CSV_PLIK,
        url: env.SELLY_CSV_URL,
      },
    }),
  );
  app.use(trasyEksportuShoper({ db }));
  app.use(trasyWagiGabarytowej({ db }));
  app.use(trasyAtrybutow({ db }));

  app.use(nieZnalezionoHandler);
  app.use(bladHandler);

  return app;
}
