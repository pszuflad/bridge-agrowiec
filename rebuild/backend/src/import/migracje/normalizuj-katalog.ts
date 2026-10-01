// Ticket 178 — Etap 3c SPEC 2026-10-01: jednorazowe czyszczenie katalogu tą samą logiką, której
// importer używa na nowych pozycjach (`polityka/normalizacja-pozycji.ts` — jedna implementacja).
//
// Pola: model, bieżnik, DOT, konstrukcja, indeks nośności, indeks prędkości. Pole chronione
// poprawką ręczną (`manual_overrides`) nie jest ruszane. `nazwa` produktu NIE jest zmieniana
// (zmiana nazw idzie do Selly w delcie i wpływa na SEO — spec wymaga najpierw raportu i akceptacji),
// więc nazwy zostają poza tym skryptem.

import type { BazaSqlite } from "../../db/index.js";
import { normalizujPozycje } from "../polityka/normalizacja-pozycji.js";

type Wiersz = Record<string, unknown>;

/** pole pozycji → kolumna `products`. */
const POLA: Record<string, string> = {
  model: "model",
  bieznik: "bieznik",
  dot: "dot",
  konstrukcja: "konstrukcja",
  indeksNosnosci: "indeks_nosnosci",
  indeksPredkosci: "indeks_predkosci",
};

export type ZmianaKatalogu = {
  kod: string;
  dostawca: string;
  pole: string;
  przed: string;
  po: string;
  status: "zmiana" | "pominieta_poprawka_reczna";
};

const klucz = (t: string): string => t.replace(/[_\s]/g, "").toLowerCase();
const s = (v: unknown): string => (v == null ? "" : String(v));

export function zaplanujNormalizacje(sqlite: BazaSqlite): ZmianaKatalogu[] {
  const chronione = new Map<string, Set<string>>();
  for (const o of sqlite
    .prepare("SELECT supplier_kod, supplier_product_id, field_name FROM manual_overrides")
    .all() as { supplier_kod: string; supplier_product_id: string; field_name: string }[]) {
    const k = `${o.supplier_kod}\u0000${o.supplier_product_id}`;
    const z = chronione.get(k) ?? new Set<string>();
    z.add(klucz(o.field_name));
    chronione.set(k, z);
  }

  const zmiany: ZmianaKatalogu[] = [];
  const karty = sqlite
    .prepare(
      "SELECT kod, dostawca, marka, nazwa, model, bieznik, dot, konstrukcja, indeks_nosnosci, indeks_predkosci FROM products",
    )
    .all() as Wiersz[];
  for (const p of karty) {
    const wejscie = {
      marka: p.marka,
      nazwa: p.nazwa,
      model: p.model,
      bieznik: p.bieznik,
      dot: p.dot,
      konstrukcja: p.konstrukcja,
      indeksNosnosci: p.indeks_nosnosci,
      indeksPredkosci: p.indeks_predkosci,
    };
    const wynik = normalizujPozycje(wejscie);
    const zab = chronione.get(`${s(p.dostawca)}\u0000${s(p.kod)}`);
    for (const [pole] of Object.entries(POLA)) {
      const przed = s(wejscie[pole as keyof typeof wejscie]);
      const po = s(wynik[pole]);
      if (przed === po) continue;
      zmiany.push({
        kod: s(p.kod),
        dostawca: s(p.dostawca),
        pole,
        przed,
        po,
        status: zab?.has(klucz(pole)) ? "pominieta_poprawka_reczna" : "zmiana",
      });
    }
  }
  return zmiany;
}

const csv = (v: unknown): string => {
  const t = v == null ? "" : String(v);
  return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

export function raportNormalizacjiCsv(zmiany: ZmianaKatalogu[]): string {
  return (
    ["kod,dostawca,pole,przed,po,status", ...zmiany.map((z) => [z.kod, z.dostawca, z.pole, z.przed, z.po, z.status].map(csv).join(","))].join(
      "\n",
    ) + "\n"
  );
}

/** Zapisuje zmiany (poza pominiętymi); jedna transakcja, wpis w `audit_log`. Backup robi wołający. */
export function zastosujNormalizacje(sqlite: BazaSqlite, teraz = new Date().toISOString()): number {
  const zmiany = zaplanujNormalizacje(sqlite).filter((z) => z.status === "zmiana");
  sqlite.transaction(() => {
    for (const z of zmiany) {
      sqlite
        .prepare(`UPDATE products SET ${POLA[z.pole]!}=?, data_aktualizacji=? WHERE kod=? AND dostawca=?`)
        .run(z.po === "" ? null : z.po, teraz, z.kod, z.dostawca);
    }
    sqlite
      .prepare(
        "INSERT INTO audit_log (uzytkownik_id, uzytkownik_imie, akcja, encja_typ, encja_id, szczegoly_json, kiedy) " +
          "VALUES (NULL, 'normalizuj-katalog', 'normalizacja_katalogu', 'product', NULL, ?, ?)",
      )
      .run(JSON.stringify({ zmian: zmiany.length }), teraz);
  })();
  return zmiany.length;
}
