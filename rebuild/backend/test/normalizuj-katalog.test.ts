// Ticket 178 — czyszczenie katalogu (Etap 3c): ta sama logika co import, poprawki ręczne chronione.
import { afterEach, describe, expect, it } from "vitest";

import {
  raportNormalizacjiCsv,
  zaplanujNormalizacje,
  zastosujNormalizacje,
} from "../src/import/migracje/normalizuj-katalog.js";
import { stworzTestowaBaze, type TestowaBaza } from "./gate/baza.js";

let baza: TestowaBaza | null = null;
afterEach(() => {
  baza?.posprzataj();
  baza = null;
});

function karta(b: TestowaBaza, kod: string, extra: Record<string, unknown>): void {
  const w: Record<string, unknown> = {
    kod,
    nazwa: "n",
    marka: "CONTINENTAL",
    kategoria: "Opony",
    dostawca: "MO4",
    magazyn: "PL",
    stan: 1,
    cena_zakupu: 1,
    cena_sprzedazy: 1,
    marza_pct: 1,
    data_aktualizacji: "2026-09-01",
    ...extra,
  };
  const kol = Object.keys(w);
  b.sqlite.prepare(`INSERT INTO products (${kol.join(",")}) VALUES (${kol.map(() => "?").join(",")})`).run(...Object.values(w));
}

describe("normalizuj-katalog", () => {
  it("dry-run raportuje, apply zapisuje; poprawka ręczna chroni pole; nazwa nietknięta", () => {
    baza = stworzTestowaBaze();
    karta(baza, "MO4_A", {
      nazwa: "315/70R22.5 CONTINENTAL CONTI ECO HS5 156/150L",
      model: "CONTI ECO 5 NAPĘD",
      dot: "4822",
      konstrukcja: "R",
    });
    karta(baza, "MO4_B", { model: "MG121 PROWADZĄCA", dot: "24" });
    baza.sqlite
      .prepare(
        "INSERT INTO manual_overrides (supplier_kod, supplier_product_id, field_name, override_value, created_at) VALUES ('MO4','MO4_B','model','MG-121','2026-01-01')",
      )
      .run();

    const plan = zaplanujNormalizacje(baza.sqlite);
    expect(plan.find((z) => z.kod === "MO4_A" && z.pole === "model")).toMatchObject({
      po: "CONTI ECO HS5",
      status: "zmiana",
    });
    expect(plan.find((z) => z.kod === "MO4_B" && z.pole === "model")?.status).toBe("pominieta_poprawka_reczna");
    expect(raportNormalizacjiCsv(plan)).toContain("MO4_A,MO4,model");
    expect(baza.sqlite.prepare("SELECT model FROM products WHERE kod='MO4_A'").get()).toEqual({
      model: "CONTI ECO 5 NAPĘD",
    });

    expect(zastosujNormalizacje(baza.sqlite)).toBe(4);
    expect(baza.sqlite.prepare("SELECT nazwa, model, dot, konstrukcja FROM products WHERE kod='MO4_A'").get()).toEqual({
      nazwa: "315/70R22.5 CONTINENTAL CONTI ECO HS5 156/150L",
      model: "CONTI ECO HS5",
      dot: "2022",
      konstrukcja: "Radialna",
    });
    // pole chronione zostaje, DOT tej samej karty się normalizuje
    expect(baza.sqlite.prepare("SELECT model, dot FROM products WHERE kod='MO4_B'").get()).toEqual({
      model: "MG121 PROWADZĄCA",
      dot: "2024",
    });
    // drugi bieg: nic do zrobienia
    expect(zaplanujNormalizacje(baza.sqlite).filter((z) => z.status === "zmiana")).toEqual([]);
  });
});

describe("normalizuj-katalog — DA (wada kosmetyczna) tylko w nazwie", () => {
  it("zdejmuje DA z modelu i bieżnika, nazwa nietknięta, poprawka ręczna chroni pole", () => {
    baza = stworzTestowaBaze();
    const nazwa = "520/85R42 OZKA AGROLOX DA 157A8/157B TL";
    karta(baza, "MO5_A", { dostawca: "MO5", marka: "OZKA", nazwa, model: "AGROLOX DA", bieznik: "AGROLOX DA" });
    karta(baza, "MO5_B", { dostawca: "MO5", marka: "OZKA", nazwa, model: "AGROLOX DA", bieznik: "AGROLOX DA" });
    baza.sqlite
      .prepare(
        "INSERT INTO manual_overrides (supplier_kod, supplier_product_id, field_name, override_value, created_at) VALUES ('MO5','MO5_B','model','AGROLOX DA','2026-01-01')",
      )
      .run();

    zastosujNormalizacje(baza.sqlite);

    const q = (kod: string) =>
      baza!.sqlite.prepare("SELECT nazwa, model, bieznik FROM products WHERE kod=?").get(kod);
    expect(q("MO5_A")).toEqual({ nazwa, model: "AGROLOX", bieznik: "AGROLOX" });
    // Poprawka Marty wygrywa: model chroniony zostaje, bieżnik (bez poprawki) się czyści.
    expect(q("MO5_B")).toEqual({ nazwa, model: "AGROLOX DA", bieznik: "AGROLOX" });
    // Idempotentnie: drugi przebieg niczego nie zmienia.
    expect(zastosujNormalizacje(baza.sqlite)).toBe(0);
  });
});
