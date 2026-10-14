/** Ticket 238: publikacja cenników do katalogów partnerów. */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { otworzBaze, type BazaSqlite } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { products } from "../src/db/schema.js";
import type { KlientNbp } from "../src/partnerzy/kurs-nbp.js";
import { pobierzBledy } from "../src/partnerzy/logi.js";
import { parsujKatalogiPublikacji, publikujPliki } from "../src/partnerzy/publikacja.js";
import { stworzSerwisPartnerow } from "../src/partnerzy/scheduler.js";
import { importujTabeleGeis } from "../src/partnerzy/transport.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";

const NBP: KlientNbp = { pobierzKursEur: async () => ({ kurs: 4.3, data: "2026-10-09" }) };

describe("parsujKatalogiPublikacji", () => {
  it("parsuje wpisy (nazwa bez rozróżniania wielkości liter), pusty tekst = brak publikacji", () => {
    expect([...parsujKatalogiPublikacji("Adtyres=/srv/a;TyreWorld=/srv/t ;")]).toEqual([["adtyres", "/srv/a"], ["tyreworld", "/srv/t"]]);
    expect(parsujKatalogiPublikacji(undefined).size).toBe(0);
  });
  it("odrzuca ścieżkę względną i wpis bez nazwy", () => {
    expect(() => parsujKatalogiPublikacji("Adtyres=katalog/a")).toThrow(/niepoprawny wpis/);
    expect(() => parsujKatalogiPublikacji("=/srv/a")).toThrow(/niepoprawny wpis/);
  });
});

describe("publikacja do katalogu partnera", () => {
  let katalog: string;
  let sqlite: BazaSqlite;
  let db: ReturnType<typeof otworzBaze>["db"];
  beforeEach(() => {
    katalog = mkdtempSync(join(tmpdir(), "bridge-238-"));
    ({ sqlite, db } = otworzBaze(join(katalog, "t.db")));
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    importujTabeleGeis(db, { AT: { wspGabarytowy: 250, stawki: [[100, 15]] } });
    db.insert(products).values({
      kod: "A", nazwa: "Opona", marka: "M", kategoria: "Rolnicze", dostawca: "MO1", magazyn: "MO1", stan: 5, cenaZakupu: 1000, cenaSprzedazy: 1500, marzaPct: 50,
      dataAktualizacji: "2026-10-10T00:00:00.000Z", ean: "5901", waga: 40, dlugosc: 70, szerokoscPaczki: 50, wysokosc: 70,
    }).run();
  });
  afterEach(() => {
    sqlite.close();
    rmSync(katalog, { recursive: true, force: true });
  });

  it("publikujPliki: kopiuje bez plików tymczasowych; brak katalogu i zła nazwa to błędy, nie wyjątki", () => {
    const zrodlo = join(katalog, "z");
    const cel = join(katalog, "cel");
    mkdirSync(zrodlo);
    mkdirSync(cel);
    writeFileSync(join(zrodlo, "a.csv"), "x");
    expect(publikujPliki(zrodlo, cel, ["a.csv"])).toEqual({ opublikowane: ["a.csv"], bledy: [] });
    expect(readdirSync(cel)).toEqual(["a.csv"]);
    const zla = publikujPliki(zrodlo, cel, ["../a.csv", "brak.csv"]);
    expect(zla.opublikowane).toEqual([]);
    expect(zla.bledy).toHaveLength(2);
    expect(publikujPliki(zrodlo, join(katalog, "nie-ma"), ["a.csv"]).bledy[0]).toMatch(/niedostępny/);
  });

  const partner = (nazwa: string, narzut: number) => {
    const id = Number(sqlite.prepare("INSERT INTO partnerzy (nazwa, nazwa_pliku, utworzono, zmieniono) VALUES (?, 'plik', 'x', 'x')").run(nazwa).lastInsertRowid);
    sqlite.prepare("INSERT INTO partner_magazyny VALUES (?, 'MO1')").run(id);
    sqlite.prepare("INSERT INTO partner_kraje (partner_id, kraj, narzut_proc) VALUES (?, 'AT', ?)").run(id, narzut);
    sqlite.prepare("INSERT INTO partner_kolumny (partner_id, pozycja, nazwa_w_pliku, zrodlo_typ, zrodlo) VALUES (?, 1, 'CatNumber', 'katalog', 'numerPartnera'), (?, 2, 'Cena', 'cena', 'AT')").run(id, id);
    return id;
  };

  it("serwis: po wygenerowaniu kopiuje plik do katalogu partnera; bez wpisu mapowania nie publikuje; narzut 0 % nic nie publikuje", async () => {
    const cel = join(katalog, "ftp-adtyres");
    mkdirSync(cel);
    const id = partner("Adtyres", 12);
    const bezMapy = stworzSerwisPartnerow({ db, klientNbp: NBP, katalogBazowy: join(katalog, "p") });
    await bezMapy.generujTeraz(id);
    expect(readdirSync(cel)).toEqual([]);

    const serwis = stworzSerwisPartnerow({ db, klientNbp: NBP, katalogBazowy: join(katalog, "p"), katalogiPublikacji: new Map([["adtyres", cel]]) });
    await serwis.generujTeraz(id);
    expect(readdirSync(cel)).toEqual(["plik_at.csv"]);
    expect(readFileSync(join(cel, "plik_at.csv"), "utf8").split("\n")[1]).toMatch(/^5901-MO1;\d+\.\d{2}$/);

    const id0 = partner("TyreWorld", 0);
    const cel0 = join(katalog, "ftp-tw");
    mkdirSync(cel0);
    await stworzSerwisPartnerow({ db, klientNbp: NBP, katalogBazowy: join(katalog, "p"), katalogiPublikacji: new Map([["tyreworld", cel0]]) }).generujTeraz(id0);
    expect(existsSync(join(cel0, "plik_at.csv"))).toBe(false);
  });

  it("niedostępny katalog docelowy: błąd w logu partnera, generowanie się nie wywraca", async () => {
    const id = partner("Adtyres", 12);
    const serwis = stworzSerwisPartnerow({ db, klientNbp: NBP, katalogBazowy: join(katalog, "p"), katalogiPublikacji: new Map([["adtyres", join(katalog, "brak")]]) });
    await expect(serwis.generujTeraz(id)).resolves.toBeDefined();
    expect(pobierzBledy(db, id).some((b) => /niedostępny/.test(b.komunikat ?? JSON.stringify(b)))).toBe(true);
  });
});
