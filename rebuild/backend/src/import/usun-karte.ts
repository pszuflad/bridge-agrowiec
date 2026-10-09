import type { BazaSqlite } from "../db/index.js";

type Wiersz = Record<string, unknown>;
const s = (v: unknown): string => (v == null ? "" : String(v));

/**
 * Usunięcie JEDNEJ karty z katalogu z pełnym archiwum odtworzeniowym (wspólne dla kroku „usuń karty AUTO” — ticket 206 —
 * i zakładki „Nieobecne w imporcie” — ticket 207). W jednej transakcji: pełny wiersz karty + jej poprawki Marty do
 * `products_scalone`, wpis w `audit_log`, sprzątanie `manual_overrides`, `product_auto_suspensions`, `staging_*` tej karty,
 * usunięcie z `products`. Mapowanie Selly (`selly_products`) ZOSTAJE — karta staje się sierotą, którą zajmie się Tor 3
 * (kontrola tożsamości, limity).
 */
export function usunKarteZArchiwum(
  sqlite: BazaSqlite,
  karta: Wiersz,
  opcje: { teraz: string; scalonoDo: string; akcjaAudytu: string; uzytkownikId?: number | null; uzytkownikImie: string; flaga: string },
): void {
  const kod = s(karta.kod);
  const dostawca = s(karta.dostawca);
  sqlite.transaction(() => {
    const poprawki = sqlite
      .prepare("SELECT * FROM manual_overrides WHERE supplier_kod=? AND supplier_product_id=?")
      .all(dostawca, kod) as Wiersz[];
    sqlite
      .prepare("INSERT INTO products_scalone (kod, dostawca, scalono_do, scalono_at, wiersz_json) VALUES (?,?,?,?,?)")
      .run(kod, dostawca, opcje.scalonoDo, opcje.teraz, JSON.stringify({ produkt: karta, poprawki, [opcje.flaga]: true }));
    sqlite.prepare("DELETE FROM manual_overrides WHERE supplier_kod=? AND supplier_product_id=?").run(dostawca, kod);
    sqlite.prepare("DELETE FROM product_auto_suspensions WHERE supplier=? AND product_code=?").run(dostawca, kod);
    sqlite.prepare("DELETE FROM staging_matches WHERE supplier=? AND product_code=?").run(dostawca, kod);
    sqlite
      .prepare("DELETE FROM staging_absence_decisions WHERE supplier=? AND (product_code=? OR selected_source_code=?)")
      .run(dostawca, kod, kod);
    sqlite.prepare("DELETE FROM staging_items WHERE dostawca=? AND kod=?").run(dostawca, kod);
    sqlite
      .prepare(
        "INSERT INTO audit_log (uzytkownik_id, uzytkownik_imie, akcja, encja_typ, encja_id, szczegoly_json, kiedy) " +
          "VALUES (?, ?, ?, 'product', ?, ?, ?)",
      )
      .run(
        opcje.uzytkownikId ?? null,
        opcje.uzytkownikImie,
        opcje.akcjaAudytu,
        kod,
        JSON.stringify({ kod, dostawca, nazwa: karta.nazwa ?? null, ean: karta.ean ?? null }),
        opcje.teraz,
      );
    sqlite.prepare("DELETE FROM products WHERE id=?").run(karta.id);
  })();
}
