/**
 * Repozytorium polityki stagingu (karta I15.4a, ticket 124) — na PRAWDZIWEJ bazie SQLite
 * w katalogu tymczasowym, bez jednego mocka. Mockowanie bazy nie miałoby tu sensu: całe
 * zachowanie, które trzeba obronić, siedzi w klauzulach `ON CONFLICT`, a te wykonuje SQLite.
 *
 * Każdy opis niżej wskazuje linię `mirror/backend/staging_policy.cjs` @ 88fa31c, którą odtwarza.
 * Testy pilnują przede wszystkim RÓŻNIC między upsertami — to one giną przy „uproszczeniu"
 * repozytorium do jednego generycznego zapisu.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { otworzBaze, type Baza, type BazaSqlite } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import {
  czyAutomatycznieWstrzymany,
  czyZnanaWersjaOferty,
  decyzjaONieobecnej,
  dopasowanieStagingu,
  dowodyNieobecnosci,
  kodProduktuDlaWybranegoZrodla,
  stanOfertyDostawcy,
  usunAutomatyczneWstrzymanie,
  usunDecyzjeONieobecnej,
  usunDowodyNieobecnosci,
  zamknijSpraweNieobecnej,
  zapiszAutomatyczneWstrzymanie,
  zapiszDopasowanieStagingu,
  zapiszDowodyNieobecnosci,
  zapiszStanOfertyDostawcy,
  zapiszWersjeOferty,
  zapiszWyborBiezacejKarty,
  zapiszWyborKartyZrodlowej,
} from "../src/repos/staging-polityka.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";

let katalog: string;
let sqlite: BazaSqlite;
let db: Baza;

beforeEach(() => {
  katalog = mkdtempSync(join(tmpdir(), "bridge-repo-polityka-"));
  ({ sqlite, db } = otworzBaze(join(katalog, "test.db")));
  zastosujMigracje(sqlite, KATALOG_SCHEMATU());
});
afterEach(() => {
  sqlite.close();
  rmSync(katalog, { recursive: true, force: true });
});

const ile = (tabela: string): number =>
  (sqlite.prepare(`SELECT count(*) AS c FROM ${tabela}`).get() as { c: number }).c;

describe("staging_matches (#99)", () => {
  it("zapis i odczyt po parze dostawca + klucz źródłowy", () => {
    expect(dopasowanieStagingu(db, "MO1", "src-1")).toBeUndefined();
    zapiszDopasowanieStagingu(db, "MO1", "src-1", "K1", "2026-09-22T10:00:00.000Z");
    expect(dopasowanieStagingu(db, "MO1", "src-1")).toBe("K1");
    // Klucz jest złożony — ten sam `source_key` u innego dostawcy to inny wiersz.
    expect(dopasowanieStagingu(db, "MO2", "src-1")).toBeUndefined();
  });

  /** `staging_policy.cjs:224` — `DO UPDATE SET product_code=excluded.…, created_at=excluded.…`. */
  it("powtórny zapis NADPISUJE kod i datę, nie dubluje wiersza", () => {
    zapiszDopasowanieStagingu(db, "MO1", "src-1", "K1", "2026-09-22T10:00:00.000Z");
    zapiszDopasowanieStagingu(db, "MO1", "src-1", "K2", "2026-09-23T11:00:00.000Z");

    expect(ile("staging_matches")).toBe(1);
    expect(sqlite.prepare("SELECT product_code, created_at FROM staging_matches").get()).toEqual({
      product_code: "K2",
      created_at: "2026-09-23T11:00:00.000Z",
    });
  });
});

describe("supplier_feed_state / supplier_feed_versions (#103)", () => {
  const stan = (itemCount: number, maxCount: number, czas: string) => ({
    supplier: "MO1",
    lastIdentityHash: `hash-${itemCount}`,
    lastItemCount: itemCount,
    maxItemCount: maxCount,
    updatedAt: czas,
    lastCountedAt: czas,
  });

  it("zapis i odczyt stanu oferty", () => {
    expect(stanOfertyDostawcy(db, "MO1")).toBeUndefined();
    zapiszStanOfertyDostawcy(db, stan(500, 500, "2026-09-22T10:00:00.000Z"));
    expect(stanOfertyDostawcy(db, "MO1")).toEqual({
      supplier: "MO1",
      lastIdentityHash: "hash-500",
      lastItemCount: 500,
      maxItemCount: 500,
      updatedAt: "2026-09-22T10:00:00.000Z",
      lastCountedAt: "2026-09-22T10:00:00.000Z",
    });
  });

  /**
   * ⭐ `staging_policy.cjs:524`: `max_item_count=MAX(supplier_feed_state.max_item_count, excluded.…)`.
   * To jest blokada źródła — szczyt historyczny NIE MOŻE maleć, bo po nim poznaje się ofertę
   * „mniejszą o ponad 20%". Gdyby ktoś zamienił to na `excluded.max_item_count`, wystarczyłaby
   * jedna obcięta oferta, żeby zabezpieczenie zamilkło.
   */
  it("`maxItemCount` nigdy nie maleje, a `lastItemCount` owszem", () => {
    zapiszStanOfertyDostawcy(db, stan(900, 900, "2026-09-22T10:00:00.000Z"));
    zapiszStanOfertyDostawcy(db, stan(120, 120, "2026-09-23T10:00:00.000Z"));

    expect(ile("supplier_feed_state")).toBe(1);
    const po = stanOfertyDostawcy(db, "MO1")!;
    expect(po.maxItemCount, "szczyt historyczny zostaje").toBe(900);
    expect(po.lastItemCount, "ostatnia oferta jest mniejsza i tak ma być").toBe(120);
    expect(po.lastIdentityHash).toBe("hash-120");
    expect(po.updatedAt).toBe("2026-09-23T10:00:00.000Z");
  });

  it("`maxItemCount` rośnie, gdy oferta faktycznie urosła", () => {
    zapiszStanOfertyDostawcy(db, stan(500, 500, "2026-09-22T10:00:00.000Z"));
    zapiszStanOfertyDostawcy(db, stan(700, 700, "2026-09-23T10:00:00.000Z"));
    expect(stanOfertyDostawcy(db, "MO1")!.maxItemCount).toBe(700);
  });

  it("odciski kompletnych ofert — rozpoznawane po parze dostawca + odcisk", () => {
    expect(czyZnanaWersjaOferty(db, "MO1", "odcisk-1")).toBe(false);
    zapiszWersjeOferty(db, "MO1", "odcisk-1", "2026-09-22T10:00:00.000Z");
    expect(czyZnanaWersjaOferty(db, "MO1", "odcisk-1")).toBe(true);
    expect(czyZnanaWersjaOferty(db, "MO1", "odcisk-2")).toBe(false);
    expect(czyZnanaWersjaOferty(db, "MO2", "odcisk-1")).toBe(false);
  });

  /**
   * `staging_policy.cjs:526` to GOŁY `INSERT`. Oryginał woła go tylko dla nowej wersji, więc
   * powtórka jest błędem wołającego i ma być widoczna, a nie po cichu połknięta.
   */
  it("powtórny zapis tego samego odcisku RZUCA — wiernie, bez `ON CONFLICT`", () => {
    zapiszWersjeOferty(db, "MO1", "odcisk-1", "2026-09-22T10:00:00.000Z");
    expect(() => zapiszWersjeOferty(db, "MO1", "odcisk-1", "2026-09-23T10:00:00.000Z")).toThrow(
      /UNIQUE constraint failed/,
    );
  });
});

describe("product_absence_checks (#103)", () => {
  it("zapis, nadpisanie i skasowanie dowodów", () => {
    expect(dowodyNieobecnosci(db, "MO1", "K1")).toBeUndefined();

    zapiszDowodyNieobecnosci(db, "MO1", "K1", '[{"at":"2026-09-22"}]');
    expect(dowodyNieobecnosci(db, "MO1", "K1")).toBe('[{"at":"2026-09-22"}]');

    zapiszDowodyNieobecnosci(db, "MO1", "K1", '[{"at":"2026-09-22"},{"at":"2026-09-23"}]');
    expect(ile("product_absence_checks")).toBe(1);
    expect(dowodyNieobecnosci(db, "MO1", "K1")).toBe('[{"at":"2026-09-22"},{"at":"2026-09-23"}]');

    usunDowodyNieobecnosci(db, "MO1", "K1");
    expect(dowodyNieobecnosci(db, "MO1", "K1")).toBeUndefined();
  });

  it("kasowanie nie rusza innych produktów ani dostawców", () => {
    zapiszDowodyNieobecnosci(db, "MO1", "K1", "[1]");
    zapiszDowodyNieobecnosci(db, "MO1", "K2", "[2]");
    zapiszDowodyNieobecnosci(db, "MO2", "K1", "[3]");

    usunDowodyNieobecnosci(db, "MO1", "K1");
    expect(dowodyNieobecnosci(db, "MO1", "K2")).toBe("[2]");
    expect(dowodyNieobecnosci(db, "MO2", "K1")).toBe("[3]");
  });
});

describe("product_auto_suspensions (#104)", () => {
  it("odróżnia wstrzymanie automatyczne od jego braku", () => {
    expect(czyAutomatycznieWstrzymany(db, "MO1", "K1")).toBe(false);
    zapiszAutomatyczneWstrzymanie(db, "MO1", "K1", "2026-09-22T10:00:00.000Z", "odcisk-1", "Brak w ofercie");
    expect(czyAutomatycznieWstrzymany(db, "MO1", "K1")).toBe(true);

    usunAutomatyczneWstrzymanie(db, "MO1", "K1");
    expect(czyAutomatycznieWstrzymany(db, "MO1", "K1")).toBe(false);
  });

  /**
   * ⭐ `staging_policy.cjs:123`: `DO UPDATE SET source_fingerprint=…, reason=…` — `suspended_at`
   * NIE JEST na tej liście. Data pierwszego wstrzymania jest punktem odniesienia dla tego, jak
   * długo produktu nie ma w ofercie; przesunięcie jej przy każdym imporcie skasowałoby ten licznik.
   */
  it("powtórne wstrzymanie NIE przesuwa `suspended_at`, aktualizuje odcisk i powód", () => {
    zapiszAutomatyczneWstrzymanie(db, "MO1", "K1", "2026-09-22T10:00:00.000Z", "odcisk-1", "Brak w ofercie");
    zapiszAutomatyczneWstrzymanie(db, "MO1", "K1", "2026-09-23T18:00:00.000Z", "odcisk-2", "Nadal brak");

    expect(ile("product_auto_suspensions")).toBe(1);
    expect(sqlite.prepare("SELECT * FROM product_auto_suspensions").get()).toEqual({
      supplier: "MO1",
      product_code: "K1",
      suspended_at: "2026-09-22T10:00:00.000Z",
      source_fingerprint: "odcisk-2",
      reason: "Nadal brak",
    });
  });

  it("odcisk może być NULL-em (wstrzymanie z decyzji, nie z oferty)", () => {
    zapiszAutomatyczneWstrzymanie(db, "MO1", "K1", "2026-09-23T10:00:00.000Z", null, "Wybrano kartę z bieżącej oferty");
    expect(sqlite.prepare("SELECT source_fingerprint AS f FROM product_auto_suspensions").get()).toEqual({
      f: null,
    });
  });
});

describe("staging_absence_decisions (#106)", () => {
  it("zapis, odczyt hasha kandydatów i ponowne otwarcie sprawy", () => {
    expect(decyzjaONieobecnej(db, "MO1", "K1")).toBeUndefined();

    zamknijSpraweNieobecnej(db, "MO1", "K1", "hash-1", "2026-09-23T10:00:00.000Z");
    expect(decyzjaONieobecnej(db, "MO1", "K1")).toBe("hash-1");

    usunDecyzjeONieobecnej(db, "MO1", "K1");
    expect(decyzjaONieobecnej(db, "MO1", "K1")).toBeUndefined();
  });

  /**
   * ⭐ RÓŻNICA, dla której te trzy zapisy są osobnymi funkcjami. `zamknijSpraweNieobecnej`
   * (`staging_policy.cjs:261`) nie wymienia `selected_source_code` ani wśród kolumn, ani
   * w `DO UPDATE` — wcześniejszy wybór karty ma PRZETRWAĆ zamknięcie sprawy.
   */
  it("zamknięcie sprawy ZACHOWUJE wcześniej wybrany kod źródłowy", () => {
    zapiszWyborKartyZrodlowej(db, "MO1", "K1", "hash-1", "2026-09-23T10:00:00.000Z", "SRC-1");
    expect(kodProduktuDlaWybranegoZrodla(db, "MO1", "SRC-1")).toBe("K1");

    zamknijSpraweNieobecnej(db, "MO1", "K1", "hash-2", "2026-09-23T12:00:00.000Z");

    expect(decyzjaONieobecnej(db, "MO1", "K1")).toBe("hash-2");
    expect(kodProduktuDlaWybranegoZrodla(db, "MO1", "SRC-1"), "wybór zostaje").toBe("K1");
  });

  /**
   * ⭐ Odwrotność powyższego — `staging_policy.cjs:322-325` jawnie ustawia `NULL`, i przy
   * wstawieniu, i przy konflikcie. Dzięki temu kod źródłowy wraca do puli w indeksie
   * `staging_absence_one_choice` i może zostać przypisany innej karcie.
   */
  it("wybór karty bieżącej ZERUJE kod źródłowy i zwalnia go w indeksie", () => {
    zapiszWyborKartyZrodlowej(db, "MO1", "K1", "hash-1", "2026-09-23T10:00:00.000Z", "SRC-1");
    zapiszWyborBiezacejKarty(db, "MO1", "K1", "hash-2", "2026-09-23T12:00:00.000Z");

    expect(ile("staging_absence_decisions")).toBe(1);
    expect(kodProduktuDlaWybranegoZrodla(db, "MO1", "SRC-1")).toBeUndefined();
    // Zwolniony kod można teraz przypisać innej karcie — indeks częściowy już go nie blokuje.
    expect(() =>
      zapiszWyborKartyZrodlowej(db, "MO1", "K2", "hash-3", "2026-09-23T13:00:00.000Z", "SRC-1"),
    ).not.toThrow();
    expect(kodProduktuDlaWybranegoZrodla(db, "MO1", "SRC-1")).toBe("K2");
  });

  it("nadpisanie wyboru innym kodem źródłowym działa i nie dubluje wiersza", () => {
    zapiszWyborKartyZrodlowej(db, "MO1", "K1", "hash-1", "2026-09-23T10:00:00.000Z", "SRC-1");
    zapiszWyborKartyZrodlowej(db, "MO1", "K1", "hash-2", "2026-09-23T12:00:00.000Z", "SRC-2");

    expect(ile("staging_absence_decisions")).toBe(1);
    expect(kodProduktuDlaWybranegoZrodla(db, "MO1", "SRC-1")).toBeUndefined();
    expect(kodProduktuDlaWybranegoZrodla(db, "MO1", "SRC-2")).toBe("K1");
  });

  it("wiele spraw zamkniętych bez wyboru współistnieje u jednego dostawcy", () => {
    zamknijSpraweNieobecnej(db, "MO1", "K1", "hash-1", "2026-09-23T10:00:00.000Z");
    zamknijSpraweNieobecnej(db, "MO1", "K2", "hash-2", "2026-09-23T10:00:00.000Z");
    zapiszWyborBiezacejKarty(db, "MO1", "K3", "hash-3", "2026-09-23T10:00:00.000Z");
    expect(ile("staging_absence_decisions")).toBe(3);
  });

  it("ten sam kod źródłowy u DWÓCH kart tego samego dostawcy jest zablokowany", () => {
    zapiszWyborKartyZrodlowej(db, "MO1", "K1", "hash-1", "2026-09-23T10:00:00.000Z", "SRC-1");
    expect(() =>
      zapiszWyborKartyZrodlowej(db, "MO1", "K2", "hash-2", "2026-09-23T10:00:00.000Z", "SRC-1"),
    ).toThrow(/UNIQUE constraint failed/);
    // ...ale u innego dostawcy ten sam kod jest w porządku — indeks obejmuje `supplier`.
    expect(() =>
      zapiszWyborKartyZrodlowej(db, "MO2", "K2", "hash-2", "2026-09-23T10:00:00.000Z", "SRC-1"),
    ).not.toThrow();
  });
});
