/**
 * Silnik pseudo-alertów katalogowych — port `v2()`/`pv()` z `origin/main` (karta P6.2).
 *
 * Każda reguła osobno, z progami na krawędziach. Pełną zgodność z oryginałem sprawdzono
 * dodatkowo porównaniem na całym `db/snapshot.db` (7405 produktów, wynik identyczny co do bajtu
 * z `pv()` wyciętym z bundla) — opis w `docs/tickets/77-FEATURE-pseudo-alerty-katalogowe/raport.md`.
 * Te testy pilnują krawędzi, których snapshot nie pokrywa (np. marża ujemna: 0 przypadków).
 */
import { describe, expect, it } from "vitest";

import {
  SLOWA_NIE_OPONA,
  klasyfikujOpone,
  policzAlertyKatalogu,
  type ProduktDoAlertow,
} from "@/pages/alerty/silnik-katalogu";

const TERAZ = Date.parse("2026-09-21T12:00:00.000Z");
const DOBA = 86_400_000;
const BEZ_STATUSOW = new Map<string, string>();

/** Opona, która nie łapie się na żadną regułę produktową: marża 25%, świeża data. */
function opona(nadpisz: Partial<ProduktDoAlertow> = {}): ProduktDoAlertow {
  return {
    id: 1,
    kod: "K1",
    nazwa: "420/85R34 BKT AGRIMAX RT855 147A8 TL",
    kategoria: "Rolnicze",
    dostawca: "MO9",
    marzaPct: 25,
    cenaZakupu: 1000,
    cenaSprzedazy: 1250,
    dataAktualizacji: new Date(TERAZ - DOBA).toISOString(),
    ...nadpisz,
  };
}

const policz = (produkty: ProduktDoAlertow[], statusy = BEZ_STATUSOW) =>
  policzAlertyKatalogu(produkty, statusy, TERAZ);

describe("reguła 1 — Marża ujemna (marzaPct < 0, krytyczny)", () => {
  it("−2.46 → krytyczny, id z odciskiem zaokrąglonym do 0.1, opis z cenami", () => {
    const [alert] = policz([opona({ id: 7, marzaPct: -2.46, cenaZakupu: 100, cenaSprzedazy: 97.54 })]);
    expect(alert).toMatchObject({
      id: "7-marza-ujemna--2.5",
      productId: 7,
      poziom: "krytyczny",
      typ: "Marża ujemna — sprzedaż pod kosztem",
      opis: "K1 · 420/85R34 BKT AGRIMAX RT855 147A8 TL (marża -2.5%, zakup 100.00 zł, sprzedaż 97.54 zł)",
      dostawca: "MO9",
      status: "nowy",
    });
  });

  it("−0.01 wpada w regułę ujemną; dokładnie 0 już NIE (idzie do „niskiej”)", () => {
    expect(policz([opona({ marzaPct: -0.01 })]).map((a) => a.typ)).toEqual([
      "Marża ujemna — sprzedaż pod kosztem",
    ]);
    const [zero] = policz([opona({ marzaPct: 0 })]);
    expect(zero).toMatchObject({ id: "1-marza-niska-0", typ: "Bardzo niska marża", poziom: "ostrzezenie" });
  });

  it("brak ceny zakupu daje w opisie dosłowne „undefined” — jak `x?.toFixed(2)` oryginału", () => {
    const [alert] = policz([opona({ marzaPct: -1, cenaZakupu: null })]);
    expect(alert!.opis).toContain("zakup undefined zł");
  });
});

describe("reguła 2 — Bardzo niska marża (marzaPct < 5, ostrzeżenie)", () => {
  it("4.99 → ostrzeżenie z odciskiem 5 (zaokrąglenie do 0.1)", () => {
    const [alert] = policz([opona({ marzaPct: 4.99 })]);
    expect(alert).toMatchObject({
      id: "1-marza-niska-5",
      poziom: "ostrzezenie",
      opis: "K1 · 420/85R34 BKT AGRIMAX RT855 147A8 TL (marża 5.0%)",
    });
  });

  it("dokładnie 5 → brak alertu", () => {
    expect(policz([opona({ marzaPct: 5 })])).toEqual([]);
  });

  it("marża nie-liczbowa (null, napis) → brak alertu marżowego", () => {
    expect(policz([opona({ marzaPct: null })])).toEqual([]);
    expect(policz([opona({ marzaPct: "3" })])).toEqual([]);
  });

  it("nazwa ucięta do 60 znaków, brak kodu → „-”", () => {
    const nazwa = "OPONA ".repeat(20);
    const [alert] = policz([opona({ kod: null, nazwa, marzaPct: 1 })]);
    expect(alert!.opis).toBe(`- · ${nazwa.slice(0, 60)} (marża 1.0%)`);
  });
});

describe("reguła 3 — Nie-opona w katalogu (v2: !isTire && confidence wysoka, krytyczny)", () => {
  it("dętka → krytyczny, id z odciskiem `nazwa|kategoria`", () => {
    const [alert] = policz([opona({ id: 3, nazwa: "DĘTKA 18.4-38 TR-218A", kategoria: "Dętki" })]);
    expect(alert).toMatchObject({
      id: "3-nie-opona-DĘTKA 18.4-38 TR-218A|Dętki",
      poziom: "krytyczny",
      typ: "Nie-opona w katalogu — błąd parsera",
      opis: "K1 · DĘTKA 18.4-38 TR-218A (wykryto dętka (możliwe zepsute kodowanie))",
    });
  });

  it("słowo z listy h2 → powód z nazwą słowa", () => {
    const [alert] = policz([opona({ nazwa: "FELGA 13x28", kategoria: "Akcesoria" })]);
    expect(alert!.opis).toContain('(wykryto "felga" w nazwie/kategorii)');
  });

  it("brak kategorii → odcisk z pustym członem po `|`", () => {
    const [alert] = policz([opona({ id: 4, nazwa: "WENTYL", kategoria: null })]);
    expect(alert!.id).toBe("4-nie-opona-WENTYL|");
  });

  it("łatka tr_fix: BKT z TR-135 NIE jest „nie-oponą”", () => {
    const nazwa = "18.4-38 BKT TR-135 146A8 TT";
    expect(klasyfikujOpone(nazwa, "Rolnicze")).toMatchObject({ isTire: true });
    expect(policz([opona({ nazwa })])).toEqual([]);
    // Dowód, że test ma zęby: słowo „tr-” sprzed łatki złapałoby tę nazwę.
    expect(SLOWA_NIE_OPONA).not.toContain("tr-");
    expect(/\btr-\b/i.test(nazwa.toLowerCase())).toBe(true);
  });

  it("niska pewność (brak słów i rozmiaru) → NIE alarmuje", () => {
    expect(klasyfikujOpone("PRODUKT XYZ", null)).toEqual({
      isTire: false,
      reason: "brak słów kluczowych i rozmiaru opony",
      confidence: "niska",
    });
    expect(policz([opona({ nazwa: "PRODUKT XYZ", kategoria: null })])).toEqual([]);
  });

  it("kolejność gałęzi v2: słowo+rozmiar / słowo / rozmiar / kategoria", () => {
    expect(klasyfikujOpone("Opona 420/85R34", null).reason).toBe("słowo kluczowe + rozmiar opony");
    expect(klasyfikujOpone("Opona rolnicza", null).reason).toBe("słowo kluczowe opona/tire");
    expect(klasyfikujOpone("420/85R34 X", null).reason).toBe("rozmiar opony w nazwie");
    expect(klasyfikujOpone("AGRIMAX", "Opony rolnicze").reason).toBe("słowo kluczowe opona/tire");
    expect(klasyfikujOpone("AGRIMAX", "Tyres")).toMatchObject({ reason: "kategoria opon" });
  });

  it("marża niska ORAZ nie-opona u jednego produktu → dwa osobne alerty", () => {
    expect(policz([opona({ marzaPct: 2, nazwa: "DĘTKA", kategoria: "Dętki" })]).map((a) => a.typ).sort())
      .toEqual(["Bardzo niska marża", "Nie-opona w katalogu — błąd parsera"]);
  });
});

describe("reguła 4 — Brak importu cennika (dni od najnowszej dataAktualizacji dostawcy)", () => {
  const dniTemu = (dni: number) => new Date(TERAZ - dni * DOBA).toISOString();
  const importy = (dostawca: string, ...dni: number[]) =>
    dni.map((d, i) => opona({ id: 100 + i, dostawca, dataAktualizacji: dniTemu(d) }));

  it.each([
    [6.99, null],
    [7, "ostrzezenie"],
    [29.99, "ostrzezenie"],
    [30, "krytyczny"],
  ])("%s dni → %s", (dni, poziom) => {
    const alerty = policz(importy("MO1", dni));
    expect(alerty.map((a) => a.poziom)).toEqual(poziom ? [poziom] : []);
  });

  it("liczy od NAJNOWSZEGO produktu dostawcy; id, opis, productId −1, data importu", () => {
    const [alert] = policz(importy("MO3", 40, 12, 90));
    expect(alert).toEqual({
      id: "dostawca-MO3-brak-importu-12",
      productId: -1,
      poziom: "ostrzezenie",
      typ: "Brak importu cennika",
      opis: "Dostawca MO3: ostatni import 12 dni temu (próg ostrzeżenia: 7 dni)",
      dostawca: "MO3",
      data: dniTemu(12),
      status: "nowy",
    });
    expect(policz(importy("MO3", 31))[0]!.opis).toBe(
      "Dostawca MO3: ostatni import 31 dni temu (próg krytyczny: 30 dni)",
    );
  });

  it("MO7 i MO8 są wykluczeni (w2) — nawet przy 100 dniach", () => {
    expect(policz([...importy("MO7", 100), ...importy("MO8", 100)])).toEqual([]);
    expect(policz(importy("MO6", 100))).toHaveLength(1);
  });

  it("dostawca bez żadnej daty i produkt bez dostawcy — pomijani", () => {
    expect(policz([opona({ dostawca: "MO2", dataAktualizacji: null })])).toEqual([]);
    expect(policz([opona({ dostawca: null, dataAktualizacji: dniTemu(50) })])).toEqual([]);
  });
});

describe("statusy i odciski (łatka ackalerts pkt 1)", () => {
  it("zapisany status trafia do alertu; brak wpisu = „nowy”", () => {
    const statusy = new Map([["1-marza-niska-3", "przejrzany"]]);
    expect(policz([opona({ marzaPct: 3 })], statusy)[0]!.status).toBe("przejrzany");
    expect(policz([opona({ marzaPct: 3 })])[0]!.status).toBe("nowy");
  });

  it("zmiana marży → nowy id → alert wraca jako „nowy” mimo rozwiązania starego", () => {
    const statusy = new Map([["1-marza-niska-3", "rozwiazany"]]);
    const [po] = policz([opona({ marzaPct: 3.4 })], statusy);
    expect(po).toMatchObject({ id: "1-marza-niska-3.4", status: "nowy" });
  });

  it("zmiana nazwy produktu → nowy id alertu nie-opona", () => {
    const statusy = new Map([["1-nie-opona-DĘTKA|Dętki", "rozwiazany"]]);
    expect(policz([opona({ nazwa: "DĘTKA", kategoria: "Dętki" })], statusy)[0]!.status).toBe("rozwiazany");
    expect(policz([opona({ nazwa: "DĘTKA 2", kategoria: "Dętki" })], statusy)[0]!.status).toBe("nowy");
  });

  it("kolejny dzień bez importu → nowy id alertu dostawcy → „nowy”", () => {
    const produkty = [opona({ dostawca: "MO1", dataAktualizacji: new Date(TERAZ - 8 * DOBA).toISOString() })];
    const statusy = new Map([["dostawca-MO1-brak-importu-8", "przejrzany"]]);
    expect(policzAlertyKatalogu(produkty, statusy, TERAZ)[0]!.status).toBe("przejrzany");
    expect(policzAlertyKatalogu(produkty, statusy, TERAZ + DOBA)[0]).toMatchObject({
      id: "dostawca-MO1-brak-importu-9",
      status: "nowy",
    });
  });
});

describe("reguły wyłączone w oryginale (`if (false)`) i sortowanie", () => {
  it("stan 0 i rozmiar sklejony z nazwą NIE dają alertu", () => {
    const produkt = { ...opona({ nazwa: "BKT420/85R34AGRIMAX" }), stan: 0, status: "aktywny" };
    expect(policz([produkt]).map((a) => a.typ)).not.toContain("Brak stanu magazynowego");
    expect(policz([produkt]).map((a) => a.typ)).not.toContain("Znaki w rozmiarze sklejone z nazwą");
  });

  it("krytyczne przed ostrzeżeniami, w obrębie poziomu data malejąco", () => {
    const alerty = policz([
      opona({ id: 1, marzaPct: 1, dataAktualizacji: "2026-09-10T00:00:00.000Z" }),
      opona({ id: 2, marzaPct: 2, dataAktualizacji: "2026-09-20T00:00:00.000Z" }),
      opona({ id: 3, marzaPct: -1, dataAktualizacji: "2026-09-01T00:00:00.000Z" }),
    ]);
    expect(alerty.map((a) => a.productId)).toEqual([3, 2, 1]);
  });
});
