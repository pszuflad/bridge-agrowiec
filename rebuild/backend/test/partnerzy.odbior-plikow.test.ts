/** Ticket 239: odbiór zamówień z plików XML na serwerze plików. */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { otworzBaze, type BazaSqlite } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { partnerZamowienia } from "../src/db/schema.js";
import { pobierzBledy } from "../src/partnerzy/logi.js";
import { odbierzPlikiDlaWszystkich, odbierzZamowieniaZPlikow } from "../src/partnerzy/odbior-plikow.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";
import { XML_PRZYKLAD } from "./partnerzy.zamowienie-przyklad.js";

const TERAZ = new Date("2026-10-12T12:00:00.000Z");

describe("odbiór zamówień z plików", () => {
  let katalog: string;
  let orders: string;
  let sqlite: BazaSqlite;
  let db: ReturnType<typeof otworzBaze>["db"];
  let partnerId: number;
  beforeEach(() => {
    katalog = mkdtempSync(join(tmpdir(), "bridge-239-"));
    orders = join(katalog, "orders");
    mkdirSync(orders);
    ({ sqlite, db } = otworzBaze(join(katalog, "t.db")));
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    partnerId = Number(sqlite.prepare("INSERT INTO partnerzy (nazwa, aktywny, utworzono, zmieniono) VALUES ('Adtyres', 1, 'x', 'x')").run().lastInsertRowid);
  });
  afterEach(() => {
    sqlite.close();
    rmSync(katalog, { recursive: true, force: true });
  });

  /** Zapisuje plik i ustawia mtime na `wiekMs` przed TERAZ. */
  const plik = (nazwa: string, tresc: string, wiekMs = 120_000) => {
    const sciezka = join(orders, nazwa);
    writeFileSync(sciezka, tresc);
    const t = new Date(TERAZ.getTime() - wiekMs);
    utimesSync(sciezka, t, t);
  };

  it("zapisuje zamówienie, przenosi plik do done/, ponowny plik z tym samym numerem to duplikat", () => {
    plik("2026-1.xml", XML_PRZYKLAD);
    const w = odbierzZamowieniaZPlikow(db, partnerId, orders, TERAZ);
    expect(w).toMatchObject({ plikow: 1, nowe: 1, duplikaty: 0, bledy: 0 });
    expect(db.select().from(partnerZamowienia).all()).toHaveLength(1);
    expect(readdirSync(orders).sort()).toEqual(["done"]);
    expect(readdirSync(join(orders, "done"))).toEqual(["2026-1.xml"]);

    plik("2026-1.xml", XML_PRZYKLAD); // ten sam numer, ta sama nazwa pliku w done/ już jest
    const drugi = odbierzZamowieniaZPlikow(db, partnerId, orders, TERAZ);
    expect(drugi).toMatchObject({ plikow: 1, nowe: 0, duplikaty: 1 });
    expect(readdirSync(join(orders, "done"))).toHaveLength(2); // nic nie nadpisane
    expect(db.select().from(partnerZamowienia).all()).toHaveLength(1);
  });

  it("błędny plik: błąd w logu, plik w done/ z prefiksem BLAD_; pozostałe pliki przetworzone", () => {
    plik("a-zly.xml", "<DOCUMENTORDER><NUMBER>X</NUMBER>");
    plik("b-dobry.xml", XML_PRZYKLAD);
    const w = odbierzZamowieniaZPlikow(db, partnerId, orders, TERAZ);
    expect(w).toMatchObject({ plikow: 2, nowe: 1, bledy: 1 });
    expect(readdirSync(join(orders, "done")).sort()).toEqual(["BLAD_a-zly.xml", "b-dobry.xml"]);
    expect(pobierzBledy(db, partnerId).some((b) => JSON.stringify(b).includes("a-zly.xml"))).toBe(true);
  });

  it("pomija pliki młodsze niż 30 s (mogą być jeszcze wgrywane), inne rozszerzenia i podkatalogi", () => {
    plik("swiezy.xml", XML_PRZYKLAD, 5_000);
    plik("notatka.txt", "x");
    const w = odbierzZamowieniaZPlikow(db, partnerId, orders, TERAZ);
    expect(w).toMatchObject({ plikow: 0, nowe: 0, pominiete: 1 });
    expect(readdirSync(orders).sort()).toEqual(["notatka.txt", "swiezy.xml"]);
  });

  it("pomija pliki starsze niż 30 dni (relikty dawnego obiegu) — zostają nietknięte (ticket 266)", () => {
    plik("2022-101179569.xml", XML_PRZYKLAD, 40 * 86_400_000);
    plik("nowy.xml", XML_PRZYKLAD, 60_000);
    const w = odbierzZamowieniaZPlikow(db, partnerId, orders, TERAZ);
    expect(w).toMatchObject({ plikow: 1, nowe: 1, pominiete: 1 });
    expect(readdirSync(orders).sort()).toEqual(["2022-101179569.xml", "done"]);
  });

  it("plik ponad limit rozmiaru nie jest czytany — trafia do done/ jako BLAD_", () => {
    plik("duzy.xml", "x".repeat(2_100_000));
    expect(odbierzZamowieniaZPlikow(db, partnerId, orders, TERAZ)).toMatchObject({ plikow: 1, bledy: 1 });
    expect(existsSync(join(orders, "done", "BLAD_duzy.xml"))).toBe(true);
  });

  it("dowiązanie symboliczne *.xml jest pomijane (nie czytamy cudzych plików); trwała awaria nie zapisuje błędu co przebieg", () => {
    const cel = join(katalog, "cudzy.xml");
    writeFileSync(cel, XML_PRZYKLAD);
    symlinkSync(cel, join(orders, "link.xml"));
    expect(odbierzZamowieniaZPlikow(db, partnerId, orders, TERAZ)).toMatchObject({ plikow: 0, nowe: 0 });
    expect(db.select().from(partnerZamowienia).all()).toHaveLength(0);

    const brak = join(katalog, "brak");
    for (let i = 0; i < 3; i++) odbierzZamowieniaZPlikow(db, partnerId, brak, new Date(TERAZ.getTime() + i * 300_000));
    expect(pobierzBledy(db, partnerId).filter((b) => JSON.stringify(b).includes("niedostępny"))).toHaveLength(1);
  });

  it("niedostępny katalog: błąd w logu, bez wyjątku", () => {
    expect(odbierzZamowieniaZPlikow(db, partnerId, join(katalog, "brak"), TERAZ)).toMatchObject({ bledy: 1 });
  });

  it("dla wszystkich: tylko aktywni partnerzy z wpisem w mapowaniu", () => {
    plik("1.xml", XML_PRZYKLAD);
    sqlite.prepare("INSERT INTO partnerzy (nazwa, aktywny, utworzono, zmieniono) VALUES ('Nieaktywny', 0, 'x', 'x')").run();
    const wyniki = odbierzPlikiDlaWszystkich(db, new Map([["adtyres", orders], ["nieaktywny", join(katalog, "inny")]]), TERAZ);
    expect([...wyniki.values()].map((w) => w.nowe)).toEqual([1]);
  });
});
