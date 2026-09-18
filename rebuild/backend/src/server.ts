// Wejście produkcyjne — `dist/server.js` (kontrakt deployu, tools/deploy-staging.sh).
import { wczytajEnv } from "./config/env.js";
import { otworzBaze } from "./db/index.js";
import { stworzApp } from "./app.js";
import { stworzScheduler } from "./import/scheduler.js";
import { synchronizujDostawce } from "./import/synchronizuj.js";
import { stworzWygaszacz } from "./promocje/wygaszacz.js";

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

// Wygaszacz statusu promocji (karta 14f). Jak scheduler wyżej — sam obiekt niczego nie
// uruchamia, timer stawia dopiero `uruchom()` poniżej. To jest WARUNEK darmowej
// charakteryzacji: cała suita buduje aplikację przez `stworzApp`, więc timer stojący tutaj
// jest dla niej niewidoczny (`promocje/wygaszacz.ts`, nagłówek).
const wygaszacz = stworzWygaszacz({
  db,
  interwalMs: env.PROMO_WYGASZACZ_MINUTY * 60 * 1000,
});

const app = stworzApp({
  env,
  db,
  sqlite,
  synchronizuj,
  przeplanujScheduler: () => scheduler.przeplanuj(),
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

  // ⚠ ODSTĘPSTWO ŚWIADOME (karta 14f, zatwierdzone przez Anię 2026-09-18: „data ma naprawdę
  // kończyć promocje"). Bezwarunkowo, w odróżnieniu od schedulera wyżej — wygaszacz rusza
  // wyłącznie naszą bazę i JEST tą naprawą, więc za flagą domyślnie wyłączoną byłby martwy
  // (uzasadnienie przy `PROMO_WYGASZACZ_MINUTY` w `config/env.ts`). Przebieg startowy łapie
  // wygaśnięcia z czasu POSTOJU procesu; `PROMO_WYGASZACZ_MINUTY=0` zostawia sam ten przebieg.
  wygaszacz.uruchom();
});

function zamknij(sygnal: string): void {
  console.log(`${sygnal} — zamykam serwer…`);
  scheduler.zatrzymaj();
  wygaszacz.zatrzymaj();
  server.close(() => {
    sqlite.close();
    process.exit(0);
  });
  // Gdyby otwarte połączenia nie chciały się domknąć — nie wisimy w nieskończoność.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => zamknij("SIGTERM"));
process.on("SIGINT", () => zamknij("SIGINT"));
