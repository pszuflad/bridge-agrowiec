// Ticket 206: usunięcie wszystkich wstrzymanych kart AUTO (decyzja użytkowniczki 2026-10-09).
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MAKS_USUNIEC_AUTO, usunWszystkieKartyAuto } from "../src/import/migracje/scal-karty-auto.js";
import { stworzTestowaBaze, zasiejMapowanie, type TestowaBaza } from "./gate/index.js";

describe("usunWszystkieKartyAuto", () => {
  let baza: TestowaBaza;
  beforeEach(() => {
    baza = stworzTestowaBaze();
  });
  afterEach(() => baza.posprzataj());

  const karta = (kod: string, status: string, dostawca = "MO5") =>
    baza.sqlite
      .prepare(
        `INSERT INTO products (kod, nazwa, marka, kategoria, dostawca, magazyn, stan, cena_zakupu, cena_sprzedazy, marza_pct, data_aktualizacji, status)
         VALUES (?, ?, 'BKT', 'Rolnicze', ?, '0', 0, 1, 1, 0, '2026-10-01', ?)`,
      )
      .run(kod, `Opona ${kod}`, dostawca, status);
  const kody = () => (baza.sqlite.prepare("SELECT kod FROM products ORDER BY kod").all() as { kod: string }[]).map((r) => r.kod);

  it("usuwa wstrzymane AUTO z archiwum, poprawkami i wpisem audytu; zwykłe i aktywne AUTO zostają", () => {
    karta("MO5_AUTO_AAA", "wstrzymany");
    karta("MO9_AUTO_BBB", "wstrzymany", "MO9");
    karta("MO5_AUTO_CZYNNA", "aktywny");
    karta("MO5_ZWYKLA1", "wstrzymany");
    baza.sqlite
      .prepare("INSERT INTO manual_overrides (supplier_kod, supplier_product_id, field_name, override_value, created_at) VALUES ('MO5','MO5_AUTO_AAA','model','X','2026-10-01')")
      .run();
    zasiejMapowanie(baza.sqlite, { kodImportu: "K1", dostawca: "MO5", bridgeKod: "MO5_AUTO_AAA", productId: 1, variantId: 2 });

    const w = usunWszystkieKartyAuto(baza.sqlite, "2026-10-09T10:00:00.000Z");

    expect(w.usuniete.sort()).toEqual(["MO5_AUTO_AAA", "MO9_AUTO_BBB"]);
    expect(w.pominiete).toEqual([{ kod: "MO5_AUTO_CZYNNA", powod: expect.stringContaining("aktywny") }]);
    expect(kody()).toEqual(["MO5_AUTO_CZYNNA", "MO5_ZWYKLA1"]);
    const arch = baza.sqlite.prepare("SELECT * FROM products_scalone WHERE kod = 'MO5_AUTO_AAA'").get() as Record<string, string>;
    const json = JSON.parse(arch.wiersz_json!) as { produkt: { kod: string }; poprawki: unknown[] };
    expect(json.produkt.kod).toBe("MO5_AUTO_AAA");
    expect(json.poprawki).toHaveLength(1);
    expect(baza.sqlite.prepare("SELECT COUNT(*) c FROM manual_overrides").get()).toEqual({ c: 0 });
    expect(baza.sqlite.prepare("SELECT COUNT(*) c FROM audit_log WHERE akcja = 'usuniecie_karty_auto'").get()).toEqual({ c: 2 });
    // mapowanie Selly zostaje — Tor 3 zajmie się sierotą z kontrolą tożsamości
    expect(baza.sqlite.prepare("SELECT COUNT(*) c FROM selly_products WHERE bridge_kod = 'MO5_AUTO_AAA'").get()).toEqual({ c: 1 });
  });

  it("drugi bieg niczego nie robi (idempotentny)", () => {
    karta("MO5_AUTO_AAA", "wstrzymany");
    usunWszystkieKartyAuto(baza.sqlite);
    expect(usunWszystkieKartyAuto(baza.sqlite)).toEqual({ usuniete: [], pominiete: [] });
  });

  it("zbyt wiele kart (powyżej progu) → wyjątek i NIC nie jest usuwane", () => {
    for (let i = 0; i <= MAKS_USUNIEC_AUTO; i++) karta(`MO5_AUTO_${i}`, "wstrzymany");
    expect(() => usunWszystkieKartyAuto(baza.sqlite)).toThrow(/przerywam/);
    expect(kody()).toHaveLength(MAKS_USUNIEC_AUTO + 1);
  });
});
