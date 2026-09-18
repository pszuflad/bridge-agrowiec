/**
 * `dolaczReguly()` — jednostkowo, karta 14h (ticket 61).
 *
 * Bramka `katalog.gate.test.ts` sprawdza odstępstwo end-to-end przez trasę. Tutaj pilnujemy
 * samej reguły wypełniania: co wygrywa, co jest pomijane i skąd bierze się `wartosc`.
 *
 * ⚠ Testy CELOWO NIE powtarzają przypadków dopasowania z `test/ceny.silnik.test.ts`.
 * `dolaczReguly` nie ma własnego dopasowania — deleguje do `wybierzPromocje` z `repos/ceny.ts`
 * i to jest cała sedno karty. Sprawdzamy więc, że delegacja DZIAŁA i że mapowanie na kształt
 * czytany przez katalog jest poprawne, a nie że silnik umie dopasowywać.
 */
import { describe, expect, it } from "vitest";

import { dolaczReguly, type Produkt } from "../src/repos/products.js";
import type { Promocja } from "../src/repos/ceny.js";

/** Pierwszy element z asercją — `noUncheckedIndexedAccess` inaczej wymusza `!` w każdym teście. */
function pierwszy<T>(tablica: T[]): T {
  const element = tablica[0];
  if (element === undefined) throw new Error("oczekiwano co najmniej jednego elementu");
  return element;
}

function produkt(pola: Partial<Produkt> = {}): Produkt {
  return { id: 1, kod: "MO9_1", marka: "BKT", kategoria: "Rolnicze", ...pola } as Produkt;
}

function promocja(pola: Partial<Promocja> = {}): Promocja {
  return {
    id: 1,
    nazwa: "Wyprzedaż zimowa",
    rabatPct: 10,
    zasieg: "BKT,MICHELIN",
    warunki: null,
    priorytet: 50,
    start: "2026-01-01",
    koniec: "2026-03-31",
    status: "aktywna",
    zmienilUzytkownikId: 1,
    zmienionoData: "2026-07-31T13:07:21.578Z",
    ...pola,
  } as Promocja;
}

describe("dolaczReguly — reguła wypełniania kolumny Promocja", () => {
  it("dokłada `_reguly.promocja` produktowi w zasięgu promocji", () => {
    const wynik = pierwszy(dolaczReguly([produkt()], [promocja()]));

    expect(wynik._reguly).toEqual({
      promocja: { wartosc: 10, nazwa: "Wyprzedaż zimowa" },
    });
  });

  /**
   * `wartosc` bierze się z kolumny `rabat_pct`, bo tej nazwy oczekuje renderer katalogu
   * (żywy bundle produkcji: `const rabat = p.wartosc`). To jedyne mapowanie nazwy w tej karcie
   * i najłatwiejsze miejsce na cichy regres — stąd osobny test.
   */
  it("`wartosc` to `rabatPct` promocji, nie żadne inne pole", () => {
    const wynik = pierwszy(dolaczReguly([produkt()], [promocja({ rabatPct: 37.5 })]));

    expect(wynik._reguly?.promocja.wartosc).toBe(37.5);
  });

  /** Brak dopasowania = BRAK klucza. To on trzyma odstępstwo wąskim (72 klucze zostają 72). */
  it("produktowi spoza zasięgu NIE dokłada klucza `_reguly`", () => {
    const wynik = pierwszy(dolaczReguly([produkt({ marka: "MITAS" })], [promocja()]));

    expect(wynik).not.toHaveProperty("_reguly");
  });

  it("pusta lista promocji nie dokłada niczego i oddaje te same obiekty", () => {
    const wejscie = [produkt()];
    const wynik = dolaczReguly(wejscie, []);

    expect(wynik[0]).not.toHaveProperty("_reguly");
    expect(wynik[0], "brak promocji nie ma powodu kopiować 7400 obiektów").toBe(wejscie[0]);
  });

  /** Promocja nieaktywna nie może zaświecić kolumny — filtr siedzi w `promocjaPasuje`. */
  it("pomija promocję o statusie innym niż `aktywna`", () => {
    const wynik = pierwszy(dolaczReguly([produkt()], [promocja({ status: "zakonczona" })]));

    expect(wynik).not.toHaveProperty("_reguly");
  });

  /**
   * Delegacja do `wybierzPromocje` ma dawać JEJ rozstrzygnięcie sporu, nie nasze:
   * przy promocjach wygrywa wprost wyższy `priorytet` (inaczej niż przy narzutach).
   */
  it("przy dwóch pasujących promocjach wygrywa ta o wyższym priorytecie", () => {
    const wynik = dolaczReguly(
      [produkt()],
      [
        promocja({ id: 1, nazwa: "Słabsza", rabatPct: 5, priorytet: 10 }),
        promocja({ id: 2, nazwa: "Mocniejsza", rabatPct: 20, priorytet: 90 }),
      ],
    );

    expect(pierwszy(wynik)._reguly?.promocja).toEqual({ wartosc: 20, nazwa: "Mocniejsza" });
  });

  /** Produkt niedopasowany nie może „złapać" promocji sąsiada z tej samej listy. */
  it("rozdziela produkty poprawnie — jedna lista, mieszany wynik", () => {
    const wynik = dolaczReguly(
      [produkt({ id: 1, marka: "BKT" }), produkt({ id: 2, marka: "MITAS" })],
      [promocja()],
    );

    expect(pierwszy(wynik)._reguly?.promocja.nazwa).toBe("Wyprzedaż zimowa");
    expect(wynik[1]!).not.toHaveProperty("_reguly");
  });

  /**
   * ⚠ ZACHOWANIE ODZIEDZICZONE PO ORYGINALE, NIE NASZA DECYZJA — utrwalone, żeby ewentualna
   * zmiana była widoczna. `promocjaPasuje` robi `zasieg.includes(tekst(produkt.marka))`,
   * a KAŻDY napis zawiera pusty napis — więc produkt z pustą marką ORAZ pustą kategorią łapie
   * KAŻDĄ promocję o niepustym zasięgu. (`marka` i `kategoria` są w schemacie `NOT NULL`,
   * więc osiągalny jest wariant z pustym napisem, nie z NULL-em.)
   *
   * Defekt produkcji, który karta 14h wyłącznie UWIDACZNIA — dotąd nie było go jak zobaczyć,
   * bo kolumna była martwa, a na cenę wpływał tak samo, tylko po cichu. Naprawa należy do
   * silnika cen (`repos/ceny.ts`), czyli poza zakres tej karty → follow-up w raporcie.
   */
  it("produkt z pustą marką i kategorią łapie każdą promocję — defekt oryginału, utrwalony", () => {
    const wynik = dolaczReguly([produkt({ marka: "", kategoria: "" })], [promocja()])[0]!;

    expect(wynik._reguly?.promocja.nazwa).toBe("Wyprzedaż zimowa");
  });
});
