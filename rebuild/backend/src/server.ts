// Wejście produkcyjne — `dist/server.js` (kontrakt deployu, tools/deploy-staging.sh).
import { wczytajEnv } from "./config/env.js";
import { otworzBaze } from "./db/index.js";
import { stworzApp } from "./app.js";
import { stworzScheduler } from "./import/scheduler.js";
import { synchronizujDostawce } from "./import/synchronizuj.js";
import { stworzWygaszacz } from "./promocje/wygaszacz.js";
import {
  stworzSynchronizacjeDostepnosci,
  ustawDomyslnaSynchronizacjeDostepnosci,
} from "./selly/dostepnosc.js";
import { stworzKlientaSelly } from "./selly/klient.js";
import { opakujKlientaTrybem } from "./selly/tryb.js";
import { stworzDiscovery } from "./selly/rest/discovery.js";
import { budujPayloadProduktuV2 } from "./selly/rest/mapper-v2.js";
import { stworzHarmonogramSelly } from "./selly/rest/scheduler.js";

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

// JEDNA instancja discovery na proces (karta I15.8) — tę samą dostają trasy `sync-*`
// i harmonogram Selly. Stan (nauczone `feature_id`, cache kodów produktów Selly) żyje
// w jej domknięciu, więc druga instancja miałaby własny, zimny cache i rozjechałaby się
// z pierwszą. Ta sama zasada co przy `synchronizuj` wyżej.
const klientSelly = opakujKlientaTrybem(
  stworzKlientaSelly({
    shopUrl: env.SELLY_SHOP_URL,
    clientId: env.SELLY_CLIENT_ID,
    clientSecret: env.SELLY_CLIENT_SECRET,
    scope: env.SELLY_SCOPE,
  }),
  env.SELLY_TRYB,
);
const discoverySelly = stworzDiscovery({
  klient: klientSelly,
  budujPayloadProduktu: budujPayloadProduktuV2,
});

// Jak scheduler importu wyżej — sam obiekt niczego nie uruchamia, timer stawia `uruchom()`.
const harmonogramSelly = stworzHarmonogramSelly({
  db,
  discovery: discoverySelly,
  tryb: env.SELLY_TRYB,
});

// Odświeżanie dostępności (karta I15.10b). Wpięcie modułu `selly/dostepnosc.ts` z I15.10:
// importer stagingu woła globalne `zadajOdswiezenie(dostawca)` (`import/polityka/fabryka.ts`,
// koniec `importer()`), a ono bez zamontowanej instancji NIE ROBI NIC. Ta rejestracja jest
// jedynym miejscem, które nadaje tamtym wywołaniom skutek.
//
// TA SAMA instancja `discoverySelly` co wyżej — w jej domknięciu żyją nauczone `feature_id`
// i cache kodów produktów Selly (`docs/karty/I15.10/wejscie-121.md`). Druga instancja miałaby
// własny, zimny cache i rozjechałaby się z pierwszą.
//
// Rejestracja stoi TUTAJ, a nie w callbacku `listen()` jak starty schedulerów, bo nie jest
// startem: instancja nie ma timera, a rejestracja to czysty stan. Musi być żywa, ZANIM
// w `listen()` ruszy `scheduler.uruchom()` — jego pierwszy przebieg potrafi od razu wykonać
// import i wywołać `zadajOdswiezenie()`.
//
// ⚠ BRAMKA — ŚWIADOME ODSTĘPSTWO W KRYTERIUM (decyzja użytkownika 2026-09-23, karta I15.10b).
// Oryginał ma tu twardą bramkę po ścieżce bazy (`staging_policy.cjs:131-134`: wychodzi, gdy
// `db.name` to nie produkcyjna `data.db`), więc każda kopia milczy. Odbudowa nie hardkoduje
// ścieżki produkcyjnej bazy, a bramkę mieć MUSI: montaż otwiera generatorowi CSV drogę
// automatyczną, z każdego importu, podczas gdy `SELLY_CSV_DIR` domyślnie wskazuje katalog
// PRODUKCYJNY (`config/env.ts`, domyślka świadoma — pusty `.env` ma działać jak oryginał),
// a staging dzieli VPS z produkcją. Do tej pory ta ścieżka była osiągalna wyłącznie ręcznym
// `POST /api/selly/generate-csv` za `requireAuth`. Kryterium zastępczym jest `SELLY_TRYB`:
// domyślnie i na stagingu `wylaczony` → zachowanie jak dotąd (ciche no-opy), na produkcji
// `pelny` → odświeżanie działa. Kierunek ten sam co w oryginale, kryterium inne.
if (env.SELLY_TRYB === "wylaczony") {
  console.log(
    "[dostepnosc] niezamontowana (SELLY_TRYB=wylaczony) — zgłoszenia odświeżenia są no-opem",
  );
} else {
  ustawDomyslnaSynchronizacjeDostepnosci(
    stworzSynchronizacjeDostepnosci({
      db,
      discovery: discoverySelly,
      // Ścieżki CSV z env, dokładnie jak w `app.ts` dla tras `selly/*` — jedno źródło prawdy.
      sciezkiCsv: {
        katalog: env.SELLY_CSV_DIR,
        plik: env.SELLY_CSV_PLIK,
        url: env.SELLY_CSV_URL,
      },
    }),
  );
}

const app = stworzApp({
  env,
  db,
  sqlite,
  synchronizuj,
  przeplanujScheduler: () => scheduler.przeplanuj(),
  klientSelly,
  discoverySelly,
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

  // Harmonogram Selly (karta I15.8) — Tor 1 o HH:55 + HH:10/25/40, Tor 2 o 04:30.
  // ODSTĘPSTWO ŚWIADOME: produkcja nie ma tu przełącznika (`extensions.cjs:486-487`
  // instaluje bezwarunkowo), ale włączony harmonogram REALNIE ZAPISUJE do cudzego sklepu,
  // więc u nas rusza dopiero po jawnym `SELLY_SCHEDULER`. Sam `uruchom()` dodatkowo odmawia
  // startu przy `SELLY_TRYB=wylaczony` — uzasadnienie w nagłówku `selly/rest/scheduler.ts`.
  if (env.SELLY_SCHEDULER) {
    harmonogramSelly.uruchom();
  } else {
    console.log("[selly-scheduler] wyłączony (SELLY_SCHEDULER nie jest ustawione)");
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
  harmonogramSelly.zatrzymaj();
  wygaszacz.zatrzymaj();
  // Wyrejestrowanie jest bezwarunkowe — zdjęcie instancji, której nie ma, jest no-opem.
  // Po nim `zadajOdswiezenie()` znów nic nie robi: żaden nowy bieg kolejki nie ruszy po tym,
  // jak zamknęliśmy bazę w `server.close()`. (Bieg już trwający dobiega sam — moduł celowo
  // nie ma anulowania, bo oryginał też go nie ma.)
  ustawDomyslnaSynchronizacjeDostepnosci(null);
  server.close(() => {
    sqlite.close();
    process.exit(0);
  });
  // Gdyby otwarte połączenia nie chciały się domknąć — nie wisimy w nieskończoność.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => zamknij("SIGTERM"));
process.on("SIGINT", () => zamknij("SIGINT"));
