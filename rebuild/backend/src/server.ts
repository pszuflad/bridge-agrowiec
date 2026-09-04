// Wejście produkcyjne — `dist/server.js` (kontrakt deployu, tools/deploy-staging.sh).
import { wczytajEnv } from "./config/env.js";
import { otworzBaze } from "./db/index.js";
import { stworzApp } from "./app.js";
import { stworzScheduler } from "./import/scheduler.js";
import { synchronizujDostawce } from "./import/synchronizuj.js";

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
});

function zamknij(sygnal: string): void {
  console.log(`${sygnal} — zamykam serwer…`);
  scheduler.zatrzymaj();
  server.close(() => {
    sqlite.close();
    process.exit(0);
  });
  // Gdyby otwarte połączenia nie chciały się domknąć — nie wisimy w nieskończoność.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => zamknij("SIGTERM"));
process.on("SIGINT", () => zamknij("SIGINT"));
