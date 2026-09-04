// Utrzymanie katalogu — `POST /api/maintenance/usun-nieopony` i `POST /api/products/clear`.
// Port `deminified/backend-index.cjs:48315-48334` i `:48392-48405` (obie trasy w rdzeniu, z `we`).

import { copyFileSync, existsSync } from "node:fs";
import { Router } from "express";

import type { Baza, BazaSqlite } from "../db/index.js";
import { czyOpona } from "../import/silnik/klasyfikator.js";
import { requireAuth } from "../middleware/auth.js";
import { zapiszAudyt } from "../repos/audit.js";
import { listaProduktow, usunProdukt, wyczyscProdukty } from "../repos/products.js";

export type ZaleznosciUtrzymania = {
  db: Baza;
  /**
   * Ścieżka pliku bazy (`env.DB_PATH`) — do kopii bezpieczeństwa przed czyszczeniem
   * katalogu. Oryginał trzyma bazę obok `__dirname` i sklada ścieżkę na sztywno
   * (`path.join(__dirname,"data.db")`, `:48322`); u nas plik jest konfigurowalny,
   * więc trasa musi go dostać z zewnątrz. Pominięta ⇒ kopia nie powstaje.
   */
  dbPath?: string;
  /**
   * Uchwyt do SQLite — wyłącznie po to, żeby przed kopiowaniem zrobić checkpoint WAL.
   * Pominięty ⇒ kopia bez checkpointu (patrz `zrobKopieBazy`).
   */
  sqlite?: BazaSqlite;
};

/** Ile przykładowych pozycji wraca w odpowiedzi `usun-nieopony` — `d.length < 10` (`:48397`). */
const MAKS_PRZYKLADOW = 10;

/** Ile znaków nazwy trafia do przykładu — `substring(0,60)` (`:48397`). */
const DLUGOSC_PRZYKLADU = 60;

/**
 * Kopia pliku bazy przed nieodwracalnym czyszczeniem katalogu — port `:48319-48331`.
 *
 * BEST-EFFORT, dokładnie jak w oryginale: każdy błąd (brak pliku, brak uprawnień, brak
 * miejsca) jest tylko logowany i NIE przerywa czyszczenia. Wzorzec nazwy też jest
 * oryginalny: `<baza>.bak_before_clear_<ISO z ':' i '.' zamienionymi na '-'>`.
 *
 * ⚠ RÓŻNICA WOBEC ORYGINAŁU, ŚWIADOMA (plan.md D5): przed kopiowaniem robimy
 * `wal_checkpoint(TRUNCATE)`. Baza chodzi w trybie WAL (`db/index.ts:18`), więc świeże
 * zapisy siedzą w pliku `-wal`, a nie w `.db` — goła kopia samego `.db` (to robi oryginał)
 * pomija je i daje kopię cofniętą w czasie. Checkpoint zrzuca WAL do pliku głównego, dzięki
 * czemu bezpiecznik faktycznie działa. Bez wpływu na kształt i kod odpowiedzi HTTP.
 */
function zrobKopieBazy(dbPath: string | undefined, sqlite: BazaSqlite | undefined): void {
  if (!dbPath || dbPath === ":memory:") return;
  try {
    if (!existsSync(dbPath)) return;
    sqlite?.pragma("wal_checkpoint(TRUNCATE)");
    const znacznik = new Date().toISOString().replace(/[:.]/g, "-");
    copyFileSync(dbPath, `${dbPath}.bak_before_clear_${znacznik}`);
  } catch (blad) {
    console.error(
      "[products/clear] backup przed czyszczeniem nie powiodl sie:",
      blad instanceof Error ? blad.message : blad,
    );
  }
}

export function trasyUtrzymania({ db, dbPath, sqlite }: ZaleznosciUtrzymania): Router {
  const router = Router();

  /**
   * Usunięcie z katalogu wszystkiego, co nie jest oponą — port `:48392-48405`.
   *
   * Decyduje `czyOpona()` (port `Zc()`), czyli DOKŁADNIE ten sam detektor, którym silnik
   * importu odsiewa pozycje z cennika. To jest sens tej trasy: sprzątnąć katalog po
   * imporcie sprzed poprawki detektora, bez ręcznego przeglądania tysięcy wierszy.
   * Osobna implementacja rozjechałaby się z importem i trasa przestałaby cokolwiek znaczyć.
   *
   * ⚠ Audyt niesie tylko licznik i rozbicie na dostawców — NIE listę usuniętych pozycji.
   * `przyklady` (do dziesięciu) istnieją wyłącznie w odpowiedzi HTTP, żeby Ania mogła
   * ocenić, czy detektor nie skosił czegoś niechcący. Po zamknięciu okna ta informacja
   * przepada; tak jest w oryginale i tego nie zmieniamy.
   */
  router.post("/api/maintenance/usun-nieopony", requireAuth, (req, res) => {
    const perDostawca: Record<string, number> = {};
    const przyklady: string[] = [];
    let usuniete = 0;

    for (const produkt of listaProduktow(db)) {
      if (czyOpona(produkt.nazwa || "", produkt.kategoria).isTire) continue;

      usunProdukt(db, produkt.id);
      usuniete += 1;
      perDostawca[produkt.dostawca] = (perDostawca[produkt.dostawca] ?? 0) + 1;
      if (przyklady.length < MAKS_PRZYKLADOW) {
        przyklady.push(
          `${produkt.dostawca}/${produkt.kod}: ${(produkt.nazwa || "").substring(0, DLUGOSC_PRZYKLADU)}`,
        );
      }
    }

    const user = req.user!;
    zapiszAudyt(db, {
      uzytkownikId: user.id,
      uzytkownikImie: user.imieNazwisko,
      akcja: "maintenance_usun_nieopony",
      encjaTyp: "produkt",
      encjaId: "wszystkie",
      szczegoly: { usuniete, perDostawca },
    });

    res.json({ ok: true, usuniete, perDostawca, przyklady });
  });

  /**
   * Wyczyszczenie CAŁEGO katalogu — port `:48315-48334`.
   *
   * ⚠ Jedyną ochroną jest dosłowne `{potwierdzenie: "WYCZYSC"}` w ciele. Porównanie jest
   * ścisłe (`!==`), więc ani `"wyczysc"`, ani `true`, ani brak pola nie przejdą. Komunikat
   * 400 jest przepisany z oryginału co do znaku — to on tłumaczy Ani, czego trasa oczekuje.
   *
   * ⚠ Audyt NIE dostaje `szczegoly`, więc w `audit_log` ląduje wiersz z `szczegoly_json`
   * równym NULL. To jeden z wierszy, na których `GET /api/audit-log` musi się nie wywrócić
   * (test `audit-log.test.ts`) — 1:1 z `:48332`, gdzie `be()` jest wołane bez szóstego
   * argumentu.
   */
  router.post("/api/products/clear", requireAuth, (req, res) => {
    const cialo = (req.body ?? {}) as { potwierdzenie?: unknown };
    if (cialo.potwierdzenie !== "WYCZYSC") {
      res.status(400).json({
        error:
          'Wymagane potwierdzenie: przeslij w body { potwierdzenie: "WYCZYSC" } aby wyczyscic caly katalog produktow. To jest nieodwracalna operacja dotykajaca WSZYSTKICH dostawcow.',
      });
      return;
    }

    zrobKopieBazy(dbPath, sqlite);
    wyczyscProdukty(db);

    const user = req.user!;
    zapiszAudyt(db, {
      uzytkownikId: user.id,
      uzytkownikImie: user.imieNazwisko,
      akcja: "czyszczenie_katalogu",
      encjaTyp: "produkt",
      encjaId: "wszystkie",
    });

    res.json({ ok: true });
  });

  return router;
}
