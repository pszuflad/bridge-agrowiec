import type { BazaSqlite } from "../db/index.js";
import { usunKarteZArchiwum } from "./usun-karte.js";

/**
 * Nieobecne w imporcie (ticket 207, decyzja użytkowniczki 2026-10-10) — pozycje WSTRZYMANE AUTOMATYCZNIE, bo zniknęły z
 * kompletnego cennika dostawcy (`product_auto_suspensions`). Po `progDni` od wstrzymania trafiają do zakładki w Katalogu,
 * gdzie można je usunąć albo przywrócić jako aktywne. Datą odniesienia jest `suspended_at`, a nie kalendarz importów —
 * dzięki temu działa tak samo dla dostawców wgrywanych codziennie, co tydzień i raz w roku. Ręcznie wstrzymanych kart
 * (bez wpisu w `product_auto_suspensions`) ta funkcja NIE obejmuje.
 */
export const PROG_DNI_DOMYSLNY = 7;
/** Dostawcy z cennikiem raz w roku (Nokian, Trelleborg): zniknięcie z rocznego, kompletnego pliku jest ostateczne — bez bufora. */
export const PROG_DNI_DOSTAWCY: Record<string, number> = { MO7: 0, MO8: 0 };

export const progDniDostawcy = (dostawca: string): number => PROG_DNI_DOSTAWCY[dostawca] ?? PROG_DNI_DOMYSLNY;

const MS_NA_DOBE = 86_400_000;

export type PozycjaNieobecna = {
  id: number;
  kod: string;
  nazwa: string | null;
  dostawca: string;
  marka: string | null;
  rozmiar: string | null;
  ean: string | null;
  stan: number | null;
  cenaZakupu: number | null;
  wstrzymanoO: string;
  dniNieobecnosci: number;
  powod: string;
};

type Wiersz = Record<string, unknown>;

/** Lista pozycji, które spełniają próg (dla dostawcy), najdłużej nieobecne pierwsze. */
export function listaNieobecnych(sqlite: BazaSqlite, teraz: Date = new Date()): PozycjaNieobecna[] {
  const wiersze = sqlite
    .prepare(
      `SELECT p.id, p.kod, p.nazwa, p.dostawca, p.marka, p.rozmiar, p.ean, p.stan, p.cena_zakupu,
              s.suspended_at, s.reason
       FROM products p
       JOIN product_auto_suspensions s ON s.supplier = p.dostawca AND s.product_code = p.kod
       WHERE p.status = 'wstrzymany'`,
    )
    .all() as Wiersz[];
  const wynik: PozycjaNieobecna[] = [];
  for (const w of wiersze) {
    const od = Date.parse(String(w.suspended_at));
    if (Number.isNaN(od)) continue;
    const dni = Math.floor((teraz.getTime() - od) / MS_NA_DOBE);
    const dostawca = String(w.dostawca);
    if (dni < progDniDostawcy(dostawca)) continue;
    wynik.push({
      id: w.id as number,
      kod: String(w.kod),
      nazwa: (w.nazwa as string | null) ?? null,
      dostawca,
      marka: (w.marka as string | null) ?? null,
      rozmiar: (w.rozmiar as string | null) ?? null,
      ean: (w.ean as string | null) ?? null,
      stan: (w.stan as number | null) ?? null,
      cenaZakupu: (w.cena_zakupu as number | null) ?? null,
      wstrzymanoO: String(w.suspended_at),
      dniNieobecnosci: dni,
      powod: String(w.reason ?? ""),
    });
  }
  return wynik.sort((a, b) => b.dniNieobecnosci - a.dniNieobecnosci || a.kod.localeCompare(b.kod));
}

/** Usuwa wskazane pozycje, ale TYLKO te, które nadal są na liście (serwer przelicza ją sam). Zwraca usunięte kody. */
export function usunNieobecne(
  sqlite: BazaSqlite,
  ids: number[],
  kto: { id?: number | null; imie: string },
  teraz: Date = new Date(),
): string[] {
  const dozwolone = new Map(listaNieobecnych(sqlite, teraz).map((p) => [p.id, p]));
  const usuniete: string[] = [];
  for (const id of new Set(ids)) {
    if (!dozwolone.has(id)) continue;
    const karta = sqlite.prepare("SELECT * FROM products WHERE id=?").get(id) as Wiersz | undefined;
    if (!karta) continue;
    usunKarteZArchiwum(sqlite, karta, {
      teraz: teraz.toISOString(),
      scalonoDo: "USUNIĘTA (nieobecna w imporcie)",
      akcjaAudytu: "usuniecie_nieobecnej",
      uzytkownikId: kto.id ?? null,
      uzytkownikImie: kto.imie,
      flaga: "usunietaNieobecna",
    });
    usuniete.push(String(karta.kod));
  }
  return usuniete;
}

/**
 * Przywraca wskazane pozycje jako aktywne: zdejmuje automatyczne wstrzymanie i dowody nieobecności, status `aktywny`.
 * ⚠ Jeśli pozycji nadal nie ma w pliku dostawcy, KOLEJNY kompletny import wstrzyma ją ponownie (z nową datą) i po progu
 * wróci do zakładki — importer traktuje kompletny cennik jako źródło prawdy o dostępności.
 */
export function przywrocNieobecne(
  sqlite: BazaSqlite,
  ids: number[],
  kto: { id?: number | null; imie: string },
  teraz: Date = new Date(),
): string[] {
  const dozwolone = new Map(listaNieobecnych(sqlite, teraz).map((p) => [p.id, p]));
  const przywrocone: string[] = [];
  for (const id of new Set(ids)) {
    const p = dozwolone.get(id);
    if (!p) continue;
    sqlite.transaction(() => {
      sqlite.prepare("UPDATE products SET status='aktywny', nieobecnosc_pod_rzad=0, data_aktualizacji=? WHERE id=?").run(teraz.toISOString(), id);
      sqlite.prepare("DELETE FROM product_auto_suspensions WHERE supplier=? AND product_code=?").run(p.dostawca, p.kod);
      sqlite.prepare("DELETE FROM product_absence_checks WHERE supplier=? AND product_code=?").run(p.dostawca, p.kod);
      sqlite
        .prepare(
          "INSERT INTO audit_log (uzytkownik_id, uzytkownik_imie, akcja, encja_typ, encja_id, szczegoly_json, kiedy) VALUES (?,?,?,?,?,?,?)",
        )
        .run(kto.id ?? null, kto.imie, "przywrocenie_nieobecnej", "product", p.kod, JSON.stringify({ kod: p.kod, dostawca: p.dostawca, dniNieobecnosci: p.dniNieobecnosci }), teraz.toISOString());
    })();
    przywrocone.push(p.kod);
  }
  return przywrocone;
}
