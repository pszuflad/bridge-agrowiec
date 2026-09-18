// Zatwierdzenie pozycji stagingu — port `U.acceptStaging` (backend-index.cjs:44827-44910).
//
// To jest moment, w którym decyzja człowieka wchodzi do katalogu. Silnik importu (`tk()`)
// tylko PROPONUJE: produkuje wiersze stagingu i sam zatwierdza wyłącznie to, co nie rusza
// tożsamości opony. Wszystko inne czeka tutaj na kliknięcie.

import { eq, sql } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { markups, products, promotions, stagingItems } from "../db/schema.js";
import { zastosujRegulyCenowe } from "../repos/ceny.js";
import { zapiszPoprawke, poprawkiDla } from "../repos/overrides.js";
// Wspólny z `bulk.ts` od 12a — obie ścieżki importu zapisują tę samą tabelę tym samym odsiewem.
import { tylkoKolumnyProduktu } from "../repos/products.js";
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
  // P3 (produkcja 2026-08-31 14:58, backlog #56): fallback marki to stałe „UNKNOWN".
  // Wcześniej było tu `pozycja.nazwa.split(" ")[0] || "—"`, co wpisywało jako markę pierwsze
  // słowo nazwy — czyli zwykle „Opona", a przy MO2 JMK rozmiar. Wartość degenerowana wyglądała
  // na prawdziwą markę i nikt jej nie poprawiał; „UNKNOWN" widać od razu i idzie do ręcznej naprawy.
  rekord.marka = rekord.marka ?? snapshot.marka ?? "UNKNOWN";
  rekord.kategoria = rekord.kategoria ?? snapshot.kategoria ?? "Rolnicze";
  rekord.vat = rekord.vat ?? 23;
  rekord.status =
    Number(rekord.cenaSprzedazy) === 0 || Number(rekord.cenaZakupu) === 0
      ? "wstrzymany"
      : "aktywny";

  // ——— Narzuty i promocje (:44882-44895) ———
  // Luka zostawiona świadomie przez Iterację 3 (puste tabele ⇒ gałąź bezczynna), domknięta
  // w 4a. Od chwili, gdy w `markups`/`promotions` jest pierwsza reguła, TO ONA ustala cenę
  // sprzedaży — nadpisując zarówno domyślne `zakup × 1,25`, jak i `cenaSprzedazyNowa`
  // wpisaną ręcznie w stagingu. Sama formuła i wybór reguły mieszkają w `repos/ceny.ts`.
  //
  // Trzy szczegóły przepisane dosłownie, bo każdy z nich jest widoczny w wyniku:
  //  • obie tabele czytane są przy KAŻDEJ akceptowanej pozycji, bez cache'owania — oryginał
  //    robi `X.select().from(Bt).all()` w środku metody, więc reguła dodana w trakcie
  //    zatwierdzania partii zadziała od następnej pozycji;
  //  • `try/catch` obejmuje TAKŻE odczyt tabel (`:44883`), nie tylko liczenie;
  //  • próg `cenaZakupu > 0` odcina gałąź wcześniej niż `if (__mm || __pp)`.
  try {
    if (Number(rekord.cenaZakupu) > 0) {
      const narzuty = db.select().from(markups).all();
      const promocje = db.select().from(promotions).all();
      zastosujRegulyCenowe(rekord, narzuty, promocje);
    }
  } catch {
    // jak `catch {}` w oryginale — błąd reguł nie może zablokować akceptacji pozycji
  }

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

  // ——— ODSTĘPSTWO ŚWIADOME (karta 14i, ticket 58) ———
  // Decyzja Ani z 2026-09-18 (`docs/rebuild-backlog.md` #11): „EAN który jest zepsuty notacją
  // naukową ma być importowany jako PUSTE POLE W KATALOGU". PRODUKCJA ROBI INACZEJ — oryginał
  // zapisuje w `:44872` rozwiniętą wartość (np. „6,41944E+12" → `6419440000000`) i tylko
  // dokleja do ostrzeżenia komunikat „zapis naukowy ma tylko null cyfr znaczących — EAN
  // niepewny". Rozwinięcie bywa zmyślone: Excel gubi cyfry znaczące, więc do katalogu trafiał
  // EAN, który wygląda na prawdziwy, a nim nie jest. Puste pole widać i da się poprawić.
  //
  // ⚠ MIEJSCE CIĘCIA JEST TU CELOWO NAJPÓŹNIEJSZE, JAKIE SIĘ DA — na `doZapisu`, tuż przed
  // zapisem, a NIE na `rekord` przy jego budowie. Powód jest konkretny: `assignKodImportu()`
  // (`legacy/bridge_ext.cjs:164-167`) grupuje produkty do wspólnego `kod_importu`
  // (wielomagazynowość Selly) po kluczu `EAN:<ean>`, ale tylko gdy `ean` jest niepusty
  // ORAZ `eanIsValid === 1`. Zapis naukowy z poprawną sumą kontrolną spełnia oba warunki
  // (np. „8,05997E+12" → `8059970000000`), więc wyzerowanie EAN-u WCZEŚNIEJ zrzuciłoby
  // grupowanie na gałąź zapasową `marka|rozmiar|bieznik|nazwa` i produkt przestałby
  // dziedziczyć numer po swoim odpowiedniku z innego magazynu. To byłoby DRUGIE, nieobjęte
  // decyzją Ani odstępstwo. Cięcie na `doZapisu` sprawia, że `assignKodImportu()`,
  // `applyLinkMemory()` i `rememberLink()` widzą DOKŁADNIE to samo, co w produkcji —
  // jedyną różnicą jest wartość wpisana do kolumny `products.ean`.
  //
  // Zerujemy WYŁĄCZNIE `ean`. `eanRaw`, `eanIsValid`, `eanSourceStatus` i `eanCandidates`
  // zostają, żeby z samego wiersza `products` było widać, DLACZEGO pole jest puste. Ostrzeżenie
  // w stagingu też zostaje nietknięte — silnik nie jest tą kartą dotykany.
  //
  // Warunek stoi na statusie EFEKTYWNYM (`rekord.eanSourceStatus`, czyli po uwzględnieniu
  // ręcznej poprawki z `PUT /api/staging/{id}`), a nie na samym snapshocie — dzięki temu `ean`
  // i `eanSourceStatus` w jednym wierszu katalogu nie mogą się rozjechać.
  if (rekord.eanSourceStatus === "scientific_notation_uncertain") {
    doZapisu.ean = null;
  }

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
