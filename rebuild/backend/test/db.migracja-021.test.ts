/**
 * Migracja 021 (ticket 185) — „Wózek widłowy” wypada z listy zastosowań Rolniczych.
 * Dowód: na bazie z 011 i na bazie z pełnym łańcuchem (011 + 021) przepuszczamy całą macierz par
 * kategoria × zastosowanie przez triggery i sprawdzamy, że różni się DOKŁADNIE jedna para.
 */
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { otworzBaze, type BazaSqlite } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";

const KATEGORIE = ["Rolnicze", "Przemysłowe", "Ciężarowe", "Leśne"];
const ZASTOSOWANIA = [
  "Ciągnik", "Kombajn", "Opryskiwacz", "Przyczepa", "Kosiarka/ogród", "Wózek widłowy", "Ładowarka", "Koparka",
  "Kompaktor", "Suwnica/dźwig", "Maszyny górnicze", "All position", "Oś kierowana", "Oś napędowa",
  "Naczepa/przyczepa", "Ciągnik leśny", "Forwarder/Harwester", "Skidder", "Uniwersalne/pozostałe",
];

let katalog: string;
let sqlite: BazaSqlite;

beforeEach(() => {
  katalog = mkdtempSync(join(tmpdir(), "bridge-021-"));
  ({ sqlite } = otworzBaze(join(katalog, "t.db")));
});
afterEach(() => {
  sqlite.close();
  rmSync(katalog, { recursive: true, force: true });
});

/** Wynik triggera dla pary: INSERT i UPDATE (oba triggery muszą dać to samo). */
function przezTriggery(db: BazaSqlite, kategoria: string, zastosowanie: string): [string, string | null] {
  db.prepare("DELETE FROM products").run();
  db.prepare(
    `INSERT INTO products (kod, nazwa, marka, kategoria, dostawca, magazyn, stan, cena_zakupu, cena_sprzedazy, marza_pct, data_aktualizacji, zastosowanie)
     VALUES ('T', 'T', 'M', ?, 'MO1', '0', 0, 1, 1, 0, '2026-01-01', ?)`,
  ).run(kategoria, zastosowanie);
  const po = db.prepare("SELECT kategoria, zastosowanie FROM products WHERE kod = 'T'").get() as {
    kategoria: string;
    zastosowanie: string | null;
  };
  db.prepare("UPDATE products SET zastosowanie = 'x' WHERE kod = 'T'").run();
  db.prepare("UPDATE products SET zastosowanie = ? WHERE kod = 'T'").run(zastosowanie);
  const poUpdate = db.prepare("SELECT kategoria, zastosowanie FROM products WHERE kod = 'T'").get() as typeof po;
  expect(poUpdate).toEqual(po);
  return [po.kategoria, po.zastosowanie];
}

describe("021 — zastosowania: Wózek widłowy tylko w Przemysłowych", () => {
  it("zmienia wynik triggera dla jednej pary: Rolnicze / Wózek widłowy → Uniwersalne/pozostałe", () => {
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    expect(przezTriggery(sqlite, "Rolnicze", "Wózek widłowy")).toEqual(["Rolnicze", "Uniwersalne/pozostałe"]);
    expect(przezTriggery(sqlite, "Przemysłowe", "Wózek widłowy")).toEqual(["Przemysłowe", "Wózek widłowy"]);
    expect(przezTriggery(sqlite, "Rolnicze", "Ciągnik")).toEqual(["Rolnicze", "Ciągnik"]);
    expect(przezTriggery(sqlite, "Rolnicze", "Kosiarka/ogród")).toEqual(["Rolnicze", "Kosiarka/ogród"]);
  });

  it("zostawia bez zmian CAŁĄ resztę macierzy (różni się wyłącznie Rolnicze / Wózek widłowy)", () => {
    // Stan sprzed 021: pełny łańcuch bez pliku 021 (triggery z 011).
    const przed = new Map<string, [string, string | null]>();
    const bezPliku = mkdtempSync(join(tmpdir(), "bridge-021-bez-"));
    try {
      const { sqlite: stara } = otworzBaze(join(bezPliku, "stara.db"));
      
      const k = join(bezPliku, "bez-021");
      mkdirSync(k);
      for (const p of readdirSync(KATALOG_SCHEMATU())) {
        if (p.endsWith(".sql") && !p.startsWith("021_")) copyFileSync(join(KATALOG_SCHEMATU(), p), join(k, p));
      }
      zastosujMigracje(stara, k);
      for (const kat of KATEGORIE) for (const z of ZASTOSOWANIA) przed.set(`${kat}|${z}`, przezTriggery(stara, kat, z));
      stara.close();
    } finally {
      rmSync(bezPliku, { recursive: true, force: true });
    }

    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    const roznice: string[] = [];
    for (const kat of KATEGORIE) {
      for (const z of ZASTOSOWANIA) {
        const po = przezTriggery(sqlite, kat, z);
        if (JSON.stringify(po) !== JSON.stringify(przed.get(`${kat}|${z}`))) roznice.push(`${kat} / ${z}`);
      }
    }
    expect(roznice).toEqual(["Rolnicze / Wózek widłowy"]);
  });

  it("zachowuje sześć triggerów i jest odporna na ponowne zastosowanie treści", () => {
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    const nazwy = (sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' ORDER BY name").all() as { name: string }[]).map((t) => t.name);
    expect(nazwy).toEqual([
      "manual_overrides_kategoria_ai",
      "manual_overrides_kategoria_au",
      "products_blokowane_formy_ai",
      "products_blokowane_formy_au",
      "products_zastosowanie_ai",
      "products_zastosowanie_au",
    ]);
    expect(zastosujMigracje(sqlite, KATALOG_SCHEMATU()).zastosowane).toEqual([]);
  });
});
