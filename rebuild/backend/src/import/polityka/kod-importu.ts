// Nadpisanie `ext.assignKodImportu` — `staging_policy.cjs:141-157`.
//
// ⭐ TO JEST PODMIANA ZACHOWANIA, NIE REFAKTOR. Stara wersja (`legacy/bridge_ext.cjs:156`)
// grupuje produkty do wspólnego `kod_importu` po EAN-ie, a zapasowo po
// `marka|rozmiar|bieznik|nazwa`. Staging v2 grupuje po `compatibility()` — czyli po pełnej
// tożsamości opony (marka + model + rozmiar + pola opcjonalne, z DOT-em i wariantem DEMO
// włącznie) — i DOPIERO w jej obrębie po EAN-ie albo nazwie.
//
// Skutek widać przy wielomagazynowości Selly: dwie pozycje tej samej opony z różnych
// magazynów mają dostać ten sam numer grupy, a dwie różne partie (różny DOT) — różne.
//
// ⚠ ZAKRES WPIĘCIA (decyzja użytkownika, plan.md D129.4): w produkcji to globalny
// monkey-patch na `__BRIDGE_EXT`, więc dotyczy każdego wywołania. U nas wstrzykujemy go
// w dwie ścieżki AKCEPTACJI (`import/akceptacja.ts`, `import/bulk.ts`), zostawiając
// `silnik/bridge-ext.ts` i `legacy/bridge_ext.cjs` nietknięte — te pliki dzieli z nami
// równoległa karta I15.4b i nie wchodzimy w nie.

import { randomInt } from "node:crypto";

import type { Baza } from "../../db/index.js";
import { listaProduktow } from "../../repos/products.js";
import { uchwytSqlite } from "../silnik/bridge-ext.js";
import { compatibility, norm, validateEan } from "./helpery.js";

const SZESC_CYFR = /^\d{6}$/;

/**
 * Nadaje `kodImportu` wg polityki Staging v2. MUTUJE przekazany rekord — tak samo jak
 * oryginał i tak samo jak stara wersja z `bridge_ext.cjs`.
 *
 * ⚠ NIESPÓJNOŚĆ ORYGINAŁU ODTWARZANA 1:1: pierwsza reguła czyta `existing.kodImportu`
 * ORAZ `existing.kod_importu`. Nowa wersja (`:142`) sprawdza oba zapisy, w odróżnieniu
 * od starej, która pytała wyłącznie o `kod_importu` i dlatego nigdy nie wypalała na
 * wierszu z Drizzle. To realna różnica: numer grupy zachowuje się teraz od razu.
 */
export function nadajKodImportu(
  db: Baza,
  produkt: Record<string, unknown>,
  istniejacy: Record<string, unknown> | null | undefined,
): void {
  const zachowany = istniejacy?.kodImportu ?? istniejacy?.kod_importu;
  if (zachowany && SZESC_CYFR.test(String(zachowany))) {
    produkt.kodImportu = String(zachowany);
    return;
  }

  const ev = validateEan(produkt.ean);
  const zgodne = listaProduktow(db).filter((p) => {
    const kandydat = p as unknown as Record<string, unknown>;
    return (
      kandydat.kod !== produkt.kod &&
      compatibility(produkt, kandydat).ok &&
      (ev.valid
        ? kandydat.ean === ev.value
        : !kandydat.ean && norm(kandydat.nazwa) === norm(produkt.nazwa))
    );
  });

  // Grupa tylko wtedy, gdy jest JEDNOZNACZNA. Dwie różne grupy wśród zgodnych produktów
  // znaczą, że katalog jest niespójny — wtedy nowy numer, a nie zgadywanie (`:150`).
  const grupy = new Set(
    zgodne
      .map((p) => String((p as unknown as Record<string, unknown>).kodImportu ?? ""))
      .filter((v) => SZESC_CYFR.test(v)),
  );
  if (grupy.size === 1) {
    produkt.kodImportu = [...grupy][0];
    return;
  }

  const sqlite = uchwytSqlite(db);
  for (let n = 0; n < 100000; n++) {
    const code = String(randomInt(100000, 1000000));
    if (!sqlite.prepare("SELECT 1 FROM products WHERE kod_importu=? LIMIT 1").get(code)) {
      produkt.kodImportu = code;
      return;
    }
  }
  throw Error("Brak wolnych numerów grup produktów");
}
