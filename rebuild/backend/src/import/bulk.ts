// Hurtowy zapis produktów — port `U.addProductsBulk` (backend-index.cjs:44746-44806).
//
// GDZIE TO SIEDZI I DLACZEGO TUTAJ: w oryginale jest to metoda warstwy danych (`U`), ale
// treścią jest ścieżka IMPORTU — ta sama sekwencja co `acceptStaging`, z tym samym zestawem
// rozszerzeń `bridge_ext` i tą samą gałęzią cenową. Dlatego mieszka obok `akceptacja.ts`,
// a nie w `repos/`: `repos/` nie sięga po `bridge_ext` ani po surowy uchwyt sqlite.
//
// JEDYNY KONSUMENT: `POST /api/products` (`:48306-48314`). Do Iteracji 12 ta trasa nie
// istniała w odbudowie, więc 3d-2 i 4a świadomie tej metody nie portowały — pisarz bez
// wywołania nie dałby się przetestować end-to-end (decyzja D1 z 4a).

import { eq } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { markups, products, promotions } from "../db/schema.js";
import { zastosujRegulyCenowe } from "../repos/ceny.js";
import { tylkoKolumnyProduktu } from "../repos/products.js";
import {
  applyDims,
  applyLinkMemory,
  applyNazwaPamiec,
  applyWagaPamiec,
  assignKodImportu,
  rememberLink,
  uchwytSqlite,
} from "./silnik/bridge-ext.js";

/**
 * Pozycja wejściowa bulku. Celowo luźna — oryginał bierze ciało żądania takie, jakie przyszło,
 * i przepuszcza je przez `{...a, …}`, więc do rekordu trafia wszystko, co klient przysłał.
 */
export type PozycjaBulku = Record<string, unknown>;

/**
 * Zapisuje partię produktów — port `:44746`.
 *
 * @returns LICZBĘ przetworzonych rekordów (nie listę!) — `POST /api/products` oddaje ją jako
 *   `{ok: true, dodano}`. Rekordy bez `kod` są po cichu pomijane i do liczby nie wchodzą.
 */
export function dodajProduktyBulk(db: Baza, pozycje: PozycjaBulku[]): number {
  // ⚠ Znacznik czasu liczony RAZ, przed transakcją (`:44747`) — cała partia dostaje ten sam
  // `dataAktualizacji`, nawet jeśli zapis potrwa. Odtworzone dosłownie.
  const teraz = new Date().toISOString();
  const sqlite = uchwytSqlite(db);

  const przetworz = sqlite.transaction((wejscie: PozycjaBulku[]) => {
    let ile = 0;

    for (const pozycja of wejscie) {
      if (!pozycja.kod) continue;

      const istniejacy = db
        .select()
        .from(products)
        .where(eq(products.kod, String(pozycja.kod)))
        .get();

      // ——— Wartości domyślne (:44751-44766) ———
      // ⚠ `marzaPct` liczona jest TU z faktycznych cen — inaczej niż w `acceptStaging`, gdzie
      // oryginał wpisuje na sztywno 25 (`:44881`). To niespójność produkcji między dwiema
      // ścieżkami zapisu; odtwarzamy obie takimi, jakie są.
      const cenaZakupu = (pozycja.cenaZakupu ?? 0) as number;
      const cenaSprzedazy = (pozycja.cenaSprzedazy ??
        Math.round(Number(cenaZakupu) * 1.25 * 100) / 100) as number;
      const marzaPct =
        Number(cenaZakupu) > 0
          ? Math.round(((Number(cenaSprzedazy) - Number(cenaZakupu)) / Number(cenaZakupu)) * 1e3) /
            10
          : 0;

      const rekord: Record<string, unknown> = {
        ...pozycja,
        cenaZakupu,
        cenaSprzedazy,
        marzaPct,
        nazwa: pozycja.nazwa ?? "",
        marka: pozycja.marka ?? "—",
        kategoria: pozycja.kategoria ?? "—",
        dostawca: pozycja.dostawca ?? "—",
        // ⚠ `magazyn` to TEKSTOWA kopia stanu, nie nazwa magazynu — `String(a.stan ?? 0)`
        // (`:44761`). Zastane, odtworzone dosłownie.
        magazyn: String(pozycja.stan ?? 0),
        stan: pozycja.stan ?? 0,
        vat: pozycja.vat ?? 23,
        status: pozycja.status ?? "aktywny",
        dataAktualizacji: teraz,
      };

      // ——— Narzuty i promocje (:44771-44784) ———
      // Ta sama gałąź co w `akceptacja.ts:146-154`, w tym samym miejscu sekwencji: PO
      // wartościach domyślnych, PRZED `bridge_ext`. Trzy szczegóły przepisane dosłownie:
      //  • obie tabele czytane przy KAŻDYM rekordzie, bez cache'owania — reguła dodana
      //    w trakcie partii zadziała od następnej pozycji;
      //  • `try/catch` obejmuje TAKŻE odczyt tabel, nie tylko liczenie;
      //  • próg `cenaZakupu > 0` odcina gałąź wcześniej niż sprawdzenie, czy reguła trafiła.
      try {
        if (Number(rekord.cenaZakupu) > 0) {
          const narzuty = db.select().from(markups).all();
          const promocje = db.select().from(promotions).all();
          zastosujRegulyCenowe(rekord, narzuty, promocje);
        }
      } catch {
        // jak `catch {}` w oryginale — błąd reguł nie może zablokować zapisu partii
      }

      // ——— Rozszerzenia importu (:44785-44799) ———
      // Każde w osobnym `try/catch`, dokładnie jak oryginał — ten sam podział na cztery bloki
      // co w `acceptStaging`, łącznie z tym, że `applyDims` i `applyLinkMemory` dzielą jeden.
      try {
        applyDims(rekord, pozycja.rozmiar);
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

      // ——— Zapis (:44800) ———
      const doZapisu = tylkoKolumnyProduktu(rekord);
      if (istniejacy) {
        db.update(products).set(doZapisu).where(eq(products.id, istniejacy.id)).run();
      } else {
        db.insert(products).values(doZapisu as typeof products.$inferInsert).run();
      }

      // ——— Pamięć linków PO zapisie (:44801-44803) ———
      // ⚠ Szóste rozszerzenie, którego opis zakresu ticketa nie wymieniał. Bez niego pamięć
      // linków zdjęć nie zapisywałaby się przy bulku, choć zapisuje się przy `acceptStaging`.
      try {
        rememberLink(sqlite, rekord);
      } catch {
        /* jak `catch (_be) {}` */
      }

      ile++;
    }

    return ile;
  });

  const ile = przetworz(pozycje);

  // ——— Propagacja `uwagaCena` (backlog #4) ———
  // W produkcji robi to monkey-patch `mirror/backend/uwaga_cena_patch.cjs:72-93`, doklejany do
  // `index.cjs` po buildzie — dlatego nie ma tego w wyciętym `addProductsBulk`. U nas wchodzi
  // natywnie, tak jak odpowiednik dla `acceptStaging` wszedł w 3d-2 (`akceptacja.ts:198-204`).
  //
  // Trzy szczegóły przepisane dosłownie:
  //  • pętla leci PO TRANSAKCJI, po całej partii (monkey-patch woła oryginał, potem aktualizuje);
  //  • BRAK `uwagaCena` w pozycji CZYŚCI kolumnę (`null`), a nie zostawia poprzednią wartość;
  //  • `it.uwagaCena !== undefined ? it.uwagaCena : (it.uwaga_cena || null)` — pusty napis
  //    w `uwaga_cena` wpada na `|| null`, ale pusty napis w `uwagaCena` przechodzi jak jest.
  try {
    for (const pozycja of pozycje) {
      if (!pozycja.kod) continue;
      const uwagaCena =
        pozycja.uwagaCena !== undefined
          ? (pozycja.uwagaCena as string | null)
          : ((pozycja.uwaga_cena as string | null) || null);
      db.update(products).set({ uwagaCena }).where(eq(products.kod, String(pozycja.kod))).run();
    }
  } catch {
    // jak `catch (err) { console.error(...) }` w monkey-patchu — nie wywraca zapisu partii
  }

  return ile;
}
