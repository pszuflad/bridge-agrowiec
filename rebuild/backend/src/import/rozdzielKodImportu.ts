// Ticket 165-BUG-rozdziel-kod-importu — rozdzielenie `kod_importu` dla znanych kolizji
// (`docs/rebuild-backlog.md` #108, ticket 119 / karta I15.10): ten sam dostawca ma dwie
// fizycznie różne opony pod jednym sześciocyfrowym `kod_importu`, więc dzielą jeden wpis
// mapowania w `selly_products` — synchronizacja Selly (Tor 1) nadpisuje sobie nawzajem
// zapamiętaną cenę/stan i wysyła deltę w kółko co 15 minut.
//
// ⚠ ŚWIADOME ODSTĘPSTWO OD 1:1 (decyzja użytkownika) — w oryginale te kolizje trwają dalej.
// Naprawa: zachowujemy `kod_importu` na PIERWSZYM produkcie w grupie (dostawca, kod_importu),
// a każdemu kolejnemu nadajemy nowy, unikalny sześciocyfrowy numer — dokładnie ten sam kształt,
// jaki generuje `nadajKodImportu()` (`import/polityka/kod-importu.ts`) dla nowych produktów bez
// dopasowania. Skutek zaakceptowany przez użytkownika: przy najbliższym discovery Selly
// potraktuje produkt z nowym numerem jako NOWY produkt (tak samo jak w Bridge) — to nie jest
// błąd do naprawienia, to oczekiwane zachowanie mechanizmu wielomagazynowości.

import { randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import { parse } from "csv-parse/sync";

import { products } from "../db/schema.js";
import type { Baza } from "../db/index.js";
import type { BazaSqlite } from "../db/index.js";

export type WierszKolizji = {
  dostawca: string;
  kod: string;
  kodImportu: string;
};

/** Parsuje CSV z kolumnami `kod_importu,dostawca,kod,...` — pozostałe kolumny ignorowane. */
export function sparsujWierszeKolizji(csvText: string): WierszKolizji[] {
  const rekordy = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  return rekordy
    .filter((r) => r.dostawca && r.kod && r.kod_importu)
    .map((r) => ({ dostawca: r.dostawca!, kod: r.kod!, kodImportu: r.kod_importu! }));
}

/** Losuje nowy sześciocyfrowy `kod_importu`, unikalny wobec bazy i wobec `zajete`. */
function losujWolnyKod(sqlite: BazaSqlite, zajete: Set<string>): string {
  for (let n = 0; n < 100000; n++) {
    const code = String(randomInt(100000, 1000000));
    if (zajete.has(code)) continue;
    if (!sqlite.prepare("SELECT 1 FROM products WHERE kod_importu=? LIMIT 1").get(code)) {
      zajete.add(code);
      return code;
    }
  }
  throw new Error("Brak wolnych numerów kod_importu");
}

export type WynikRozdzieleniaKodow = {
  grupRozdzielonych: number;
  produktowPrzenumerowanych: number;
  pominietoBrakProduktu: number;
};

/**
 * Rozdziela `kod_importu` dla grup kolizyjnych (dostawca, kod_importu) z wierszy wejściowych.
 * Grupuje po (dostawca, kodImportu); pierwszy wiersz w grupie zachowuje numer, każdy kolejny
 * dostaje nowy, unikalny. Pomija wiersze, których produkt nie istnieje już w katalogu.
 */
export function rozdzielKodImportu(
  db: Baza,
  sqlite: BazaSqlite,
  wiersze: WierszKolizji[],
): WynikRozdzieleniaKodow {
  const grupy = new Map<string, WierszKolizji[]>();
  for (const w of wiersze) {
    const klucz = `${w.dostawca}\u0000${w.kodImportu}`;
    const lista = grupy.get(klucz) ?? [];
    lista.push(w);
    grupy.set(klucz, lista);
  }

  let grupRozdzielonych = 0;
  let produktowPrzenumerowanych = 0;
  let pominietoBrakProduktu = 0;
  const zajete = new Set<string>();

  for (const lista of grupy.values()) {
    if (lista.length < 2) continue;

    let grupaMialaZmiane = false;
    // Pierwszy wiersz zachowuje istniejący kod_importu — pomijamy go.
    for (const wiersz of lista.slice(1)) {
      const istniejacy = db
        .select({ id: products.id, kodImportu: products.kodImportu })
        .from(products)
        .where(eq(products.kod, wiersz.kod))
        .get();

      if (!istniejacy) {
        pominietoBrakProduktu++;
        continue;
      }
      // Już rozdzielone w poprzednim przebiegu (kod_importu inny niż z pliku) — nie dotykaj.
      if (istniejacy.kodImportu !== wiersz.kodImportu) continue;

      const nowyKod = losujWolnyKod(sqlite, zajete);
      db.update(products)
        .set({ kodImportu: nowyKod })
        .where(eq(products.id, istniejacy.id))
        .run();
      produktowPrzenumerowanych++;
      grupaMialaZmiane = true;
    }
    if (grupaMialaZmiane) grupRozdzielonych++;
  }

  return { grupRozdzielonych, produktowPrzenumerowanych, pominietoBrakProduktu };
}
