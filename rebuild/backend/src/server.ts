// Wejście produkcyjne — `dist/server.js` (kontrakt deployu, tools/deploy-staging.sh).
import { wczytajEnv } from "./config/env.js";
import { otworzBaze } from "./db/index.js";
import { stworzApp } from "./app.js";
import { stworzScheduler } from "./import/scheduler.js";
import { synchronizujDostawce } from "./import/synchronizuj.js";
import { stworzDiscovery } from "./selly/discovery.js";
import { stworzKlientaSelly } from "./selly/klient.js";
import { stworzSchedulerSelly } from "./selly/scheduler-sync.js";
import { syncDelta } from "./selly/sync-delta.js";
import { opakujKlientaTrybem } from "./selly/tryb.js";

const env = wczytajEnv();
const { sqlite, db } = otworzBaze(env.DB_PATH);

// JEDNA instancja na proces (nota 3f-2): tę samą funkcję dostają trasa
// `synchronizuj-teraz` i scheduler. Osobne instancje miałyby osobny `silnikStagingu`.
const synchronizuj = synchronizujDostawce({ db, katalogArchiwum: env.IMPORT_ARCHIVE_DIR });

// Sam obiekt niczego nie uruchamia — timery stawia dopiero `uruchom()` poniżej.
const scheduler = stworzScheduler({
  db,
  synchronizuj,
  pierwszyPrzebieg: env.IMPORT_SCHEDULER_PIERWSZY_PRZEBIEG,
});

/*
 * Selly: JEDEN klient i JEDNO discovery na proces — dzielą je trasy manualne (`stworzApp`)
 * i scheduler Toru 1. Oryginał osiąga to stanem modułu (`discovery.cjs:46` trzyma cache
 * `dostawca → feature_id`, a `require` daje obu ścieżkom ten sam moduł); u nas cache jest
 * w domknięciu, więc instancję trzeba przekazać jawnie, inaczej obie ścieżki uczyłyby się
 * osobno. Blokada `SELLY_TRYB` obejmuje ten klient tak samo jak w trasach.
 */
const klientSelly = opakujKlientaTrybem(
  stworzKlientaSelly({
    shopUrl: env.SELLY_SHOP_URL,
    clientId: env.SELLY_CLIENT_ID,
    clientSecret: env.SELLY_CLIENT_SECRET,
    scope: env.SELLY_SCOPE,
  }),
  env.SELLY_TRYB,
);
const discoverySelly = stworzDiscovery({ klient: klientSelly });

const app = stworzApp({
  env,
  db,
  sqlite,
  synchronizuj,
  przeplanujScheduler: () => scheduler.przeplanuj(),
  // JEDNA instancja klienta i discovery na proces — trasy manualne i scheduler dzielą
  // nauczone `feature_id` Magazynów, tak jak w oryginale dzieli je stan modułu.
  klientSelly,
  discoverySelly,
});

// Sam obiekt niczego nie uruchamia — timer stawia dopiero `uruchom()` niżej.
const schedulerSelly = stworzSchedulerSelly({
  syncDelta: (dostawca, opcje) =>
    syncDelta({ db, klient: klientSelly, discovery: discoverySelly }, dostawca, opcje),
});

const server = app.listen(env.PORT, env.HOST, () => {
  console.log(
    `Bridge backend słucha na http://${env.HOST}:${env.PORT} ` +
      `(NODE_ENV=${env.NODE_ENV}, DB_PATH=${env.DB_PATH})`,
  );

  // Stan CORS wypisujemy JAWNIE (finalny audyt 12e, D2b), bo „brak nagłówków CORS" wygląda
  // w logu identycznie jak przeoczona konfiguracja, a jest stanem docelowym dla same-origin.
  // Bez tej linii jedynym sposobem odpowiedzenia na pytanie „czy CORS jest na pewno zamknięty?"
  // jest czytanie kodu.
  if (env.CORS_ORIGINS.length > 0) {
    console.log(`[cors] allowlista (${env.CORS_ORIGINS.length}): ${env.CORS_ORIGINS.join(", ")}`);
  } else {
    console.log("[cors] wyłączony — brak nagłówków Access-Control-* (same-origin za proxy)");
  }

  // ODSTĘPSTWO ŚWIADOME W UMIEJSCOWIENIU (decyzja użytkownika 2026-09-01, roadmapa 3f-3):
  // oryginał woła `D4()` w `M4()` (`:48167`), czyli w odpowiedniku `stworzApp`, przed
  // rejestracją tras. Zachowanie procesu produkcyjnego jest identyczne — `stworzApp` jest
  // wołane dokładnie raz, tuż przed `listen()` — a start tutaj trzyma timery z dala od
  // testów (całą suitę budują przez `stworzApp`) i stawia sprzątanie obok `zamknij()`.
  if (env.IMPORT_SCHEDULER) {
    scheduler.uruchom();
  } else {
    console.log("[scheduler] wyłączony (IMPORT_SCHEDULER nie jest ustawione)");
  }

  // Tor 1 Selly (Iteracja 13d-1, decyzja D4) — to samo umiejscowienie i ta sama zasada co
  // wyżej. Oryginał instaluje ten automat bezwarunkowo (`extensions.cjs:466`); u nas musi
  // być włączony jawnie, bo na stagingu robiłby REALNE `PUT`-y w żywym sklepie Ani.
  if (env.SELLY_SCHEDULER) {
    schedulerSelly.uruchom();
  } else {
    console.log("[selly-scheduler] wyłączony (SELLY_SCHEDULER nie jest ustawione)");
  }
});

function zamknij(sygnal: string): void {
  console.log(`${sygnal} — zamykam serwer…`);
  scheduler.zatrzymaj();
  schedulerSelly.zatrzymaj();
  server.close(() => {
    sqlite.close();
    process.exit(0);
  });
  // Gdyby otwarte połączenia nie chciały się domknąć — nie wisimy w nieskończoność.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => zamknij("SIGTERM"));
process.on("SIGINT", () => zamknij("SIGINT"));
