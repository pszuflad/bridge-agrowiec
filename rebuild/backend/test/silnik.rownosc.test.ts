/**
 * RÓWNOŚĆ WARTOŚCI W SILNIKU — CAPS/`Xq` (Iteracja 13, karta 13b).
 *
 * Produkcja zmieniła 2026-09-01 helper równości `Xq()` tak, żeby porównywał dodatkowo
 * bez względu na wielkość liter (backlog #59, część silnikowa). Ten plik pilnuje DWÓCH
 * rzeczy naraz, i ta druga jest ważniejsza:
 *
 *   1. Helper `wartosciRowne()` faktycznie jest case-insensitive — i zachowuje przy tym
 *      całą swoją poprzednią, niesymetryczną obsługę wartości pustych.
 *   2. ⚠ Zmiana NIE sięga klasyfikacji `zmiana_kluczowa`. CHANGELOG oryginału twierdzi, że
 *      po niej „Kleber GRIPKER" vs „KLEBER GRIPKER" przestaje generować `staging_items` —
 *      ale kod produkcji tego nie robi: klasyfikacja liczy się osobno, literalnym
 *      `String(…) !== String(…)`, i diff 08.09 tego fragmentu nie tknął. Odtwarzamy KOD,
 *      nie narrację (decyzja D1 ticketa 43). Szum case-only usuwa dopiero migracja danych
 *      `UPPER(nazwa)` — u nas karta 13c.
 *
 * Punkt 2 jest tu asercją POZYTYWNĄ, a nie komentarzem, celowo: gdyby ktoś „naprawił"
 * klasyfikację, żeby zgadzała się z CHANGELOG-iem, ten test zapali i pokaże, że to
 * świadome odstępstwo od produkcji, a nie drobiazg.
 */
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Baza } from "../src/db/index.js";
import { products, stagingItems } from "../src/db/schema.js";
import { silnikStagingu } from "../src/import/tk.js";
import { wartosciRowne } from "../src/import/silnik/pozycja.js";
import type { RekordSurowy } from "../src/import/typy.js";
import { stworzTestowaBaze, type TestowaBaza } from "./gate/baza.js";

const DOSTAWCA = "MO5";
const EAN = "5901234123457";

const OPONA = {
  nazwa: "Opona 480/70R28 BKT AGRIMAX RT 765",
  rozmiar: "480/70R28",
  marka: "BKT",
  model: "AGRIMAX RT 765",
  kategoria: "Opony rolnicze",
  ean: EAN,
};

function zasiejProdukt(db: Baza, pola: Record<string, unknown>): number {
  const wiersz = {
    kod: "P1",
    ...OPONA,
    dostawca: DOSTAWCA,
    magazyn: "PL",
    stan: 4,
    cenaZakupu: 1000,
    cenaSprzedazy: 1300,
    marzaPct: 30,
    vat: 23,
    status: "aktywny",
    eanIsValid: 1,
    nieobecnoscPodRzad: 0,
    dataAktualizacji: "2026-01-01T00:00:00.000Z",
    ...pola,
  };
  db.insert(products)
    .values(wiersz as unknown as typeof products.$inferInsert)
    .run();
  return (
    db.select().from(products).where(eq(products.kod, String(wiersz.kod))).get() as { id: number }
  ).id;
}

const rekord = (pola: Record<string, unknown>): RekordSurowy =>
  ({
    kod: "P1",
    ...OPONA,
    stan: 4,
    magazyn: "PL",
    cenaZakupu: 1000,
    ...pola,
  }) as unknown as RekordSurowy;

describe("1. wartosciRowne() — port `Xq()` po zmianie CAPS", () => {
  it("różnica tylko w wielkości liter to RÓWNOŚĆ", () => {
    expect(wartosciRowne("Kleber GRIPKER", "KLEBER GRIPKER")).toBe(true);
    expect(wartosciRowne("Michelin", "MICHELIN")).toBe(true);
    expect(wartosciRowne("PL", "pl")).toBe(true);
  });

  it("realna różnica treści dalej jest różnicą", () => {
    expect(wartosciRowne("KLEBER GRIPKER", "KLEBER GRIPKER 2")).toBe(false);
    expect(wartosciRowne("BKT", "CEAT")).toBe(false);
  });

  it("obsługa wartości pustych została NIETKNIĘTA — w tym jej niesymetryczność", () => {
    // Dwie puste są równe, niezależnie od tego, czy to null, undefined czy "".
    expect(wartosciRowne(null, "")).toBe(true);
    expect(wartosciRowne(undefined, null)).toBe(true);
    expect(wartosciRowne("", "")).toBe(true);
    // Pusta kontra niepusta jest różnicą — w OBIE strony.
    expect(wartosciRowne("", "BKT")).toBe(false);
    expect(wartosciRowne("BKT", "")).toBe(false);
    expect(wartosciRowne(null, "BKT")).toBe(false);
    expect(wartosciRowne("BKT", null)).toBe(false);
  });

  it("porównanie dalej idzie przez String(), więc zera po przecinku mają znaczenie", () => {
    expect(wartosciRowne(6.5, "6.5")).toBe(true);
    expect(wartosciRowne(6.5, "6.50")).toBe(false);
    expect(wartosciRowne(0, "0")).toBe(true);
  });

  it("wielkość liter nie psuje porównań liczbowych", () => {
    // Liczby nie mają wersji „wielkimi literami", więc toUpperCase() jest tu bez efektu —
    // a to właśnie na liczbach helper pracuje najczęściej (cena, stan, marża).
    expect(wartosciRowne(1000, 1000)).toBe(true);
    expect(wartosciRowne(1000, 1234.5)).toBe(false);
  });
});

describe("2. Zasięg zmiany w silniku — co CAPS ucisza, a czego NIE", () => {
  let baza: TestowaBaza;
  let uruchom: ReturnType<typeof silnikStagingu>;

  beforeEach(() => {
    baza = stworzTestowaBaze();
    uruchom = silnikStagingu(baza.db);
  });
  afterEach(() => baza.posprzataj());

  const staging = () => baza.db.select().from(stagingItems).all();

  it("⚠ różnica case-only w polu KLUCZOWYM dalej daje `zmiana_kluczowa` (D1)", () => {
    zasiejProdukt(baza.db, { marka: "Kleber GRIPKER" });

    const statystyki = uruchom(DOSTAWCA, [rekord({ marka: "KLEBER GRIPKER" })]);

    // To jest zachowanie PRODUKCJI, nie przeoczenie: klasyfikacja nie woła `wartosciRowne`.
    expect(statystyki.bezZmian).toBe(0);
    expect(statystyki.zmienione).toBe(1);
    expect(staging()).toHaveLength(1);
    expect(staging()[0]!.typZmiany).toBe("zmiana_kluczowa");
  });

  it("…ale znika już z narracji `powod` — i to jest cały efekt CAPS", () => {
    // Pozycja różni się case-only na `marka` (pole kluczowe, więc wiersz stagingu powstanie)
    // ORAZ realnie na `model` — dzięki temu mamy pewność, że `powod` w ogóle jest budowany,
    // a jego milczenie o marce to skutek CAPS, nie pustej pętli.
    zasiejProdukt(baza.db, { marka: "Kleber GRIPKER", model: "AGRIMAX RT 765" });

    uruchom(DOSTAWCA, [rekord({ marka: "KLEBER GRIPKER", model: "AGRIMAX RT 855" })]);

    const powod = staging()[0]!.powod ?? "";
    expect(powod, "różnica realna musi być w narracji").toContain("AGRIMAX RT 855");
    expect(powod, "różnica case-only NIE może być w narracji").not.toContain("KLEBER");
  });

  it("bez CAPS-a ten sam przypadek trafiałby też do auto-patcha pól cenowo-magazynowych", () => {
    // `magazyn` jest auto-patchowany przez `wartosciRowne`, a nie klasyfikowany jako kluczowy.
    // Różnica wyłącznie w wielkości liter nie jest więc żadną zmianą: import kończy się
    // „bez zmian", katalog zostaje z oryginalnym zapisem.
    const id = zasiejProdukt(baza.db, { magazyn: "PL" });

    const statystyki = uruchom(DOSTAWCA, [rekord({ magazyn: "pl" })]);

    expect(statystyki.bezZmian).toBe(1);
    expect(statystyki.autoZatwierdzone).toBe(0);
    expect(staging()).toHaveLength(0);
    const produkt = baza.db.select().from(products).where(eq(products.id, id)).get()!;
    expect(produkt.magazyn).toBe("PL");
  });
});
