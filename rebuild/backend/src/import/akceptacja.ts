// Zatwierdzenie pozycji stagingu — port `U.acceptStaging` (backend-index.cjs:44827-44910).
//
// To jest moment, w którym decyzja człowieka wchodzi do katalogu. Silnik importu (`tk()`)
// tylko PROPONUJE: produkuje wiersze stagingu i sam zatwierdza wyłącznie to, co nie rusza
// tożsamości opony. Wszystko inne czeka tutaj na kliknięcie.

import { eq, sql } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { products, stagingItems } from "../db/schema.js";
import { zapiszPoprawke, poprawkiDla } from "../repos/overrides.js";
import { applyDims, applyLinkMemory, assignKodImportu, applyNazwaPamiec, applyWagaPamiec, rememberLink, uchwytSqlite } from "./silnik/bridge-ext.js";

/**
 * Rekord produktu budowany z pozycji stagingu. Celowo luźny: oryginał składa go ze snapshotu
 * (dowolny kształt z parsera) i pól wiersza stagingu, a Drizzle i tak weźmie tylko kolumny,
 * które zna.
 */
type RekordProduktu = Record<string, unknown>;

/**
 * Zatwierdza JEDNĄ pozycję stagingu — port `:44827`.
 *
 * @param uzytkownikId trafia do `manual_overrides.createdBy` przy potwierdzaniu konfliktu
 * @returns `false`, gdy pozycji o tym id nie było (oryginał robi ciche `return`)
 */
export function zatwierdzPozycjeStagingu(db: Baza, id: number, uzytkownikId: number): boolean {
  const pozycja = db.select().from(stagingItems).where(eq(stagingItems.id, id)).get();
  if (!pozycja) return false;

  const teraz = new Date().toISOString();
  const sqlite = uchwytSqlite(db);

  // ——— Wycofanie: produkt NIE znika z katalogu, tylko zostaje wstrzymany (:44831-44838) ———
  // To świadome: pozycja wycofana bywa chwilową nieobecnością u dostawcy, a skasowanie
  // produktu zabrałoby historię i ręczne poprawki. Gałąź kończy się `return` — żadne dalsze
  // kroki (bridge_ext, uwagaCena) się nie wykonują.
  if (pozycja.typZmiany === "wycofana") {
    const produkt = db.select().from(products).where(eq(products.kod, pozycja.kod)).get();
    if (produkt) {
      db.update(products)
        .set({ status: "wstrzymany", stan: 0, dataAktualizacji: teraz })
        .where(eq(products.id, produkt.id))
        .run();
    }
    db.delete(stagingItems).where(eq(stagingItems.id, id)).run();
    return true;
  }

  // ——— Snapshot pozycji PO normalizacji silnika (:44840-44843) ———
  let snapshot: RekordProduktu = {};
  if (pozycja.snapshotJson) {
    try {
      snapshot = JSON.parse(pozycja.snapshotJson) as RekordProduktu;
    } catch {
      // Uszkodzony snapshot nie może wywrócić akceptacji — oryginał też go połyka.
    }
  }

  // ——— Potwierdzenie konfliktu z poprawką Marty (:44844-44862) ———
  //
  // ⭐ TU DOMYKA SIĘ PĘTLA Z 3d-1. Silnik, widząc że plik dostawcy niesie co innego niż
  // ręczna poprawka, zachował wartość Marty i zapisał wartość z pliku do
  // `snapshotJson._srcConflict`. Akceptacja zapamiętuje ją jako `acknowledgedSourceValue`,
  // dzięki czemu ten sam konflikt NIE zaalarmuje przy następnym imporcie — a sama poprawka
  // dalej wygrywa.
  try {
    const konflikt = snapshot._srcConflict;
    if (konflikt && typeof konflikt === "object") {
      for (const [pole, wartoscZPliku] of Object.entries(konflikt as Record<string, unknown>)) {
        const istniejaca = poprawkiDla(db, pozycja.dostawca, pozycja.kod).find(
          (p) => p.fieldName === pole,
        );
        if (istniejaca) {
          zapiszPoprawke(db, {
            supplierKod: pozycja.dostawca,
            supplierProductId: pozycja.kod,
            fieldName: pole,
            overrideValue: istniejaca.overrideValue,
            reason: istniejaca.reason ?? null,
            createdBy: istniejaca.createdBy ?? uzytkownikId,
            createdAt: istniejaca.createdAt ?? teraz,
            acknowledgedSourceValue: String(wartoscZPliku),
          });
        }
      }
    }
  } catch {
    // `catch (_ackErr) {}` w oryginale — nieudane potwierdzenie nie blokuje akceptacji.
  }

  // ——— Budowa rekordu produktu (:44863-44878) ———
  // Pola wiersza stagingu WYGRYWAJĄ ze snapshotem, bo to one mogły zostać ręcznie
  // poprawione przez `PUT /api/staging/{id}`.
  const rekord: RekordProduktu = {
    ...snapshot,
    kod: pozycja.kod,
    nazwa: pozycja.nazwa,
    dostawca: pozycja.dostawca,
    magazyn: pozycja.magazyn,
    magazynRaw: pozycja.magazynRaw ?? snapshot.magazynRaw ?? null,
    stan: pozycja.stanNowy ?? snapshot.stan ?? 0,
    cenaZakupu: pozycja.cenaZakupuNowa ?? snapshot.cenaZakupu ?? 0,
    // ⚠ `ean` bierze się WYŁĄCZNIE ze snapshotu — wiersz stagingu ma tylko `eanRaw`
    // i pochodne. Odtworzone dosłownie (`r.ean ?? null`, `:44872`).
    ean: snapshot.ean ?? null,
    eanRaw: pozycja.eanRaw ?? snapshot.eanRaw ?? null,
    eanIsValid: pozycja.eanIsValid ?? snapshot.eanIsValid ?? null,
    eanSourceStatus: pozycja.eanSourceStatus ?? snapshot.eanSourceStatus ?? null,
    eanCandidates: pozycja.eanCandidates ?? snapshot.eanCandidates ?? null,
    dataAktualizacji: teraz,
  };

  if (pozycja.cenaSprzedazyNowa != null) rekord.cenaSprzedazy = pozycja.cenaSprzedazyNowa;

  // ——— Wartości domyślne (:44880-44881) ———
  const cenaZakupu = (rekord.cenaZakupu as number | null) ?? 0;
  if (rekord.cenaSprzedazy == null) {
    rekord.cenaSprzedazy = Math.round(cenaZakupu * 1.25 * 100) / 100;
  }
  // ⚠ `marzaPct` jest ustawiana NA SZTYWNO na 25, niezależnie od tego, czy cena sprzedaży
  // wzięła się z narzutu 25%, czy przyszła gotowa z pliku. To niespójność oryginału —
  // odtwarzamy ją, bo produkcja tak liczy.
  rekord.marzaPct = 25;
  rekord.marka = rekord.marka ?? snapshot.marka ?? (pozycja.nazwa.split(" ")[0] || "—");
  rekord.kategoria = rekord.kategoria ?? snapshot.kategoria ?? "Rolnicze";
  rekord.vat = rekord.vat ?? 23;
  rekord.status =
    Number(rekord.cenaSprzedazy) === 0 || Number(rekord.cenaZakupu) === 0
      ? "wstrzymany"
      : "aktywny";

  // ——— ŚWIADOMIE POMINIĘTE: narzuty i promocje (:44882-44895) ———
  // Oryginał przelicza tu `cenaSprzedazy` regułami z tabel `markups`/`promotions`
  // (`__bridgePickMarkup`/`__bridgePickPromo`). To zakres ITERACJI 4. W I3 obie tabele są
  // puste, więc gałąź `if (__mm || __pp)` nigdy nie wchodzi i pominięcie jest bez skutku —
  // dowodzi tego charakteryzacja, która uruchamia ORYGINALNĄ gałąź cenową obok naszego portu.
  // Od chwili, gdy I4 pozwoli wpisać pierwszą regułę, ta luka przestaje być nieszkodliwa.
  // Zapisane w bloku „Iteracja 4" roadmapy.

  const istniejacy = db.select().from(products).where(eq(products.kod, pozycja.kod)).get();

  // ——— Rozszerzenia importu (:44896-44905) ———
  // Każde w osobnym `try/catch`, dokładnie jak oryginał: `bridge_ext` ma być defensywny,
  // a błąd jednego rozszerzenia nie może zablokować pozostałych ani samego zapisu.
  try {
    applyDims(rekord, (pozycja as unknown as Record<string, unknown>).rozmiar);
    applyLinkMemory(sqlite, rekord, istniejacy);
  } catch {
    /* jak `catch (_be) {}` */
  }
  try {
    assignKodImportu(sqlite, rekord, istniejacy);
  } catch {
    /* jak `catch (_be) {}` */
  }
  try {
    applyNazwaPamiec(sqlite, rekord);
  } catch {
    /* jak `catch (_be) {}` */
  }
  try {
    applyWagaPamiec(sqlite, rekord, istniejacy);
  } catch {
    /* jak `catch (_be) {}` */
  }

  // ——— Zapis produktu (:44906) ———
  const doZapisu = tylkoKolumnyProduktu(rekord);
  if (istniejacy) {
    db.update(products).set(doZapisu).where(eq(products.id, istniejacy.id)).run();
  } else {
    db.insert(products).values(doZapisu as typeof products.$inferInsert).run();
  }

  // ——— Pamięć linków PO zapisie (:44907-44909) ———
  try {
    rememberLink(sqlite, rekord);
  } catch {
    /* jak `catch (_be) {}` */
  }

  // ——— Propagacja `uwagaCena` (backlog #4, plan.md D4) ———
  // W produkcji robi to monkey-patch `mirror/backend/uwaga_cena_patch.cjs`, doklejany do
  // `index.cjs` po buildzie — dlatego nie ma tego w wyciętym `acceptStaging`. U nas wchodzi
  // natywnie, w tym samym miejscu i z tym samym skutkiem: cena „na zapytanie" ze snapshotu
  // trafia do kolumny, a jej brak ją czyści.
  const uwagaCena = (snapshot.uwagaCena as string | null) ?? null;
  db.update(products).set({ uwagaCena }).where(eq(products.kod, pozycja.kod)).run();

  // ——— Pozycja stagingu znika (:44910) ———
  db.delete(stagingItems).where(eq(stagingItems.id, id)).run();
  return true;
}

/**
 * Odsiewa ze zbudowanego rekordu klucze, których tabela `products` nie ma.
 *
 * PO CO: snapshot pochodzi z parsera i niesie pola pomocnicze (`_srcConflict`, `rozmiarWykryty`
 * itp.). Oryginał podaje całość Drizzle'owi, który po cichu ignoruje nieznane klucze — nasza
 * wersja Drizzle rzuca. Odsiew jest więc mostem między dwoma zachowaniami ORM-a, a nie
 * zmianą logiki: zapisujemy dokładnie te kolumny, które zapisałaby produkcja.
 */
function tylkoKolumnyProduktu(rekord: RekordProduktu): Record<string, unknown> {
  const znane = new Set(Object.keys(products));
  return Object.fromEntries(Object.entries(rekord).filter(([klucz]) => znane.has(klucz)));
}

/** Odrzucenie pozycji — port `U.rejectStaging` (`:44917`). Zwykłe skasowanie wiersza. */
export function odrzucPozycjeStagingu(db: Baza, id: number): void {
  db.delete(stagingItems).where(eq(stagingItems.id, id)).run();
}

/** Wyczyszczenie całego stagingu — port `U.clearStaging` (`:44920`). */
export function wyczyscStaging(db: Baza): void {
  db.delete(stagingItems).run();
}

/**
 * Identyfikatory pozycji pasujące do filtrów `allFiltered` — port `:48540-48545`
 * (ten sam kod powtarza się w `accept` i w `reject`).
 */
export function idPozycjiZFiltrow(
  db: Baza,
  filtry: { typZmiany?: string; dostawca?: string; search?: string },
): number[] {
  const warunki = [];
  if (filtry.typZmiany && filtry.typZmiany !== "all") {
    warunki.push(sql`typ_zmiany = ${String(filtry.typZmiany)}`);
  }
  if (filtry.dostawca && filtry.dostawca !== "all") {
    warunki.push(sql`dostawca = ${String(filtry.dostawca)}`);
  }
  if (filtry.search) {
    const wzorzec = `%${String(filtry.search)}%`;
    warunki.push(sql`(nazwa LIKE ${wzorzec} OR kod LIKE ${wzorzec})`);
  }

  const gdzie = warunki.length
    ? sql` WHERE ${sql.join(warunki, sql` AND `)}`
    : sql``;

  return db
    .all<{ id: number }>(sql`SELECT id FROM staging_items${gdzie} ORDER BY id DESC`)
    .map((w) => w.id);
}
