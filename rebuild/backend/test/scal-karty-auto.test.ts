// Ticket 177 — scalenie kart `MO*_AUTO_*` z kartami o prawdziwym kodzie (Etap 1 SPEC 2026-10-01).
// Prawdziwy SQLite z kanonicznego schematu, bez mocków; klient Selly to atrapa wstrzyknięta do
// `zerujWariantySelly` (testy nigdy nie wołają sklepu).
import { afterEach, describe, expect, it } from "vitest";

import {
  raportCsv,
  raportScalenia,
  zastosujScalenie,
  zerujWariantySelly,
} from "../src/import/migracje/scal-karty-auto.js";
import { stworzTestowaBaze, type TestowaBaza } from "./gate/baza.js";

let baza: TestowaBaza | null = null;
afterEach(() => {
  baza?.posprzataj();
  baza = null;
});

type W = Record<string, unknown>;

function dodajKarte(b: TestowaBaza, kod: string, extra: W = {}): void {
  const w: W = {
    kod,
    nazwa: "Opona Mitas 6.50-16 TF03",
    marka: "MITAS",
    kategoria: "Opony rolnicze",
    dostawca: "MO5",
    magazyn: "PL",
    stan: 0,
    cena_zakupu: 100,
    cena_sprzedazy: 130,
    marza_pct: 30,
    status: "aktywny",
    data_aktualizacji: "2026-09-23T00:00:00.000Z",
    rozmiar: "6.50-16",
    model: "TF03",
    konstrukcja: "Radialna",
    dot: "2025",
    ...extra,
  };
  const kol = Object.keys(w);
  b.sqlite
    .prepare(`INSERT INTO products (${kol.join(",")}) VALUES (${kol.map(() => "?").join(",")})`)
    .run(...Object.values(w));
}

const wiersz = (b: TestowaBaza, sql: string, ...p: unknown[]) => b.sqlite.prepare(sql).get(...p) as W | undefined;
const ile = (b: TestowaBaza, sql: string, ...p: unknown[]) => (b.sqlite.prepare(sql).all(...p) as W[]).length;

const AUTO = "MO5_AUTO_ABC123DEF456GHI7";
const REAL = "MO5_BFPR240460708DUT1";

/** Para A/R + zgłoszenie „Brak starego kodu” karty A z kandydatem R (ostatni odczyt oferty). */
function para(b: TestowaBaza, opcje: { auto?: W; real?: W; oferta?: W | null } = {}): void {
  dodajKarte(b, AUTO, { stan: 11, status: "aktywny", kod_dostawcy: "BFPR240460708DUT1", dot: "2026", ...opcje.auto });
  dodajKarte(b, REAL, {
    stan: 0,
    status: "wstrzymany",
    kod_dostawcy: "BFPR240460708DUT1",
    kod_importu: "123456",
    ...opcje.real,
  });
  b.sqlite
    .prepare("INSERT INTO product_auto_suspensions (supplier, product_code, suspended_at, reason) VALUES ('MO5',?,?,?)")
    .run(REAL, "2026-09-23T07:55:00.000Z", "auto");
  if (opcje.oferta !== null) {
    const kandydat = { kod: REAL, stan: 7, cenaZakupu: 111, cenaSprzedazy: 150, ...opcje.oferta };
    b.sqlite
      .prepare(
        "INSERT INTO staging_items (typ_zmiany,kod,nazwa,dostawca,magazyn,powod,snapshot_json,utworzono) " +
          "VALUES ('blad',?,?,?,?,?,?,?)",
      )
      .run(AUTO, "n", "MO5", "PL", "Brak starego kodu…", JSON.stringify({ _candidates: [kandydat] }), "2026-10-01");
    b.sqlite
      .prepare(
        "INSERT INTO staging_items (typ_zmiany,kod,nazwa,dostawca,magazyn,powod,utworzono) VALUES ('blad',?,?,?,?,?,?)",
      )
      .run(REAL, "n", "MO5", "PL", "Powrót…", "2026-10-01");
  }
}

function selly(b: TestowaBaza, kod: string, ki: string, productId: number, variantId: number): void {
  b.sqlite
    .prepare(
      "INSERT INTO selly_products (kod_importu, dostawca, bridge_kod, selly_product_id, selly_variant_id) VALUES (?,?,?,?,?)",
    )
    .run(ki, "MO5", kod, productId, variantId);
}

describe("scalenie kart AUTO", () => {
  it("dry-run niczego nie zmienia, a raport zawiera parę", () => {
    baza = stworzTestowaBaze();
    para(baza);
    const wynik = raportScalenia(baza.sqlite);
    expect(wynik.scalono).toBe(1);
    expect(wynik.raport[0]).toMatchObject({ kodAuto: AUTO, kodReal: REAL, stanOferta: 7, decyzja: "scal" });
    expect(raportCsv(wynik.raport)).toContain(`MO5,${AUTO},${REAL}`);
    expect(ile(baza, "SELECT 1 FROM products")).toBe(2);
  });

  it("scala: stan i ceny z oferty, status aktywny, karta AUTO znika do archiwum, kolejka czysta", () => {
    baza = stworzTestowaBaze();
    para(baza);
    const wynik = zastosujScalenie(baza.sqlite, "2026-10-02T10:00:00.000Z");
    expect(wynik).toMatchObject({ scalono: 1, doRecznej: 0 });

    expect(wiersz(baza, "SELECT * FROM products WHERE kod=?", AUTO)).toBeUndefined();
    expect(wiersz(baza, "SELECT * FROM products WHERE kod=?", REAL)).toMatchObject({
      stan: 7,
      cena_zakupu: 111,
      cena_sprzedazy: 150,
      status: "aktywny",
    });
    expect(ile(baza, "SELECT 1 FROM product_auto_suspensions")).toBe(0);
    expect(ile(baza, "SELECT 1 FROM staging_items")).toBe(0);
    const arch = wiersz(baza, "SELECT * FROM products_scalone WHERE kod=?", AUTO)!;
    expect(arch.scalono_do).toBe(REAL);
    expect((JSON.parse(String(arch.wiersz_json)) as { produkt: W }).produkt.stan).toBe(11);
    expect(wiersz(baza, "SELECT * FROM audit_log WHERE akcja='scalenie_karty_auto'")).toBeTruthy();

    // Drugi bieg nie ma już czego scalać.
    expect(zastosujScalenie(baza.sqlite).scalono).toBe(0);
  });

  it("obie karty w Selly: zostaje wiersz R, wiersz A do archiwum, wariant do wyzerowania (bez usuwania)", async () => {
    baza = stworzTestowaBaze();
    para(baza, { auto: { kod_importu: "654321" } });
    selly(baza, AUTO, "654321", 900, 901);
    selly(baza, REAL, "123456", 800, 801);
    zastosujScalenie(baza.sqlite, "2026-10-02T10:00:00.000Z");

    expect((baza.sqlite.prepare("SELECT bridge_kod FROM selly_products").all() as W[]).map((r) => r.bridge_kod)).toEqual([
      REAL,
    ]);
    expect(wiersz(baza, "SELECT * FROM selly_products_scalone")).toMatchObject({
      bridge_kod: AUTO,
      selly_product_id: 900,
      selly_variant_id: 901,
      scalono_do: REAL,
      wyzerowano_at: null,
    });

    const wywolania: unknown[][] = [];
    const klient = {
      updateVariant: async (...a: unknown[]) => {
        wywolania.push(a);
        return {};
      },
    };
    expect(await zerujWariantySelly(baza.sqlite, klient as never, "2026-10-02T11:00:00.000Z")).toEqual({
      wyzerowano: 1,
      bledy: 0,
    });
    expect(wywolania).toEqual([[900, 901, { quantity: 0 }]]);
    expect(wiersz(baza, "SELECT wyzerowano_at FROM selly_products_scalone")?.wyzerowano_at).toBe("2026-10-02T11:00:00.000Z");
    // Drugi raz nic do roboty.
    expect((await zerujWariantySelly(baza.sqlite, klient as never)).wyzerowano).toBe(0);
  });

  it("błąd Selly przy zerowaniu zostaje w archiwum i nie zatrzymuje reszty", async () => {
    baza = stworzTestowaBaze();
    para(baza, { auto: { kod_importu: "654321" } });
    selly(baza, AUTO, "654321", 900, 901);
    selly(baza, REAL, "123456", 800, 801);
    zastosujScalenie(baza.sqlite);
    const w = await zerujWariantySelly(baza.sqlite, {
      updateVariant: async () => {
        throw new Error("503");
      },
    } as never);
    expect(w).toEqual({ wyzerowano: 0, bledy: 1 });
    expect(String(wiersz(baza, "SELECT ostatni_blad FROM selly_products_scalone")?.ostatni_blad)).toContain("503");
  });

  it("tylko A w Selly: wiersz przepięty na R, kod_importu karty R", () => {
    baza = stworzTestowaBaze();
    para(baza, { auto: { kod_importu: "654321" } });
    selly(baza, AUTO, "654321", 900, 901);
    zastosujScalenie(baza.sqlite);
    expect(wiersz(baza, "SELECT * FROM selly_products")).toMatchObject({
      bridge_kod: REAL,
      kod_importu: "123456",
      selly_product_id: 900,
    });
    expect(ile(baza, "SELECT 1 FROM selly_products_scalone")).toBe(0);
  });

  it("poprawki ręczne: przenoszone, a przy konflikcie wygrywa R (A trafia do archiwum)", () => {
    baza = stworzTestowaBaze();
    para(baza);
    const dodaj = (kod: string, pole: string, wartosc: string) =>
      baza!.sqlite
        .prepare(
          "INSERT INTO manual_overrides (supplier_kod, supplier_product_id, field_name, override_value, created_at) VALUES ('MO5',?,?,?,'2026-01-01')",
        )
        .run(kod, pole, wartosc);
    dodaj(AUTO, "model", "TF-03-A");
    dodaj(AUTO, "waga", "42");
    dodaj(REAL, "model", "TF03-R");
    expect(raportScalenia(baza.sqlite).raport[0]!.overrideKonflikt).toBe("model");
    zastosujScalenie(baza.sqlite);
    const poR = baza.sqlite
      .prepare("SELECT field_name, override_value FROM manual_overrides WHERE supplier_product_id=? ORDER BY field_name")
      .all(REAL);
    expect(poR).toEqual([
      { field_name: "model", override_value: "TF03-R" },
      { field_name: "waga", override_value: "42" },
    ]);
    const arch = JSON.parse(String(wiersz(baza, "SELECT wiersz_json FROM products_scalone")?.wiersz_json)) as {
      poprawki: W[];
    };
    expect(arch.poprawki.map((p) => p.override_value)).toContain("TF-03-A");
  });

  it("przypadki niejednoznaczne zostają nietknięte (do_recznej)", () => {
    baza = stworzTestowaBaze();
    // różny, prawdziwy EAN
    para(baza, { auto: { ean: "5901234123457" }, real: { ean: "4006381333931" } });
    // AUTO bez prawdziwej karty
    dodajKarte(baza, "MO4_AUTO_ZZZ", { dostawca: "MO4", kod_dostawcy: "NIEMA" });
    // AUTO bez kod_dostawcy
    dodajKarte(baza, "MO3_AUTO_QQQ", { dostawca: "MO3" });
    const wynik = zastosujScalenie(baza.sqlite);
    expect(wynik.scalono).toBe(0);
    expect(wynik.raport.map((w) => w.powod).sort()).toEqual([
      "brak karty z prawdziwym kodem",
      "karta AUTO bez kod_dostawcy",
      "różny EAN",
    ]);
    expect(ile(baza, "SELECT 1 FROM products")).toBe(4);
  });

  it("dwie karty AUTO na jedną prawdziwą → obie do ręcznej decyzji", () => {
    baza = stworzTestowaBaze();
    para(baza);
    dodajKarte(baza, "MO5_AUTO_DRUGA", { kod_dostawcy: "BFPR240460708DUT1", dot: "2027" });
    const wynik = zastosujScalenie(baza.sqlite);
    expect(wynik.scalono).toBe(0);
    expect(wynik.raport.every((w) => w.powod.includes("tę samą prawdziwą"))).toBe(true);
  });

  it("brak danych oferty: karta R bez zmian stanu i statusu", () => {
    baza = stworzTestowaBaze();
    para(baza, { oferta: null });
    zastosujScalenie(baza.sqlite);
    expect(wiersz(baza, "SELECT stan, status FROM products WHERE kod=?", REAL)).toEqual({ stan: 0, status: "wstrzymany" });
    expect(ile(baza, "SELECT 1 FROM product_auto_suspensions")).toBe(1);
  });
});
