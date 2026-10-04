/**
 * Migracja 022 (ticket 185) — jednorazowe przypisanie kategorii i zastosowania z CSV przy wdrożeniu.
 * Prawdziwy SQLite; produkty wstawiane PRZED 022 (jak baza produkcji przy wdrożeniu), potem pełny łańcuch.
 */
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { otworzBaze, type BazaSqlite } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { trescMigracjiPrzypisania } from "../src/import/migracje/migracja-przypisania-sql.js";
import { wierszePliku } from "../src/import/migracje/przypisz-kategorie-zastosowanie.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";

const PLIK = "022_przypisanie_kategorii_zastosowania_csv.sql";
const CSV = join(dirname(fileURLToPath(import.meta.url)), "../scripts/data/katalog-kategoria-zastosowanie-2026-09-30.csv");

let katalog: string;
let sqlite: BazaSqlite;

beforeEach(() => {
  katalog = mkdtempSync(join(tmpdir(), "bridge-022-"));
  ({ sqlite } = otworzBaze(join(katalog, "t.db")));
});
afterEach(() => {
  sqlite.close();
  rmSync(katalog, { recursive: true, force: true });
});

const bez022 = (): string => {
  const k = join(katalog, "bez-022");
  mkdirSync(k);
  for (const p of readdirSync(KATALOG_SCHEMATU())) {
    if (p.endsWith(".sql") && p !== PLIK) copyFileSync(join(KATALOG_SCHEMATU(), p), join(k, p));
  }
  return k;
};

const dodaj = (kod: string, nazwa: string, kategoria = "Rolnicze", zastosowanie: string | null = null, dostawca = "MO1") =>
  sqlite
    .prepare(
      `INSERT INTO products (kod, nazwa, marka, kategoria, dostawca, magazyn, stan, cena_zakupu, cena_sprzedazy, marza_pct, data_aktualizacji, zastosowanie)
       VALUES (?, ?, 'BKT', ?, ?, '0', 0, 1, 1, 0, '2026-10-01', ?)`,
    )
    .run(kod, nazwa, kategoria, dostawca, zastosowanie);

const stan = (kod: string) =>
  sqlite.prepare("SELECT kategoria, zastosowanie FROM products WHERE kod = ?").get(kod);

describe("022 — przypisanie z CSV", () => {
  it("plik SQL jest dokładnie wynikiem generatora z CSV (nie edytowany ręcznie)", () => {
    const zPliku = readFileSync(join(KATALOG_SCHEMATU(), PLIK), "utf8");
    expect(zPliku).toBe(trescMigracjiPrzypisania(wierszePliku(readFileSync(CSV, "utf8"))));
  });

  it("przenosi produkty wg tabeli, pomija poprawki Marty i nazwy spoza pliku, zapisuje history", () => {
    zastosujMigracje(sqlite, bez022());
    dodaj("1", "35/65-33 BKT LOADER SPL 42PR TL"); // CSV: Przemysłowe / Ładowarka
    dodaj("2", "620/70R42 BKT AGRIMAX FACTOR 166D/169A8 TL", "Rolnicze", "Uniwersalne/pozostałe"); // → Rolnicze / Ciągnik
    dodaj("3", "35/65-33 BKT LOADER SPL 42PR TL", "Rolnicze", null, "MO2"); // poprawka Marty
    dodaj("4", "NAZWA SPOZA PLIKU 123"); // nietknięty
    dodaj("5", "320/85R34 BKT AGRIMAX RT 855 141A8/B TL", "Rolnicze", null); // nazwa „niejednoznaczna” w CSV → Ciągnik
    sqlite
      .prepare(
        "INSERT INTO manual_overrides (supplier_kod, supplier_product_id, field_name, override_value, created_at) VALUES ('MO2','3','zastosowanie','Kombajn','2026-10-01')",
      )
      .run();

    expect(zastosujMigracje(sqlite, KATALOG_SCHEMATU()).zastosowane).toEqual([PLIK]);

    expect(stan("1")).toEqual({ kategoria: "Przemysłowe", zastosowanie: "Ładowarka" });
    expect(stan("2")).toEqual({ kategoria: "Rolnicze", zastosowanie: "Ciągnik" });
    expect(stan("3")).toEqual({ kategoria: "Rolnicze", zastosowanie: null });
    expect(stan("4")).toEqual({ kategoria: "Rolnicze", zastosowanie: null });
    expect(stan("5")).toEqual({ kategoria: "Rolnicze", zastosowanie: "Ciągnik" });

    const hist = sqlite
      .prepare("SELECT kod_produktu, pole, stara_wartosc, nowa_wartosc, zrodlo, kto FROM history WHERE kod_produktu = '1' ORDER BY pole")
      .all();
    expect(hist).toEqual([
      { kod_produktu: "1", pole: "kategoria", stara_wartosc: "Rolnicze", nowa_wartosc: "Przemysłowe", zrodlo: "przypisanie-kat-zast", kto: "migracja 022" },
      { kod_produktu: "1", pole: "zastosowanie", stara_wartosc: "", nowa_wartosc: "Ładowarka", zrodlo: "przypisanie-kat-zast", kto: "migracja 022" },
    ]);
    // tabela robocza nie zostaje w bazie
    expect(sqlite.prepare("SELECT name FROM sqlite_master WHERE name = '_przypisanie_185'").get()).toBeUndefined();
  });

  it("wykonuje się raz: ponowne zastosowanie migracji niczego nie zmienia, a ręczna zmiana po wdrożeniu przetrwa", () => {
    zastosujMigracje(sqlite, bez022());
    dodaj("1", "35/65-33 BKT LOADER SPL 42PR TL");
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    sqlite.prepare("UPDATE products SET kategoria = 'Leśne', zastosowanie = 'Skidder' WHERE kod = '1'").run();
    expect(zastosujMigracje(sqlite, KATALOG_SCHEMATU()).zastosowane).toEqual([]);
    expect(stan("1")).toEqual({ kategoria: "Leśne", zastosowanie: "Skidder" });
  });

  it("po przypisaniu żaden produkt nie ma pary, którą trigger by jeszcze poprawił (brak „poprawionych przez trigger”)", () => {
    zastosujMigracje(sqlite, bez022());
    const nazwy = wierszePliku(readFileSync(CSV, "utf8")).slice(0, 600).map((w) => w.nazwa);
    nazwy.forEach((n, i) => dodaj(`K${i}`, n));
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    const przed = sqlite.prepare("SELECT kod, kategoria, zastosowanie FROM products ORDER BY kod").all();
    // „dotknięcie” każdego wiersza (UPDATE kategorii na siebie) uruchamia trigger — wynik ma się nie zmienić
    sqlite.prepare("UPDATE products SET kategoria = kategoria, zastosowanie = zastosowanie").run();
    expect(sqlite.prepare("SELECT kod, kategoria, zastosowanie FROM products ORDER BY kod").all()).toEqual(przed);
  });
});
