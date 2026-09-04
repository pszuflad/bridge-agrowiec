/**
 * Liczenie kafli Pulpitu i dobór alertów — jednostkowo, bez DOM-u (blok 10f).
 *
 * Tu siedzą progi, których nie widać w widoku: „w tym tygodniu" to siedem DÓB (nie tydzień
 * kalendarzowy), „dzisiaj" to ta sama DATA lokalna (nie 24 godziny wstecz), a sortowanie
 * alertów jest dwustopniowe. Każdy z nich jest portem i każdy łatwo zepsuć „porządkując" kod.
 */
import { describe, expect, it } from "vitest";

import type { Alert } from "@/pages/alerty/api";
import type { DostawcaPulpitu, WpisDziennikaZmian } from "@/pages/pulpit/api";
import { sformatujWzglednie } from "@/pages/pulpit/czas";
import {
  aktywneAlerty,
  czyDzisiaj,
  czyWTymTygodniu,
  najswiezszeAlerty,
  sortujDostawcowPoKodzie,
  znajdzPoTypie,
} from "@/pages/pulpit/kpi";

/**
 * ⚠ CZAS BUDUJEMY LOKALNIE, NIE Z NAPISU ISO Z „Z". `czyDzisiaj` i `sformatujWzglednie`
 * porównują DATĘ LOKALNĄ (`toDateString()`), więc test oparty na UTC dawałby różny wynik
 * w zależności od strefy maszyny — w Europie/Warsaw „2026-09-03T23:00Z" to już 4 września.
 * Konstruktor `new Date(rok, miesiąc, dzień, …)` jest lokalny i znosi tę zależność.
 */
const TERAZ = new Date(2026, 8, 4, 12, 0, 0);

/** Znacznik ISO przesunięty względem `TERAZ` o zadaną liczbę dni i godzin. */
function chwila(dni: number, godziny = 0, minuty = 0): string {
  const d = new Date(TERAZ);
  d.setDate(d.getDate() - dni);
  d.setHours(d.getHours() - godziny, d.getMinutes() - minuty, 0, 0);
  return d.toISOString();
}

/** Konkretna godzina konkretnego dnia, w czasie lokalnym. */
function oGodzinie(dzien: number, godzina: number, minuta = 0): string {
  return new Date(2026, 8, dzien, godzina, minuta, 0).toISOString();
}

function alert(czesc: Partial<Alert>): Alert {
  return {
    id: 1,
    poziom: "info",
    typ: "Synchronizacja",
    opis: "…",
    dostawca: "MO1",
    status: "nowy",
    data: "2026-09-01T10:00:00.000Z",
    ...czesc,
  };
}

describe("czyDzisiaj — port j2 (:16762)", () => {
  it("liczy po DACIE lokalnej, nie po dobie wstecz", () => {
    expect(czyDzisiaj(oGodzinie(4, 0, 30), TERAZ)).toBe(true);
    expect(czyDzisiaj(oGodzinie(4, 23, 59), TERAZ)).toBe(true);
    // Trzynaście godzin wstecz, ale to już poprzedni dzień — `false`.
    expect(czyDzisiaj(oGodzinie(3, 23, 0), TERAZ)).toBe(false);
  });

  it("pusta i niepoprawna wartość dają false, nie wyjątek", () => {
    expect(czyDzisiaj(null, TERAZ)).toBe(false);
    expect(czyDzisiaj(undefined, TERAZ)).toBe(false);
    expect(czyDzisiaj("nie-data", TERAZ)).toBe(false);
  });
});

describe("czyWTymTygodniu — port b2 (:16769)", () => {
  it("to siedem DÓB wstecz, nie tydzień kalendarzowy", () => {
    expect(czyWTymTygodniu(chwila(0, 3), TERAZ)).toBe(true);
    expect(czyWTymTygodniu(chwila(6), TERAZ)).toBe(true);
    expect(czyWTymTygodniu(chwila(7), TERAZ)).toBe(false); // siódma doba — już poza
  });

  it("data z przyszłości odpada (warunek n >= 0 oryginału)", () => {
    expect(czyWTymTygodniu(chwila(-2), TERAZ)).toBe(false);
  });
});

describe("aktywneAlerty i najswiezszeAlerty — port :16852-16856", () => {
  it("aktywne to wyłącznie status `nowy`", () => {
    const wynik = aktywneAlerty([
      alert({ id: 1, status: "nowy" }),
      alert({ id: 2, status: "rozwiazany" }),
    ]);
    expect(wynik.map((a) => a.id)).toEqual([1]);
  });

  it("null i undefined dają pustą listę", () => {
    expect(aktywneAlerty(null)).toEqual([]);
    expect(aktywneAlerty(undefined)).toEqual([]);
  });

  it("odsiewa poziom `info` — karta pokazuje tylko krytyczne i ostrzeżenia", () => {
    const wynik = najswiezszeAlerty([
      alert({ id: 1, poziom: "info" }),
      alert({ id: 2, poziom: "ostrzezenie" }),
    ]);
    expect(wynik.map((a) => a.id)).toEqual([2]);
  });

  it("sortuje NAJPIERW po poziomie, dopiero potem po dacie malejąco", () => {
    const wynik = najswiezszeAlerty([
      alert({ id: 1, poziom: "ostrzezenie", data: "2026-09-03T10:00:00.000Z" }),
      alert({ id: 2, poziom: "krytyczny", data: "2026-08-01T10:00:00.000Z" }),
      alert({ id: 3, poziom: "ostrzezenie", data: "2026-09-04T10:00:00.000Z" }),
    ]);
    // Krytyczny jest najstarszy, a i tak stoi pierwszy — poziom bije datę.
    expect(wynik.map((a) => a.id)).toEqual([2, 3, 1]);
  });

  it("tnie do pięciu pozycji", () => {
    const wynik = najswiezszeAlerty(
      Array.from({ length: 12 }, (_, i) => alert({ id: i + 1, poziom: "ostrzezenie" })),
    );
    expect(wynik).toHaveLength(5);
  });

  it("nie mutuje listy wejściowej (sort na kopii)", () => {
    const wejscie = [
      alert({ id: 1, poziom: "ostrzezenie" }),
      alert({ id: 2, poziom: "krytyczny" }),
    ];
    najswiezszeAlerty(wejscie);
    expect(wejscie.map((a) => a.id)).toEqual([1, 2]);
  });
});

describe("sortujDostawcowPoKodzie — port :17038", () => {
  function dostawca(kod: string): DostawcaPulpitu {
    return {
      id: 0,
      kod,
      nazwa: kod,
      email: null,
      formatPliku: null,
      ostatniPlik: null,
      ostatniaAktualizacjaCeny: null,
      ostatniaAktualizacjaStanu: null,
      liczbaProduktow: 0,
      status: "aktywny",
    };
  }

  it("sortuje po LICZBIE w kodzie, więc MO10 idzie po MO9", () => {
    const wynik = sortujDostawcowPoKodzie([
      dostawca("MO10"),
      dostawca("MO2"),
      dostawca("MO9"),
      dostawca("MO1"),
    ]);
    expect(wynik.map((d) => d.kod)).toEqual(["MO1", "MO2", "MO9", "MO10"]);
  });

  it("kod bez cyfr trafia na początek jako 0, zamiast wywalać sortowanie", () => {
    const wynik = sortujDostawcowPoKodzie([dostawca("MO3"), dostawca("XX")]);
    expect(wynik.map((d) => d.kod)).toEqual(["XX", "MO3"]);
  });
});

/**
 * Zamrożenie decyzji D3 — kafel „Ostatni eksport CSV" jest trwale martwy.
 *
 * Wiersze bierzemy tak, jak wyglądają w nagraniu `GET_history.json`: bez pola `typ`.
 * Gdyby `/api/history` kiedyś zaczęło je zwracać, ten test zapali i wymusi decyzję,
 * zamiast po cichu ożywić kafel.
 */
describe("znajdzPoTypie — kafel „Ostatni eksport CSV” (decyzja D3)", () => {
  const WPISY: WpisDziennikaZmian[] = [
    {
      id: 46915,
      data: "2026-07-28T06:22:26.735Z",
      kodProduktu: "MO2_1147700",
      nazwa: "15x6.00-6 TRELLEBORG T510 6PR TT",
      pole: "kategoria",
      staraWartosc: "Rolnicze małe",
      nowaWartosc: "Rolnicze",
      zrodlo: "recznie",
      kto: "Anna",
      wykonalUzytkownikId: 1,
    },
  ];

  it("wiersz `/api/history` NIE MA pola `typ` — to źródło usterki", () => {
    expect(Object.keys(WPISY[0]!)).not.toContain("typ");
  });

  it("nie znajduje ani eksportu, ani importu — kafel zostaje pusty", () => {
    expect(znajdzPoTypie(WPISY, "eksport")).toBeNull();
    expect(znajdzPoTypie(WPISY, "import")).toBeNull();
  });

  it("pusta odpowiedź stagingu (`[]`) też daje null, a nie błąd", () => {
    expect(znajdzPoTypie([], "eksport")).toBeNull();
    expect(znajdzPoTypie(null, "eksport")).toBeNull();
    expect(znajdzPoTypie(undefined, "eksport")).toBeNull();
  });
});

describe("sformatujWzglednie — port Bu() (:16747)", () => {
  it("sześć progów oryginału", () => {
    expect(sformatujWzglednie(chwila(0, 0, 0), TERAZ)).toBe("przed chwilą");
    expect(sformatujWzglednie(chwila(0, 0, 30), TERAZ)).toBe("30 min temu");
    expect(sformatujWzglednie(oGodzinie(4, 6), TERAZ)).toMatch(/^dzisiaj, /);
    expect(sformatujWzglednie(oGodzinie(3, 6), TERAZ)).toMatch(/^wczoraj, /);
    expect(sformatujWzglednie(chwila(3), TERAZ)).toBe("3 dni temu");
    // Ponad tydzień → zwykła data `pl-PL`, bez słowa „temu".
    expect(sformatujWzglednie(chwila(60), TERAZ)).not.toContain("temu");
  });

  it("niepoprawna wartość wraca bez zmian, zamiast dawać „Invalid Date”", () => {
    expect(sformatujWzglednie("nie-data", TERAZ)).toBe("nie-data");
  });
});
