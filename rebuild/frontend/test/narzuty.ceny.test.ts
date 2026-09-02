/**
 * Silnik cen po stronie klienta (`src/pages/narzuty/ceny.ts`) — sesja 4b.
 *
 * CZEGO TEN PLIK PILNUJE. Klient liczy ceny drugi raz, obok backendu: symulator ma
 * TŁUMACZYĆ cenę, która realnie siedzi w katalogu, a kontrola „poniżej kosztu" — ostrzegać
 * przed skutkiem zapisu reguły dotykającej ~7 400 produktów. Dwie implementacje tej samej
 * formuły to dług, który spłaca się wyłącznie testem: każdy przypadek niżej ma bliźniaka
 * w `rebuild/backend/test/ceny.silnik.test.ts` i te same oczekiwane liczby.
 *
 * ⚠ Świadomie NIE portujemy `Mb()` z oryginału (plan.md D8) — rozjeżdża się z własnym
 * backendem przy regule z `warunki: "[]"`. Ostatni test w sekcji 3 pilnuje właśnie tego.
 */
import { describe, expect, it } from "vitest";

import type { Narzut, Promocja } from "@/pages/narzuty/api";
import {
  dopasujWarunek,
  narzutPasuje,
  policzCene,
  produktyPonizejKosztu,
  promocjaPasuje,
  wybierzNarzut,
  wybierzPromocje,
} from "@/pages/narzuty/ceny";

function narzut(pola: Partial<Narzut> = {}): Narzut {
  return {
    id: 1,
    typ: "globalny",
    zakres: "",
    warunki: null,
    nazwa: "Reguła",
    wartosc: 6,
    jednostka: "procent",
    priorytet: 50,
    status: "aktywny",
    zmienilUzytkownikId: 1,
    zmienionoData: "2026-01-01T00:00:00.000Z",
    ...pola,
  };
}

function promocja(pola: Partial<Promocja> = {}): Promocja {
  return {
    id: 1,
    nazwa: "Promocja",
    rabatPct: 10,
    zasieg: "BKT",
    warunki: null,
    priorytet: 50,
    start: "2026-01-01",
    koniec: "2026-12-31",
    status: "aktywna",
    zmienilUzytkownikId: 1,
    zmienionoData: "2026-01-01T00:00:00.000Z",
    ...pola,
  };
}

/** Zakup 1000, VAT 23, marka BKT, kategoria Rolnicze, dostawca MO5 — jak w teście backendu. */
const PRODUKT = {
  kod: "P1",
  nazwa: "Opona 480/70R28 BKT AGRIMAX RT 765",
  marka: "BKT",
  kategoria: "Rolnicze",
  dostawca: "MO5",
  cenaZakupu: 1000,
  vat: 23,
};

describe("1. Formuła ceny — te same liczby co backend", () => {
  it("floor(zakup × (1+narzut) × (1−rabat) × (1+vat)) — ucina w dół, nie zaokrągla", () => {
    // 1000 × 1,06 × 1,23 = 1303,8 → 1303. Zaokrąglenie dałoby 1304.
    expect(policzCene(PRODUKT, [narzut({ wartosc: 6 })], []).cenaSprzedazy).toBe(1303);
  });

  it("marzaPct to PROCENT NARZUTU, nie policzona marża", () => {
    expect(policzCene(PRODUKT, [narzut({ wartosc: 6 })], []).marzaPct).toBe(6);
  });

  it("brak VAT-u na produkcie ⇒ stawka domyślna 23", () => {
    const bezVat = { ...PRODUKT, vat: null };
    expect(policzCene(bezVat, [narzut({ wartosc: 6 })], []).cenaSprzedazy).toBe(1303);
  });

  it("narzut i rabat składają się multiplikatywnie, nie sumują", () => {
    const wynik = policzCene(PRODUKT, [narzut({ wartosc: 20 })], [promocja({ rabatPct: 10 })]);
    // 1000 × 1,2 × 0,9 × 1,23 = 1328,4 → 1328. Suma (+10%) dałaby 1353.
    expect(wynik.cenaSprzedazy).toBe(1328);
    expect(wynik.marzaPct).toBe(20);
  });

  it("bez reguł zostaje sam VAT — brak reguły to narzut 0, nie „zostaw cenę\"", () => {
    expect(policzCene(PRODUKT, [], []).cenaSprzedazy).toBe(1230);
  });

  it("rozbicie pokazuje kroki pośrednie BEZ zaokrąglania", () => {
    const wynik = policzCene(PRODUKT, [narzut({ wartosc: 6 })], [promocja({ rabatPct: 10 })]);
    expect(wynik.poNarzucie).toBeCloseTo(1060, 6);
    expect(wynik.poRabacie).toBeCloseTo(954, 6);
  });
});

describe("2. Dopasowanie warunku", () => {
  it("dostawca po RÓWNOŚCI, kategoria przez zawieranie", () => {
    expect(dopasujWarunek(PRODUKT, { typ: "dostawca", wartosc: "MO5" })).toBe(true);
    expect(dopasujWarunek(PRODUKT, { typ: "dostawca", wartosc: "MO" })).toBe(false);
    expect(dopasujWarunek(PRODUKT, { typ: "kategoria", wartosc: "roln" })).toBe(true);
  });

  it("pusta wartość i nieznany typ dają true", () => {
    expect(dopasujWarunek(PRODUKT, { typ: "marka", wartosc: "  " })).toBe(true);
    expect(dopasujWarunek(PRODUKT, { typ: "markaa", wartosc: "cokolwiek" })).toBe(true);
  });

  it("trzy typy dołożone w 4b działają (plan.md D4)", () => {
    const opona = { ...PRODUKT, konstrukcja: "R", srednica: 42, vfIf: "VF" };
    expect(dopasujWarunek(opona, { typ: "konstrukcja", wartosc: "r" })).toBe(true);
    expect(dopasujWarunek(opona, { typ: "srednica", wartosc: "42" })).toBe(true);
    expect(dopasujWarunek(opona, { typ: "vfIf", wartosc: "vf" })).toBe(true);
  });
});

describe("3. Wybór narzutu", () => {
  it("status inny niż „aktywny\" wyklucza regułę", () => {
    expect(narzutPasuje(narzut({ status: "nieaktywny" }), PRODUKT)).toBe(false);
  });

  it("warunki są KONIUNKCJĄ", () => {
    const oba = JSON.stringify([
      { typ: "marka", wartosc: "BKT" },
      { typ: "kategoria", wartosc: "roln" },
    ]);
    const jeden = JSON.stringify([
      { typ: "marka", wartosc: "BKT" },
      { typ: "kategoria", wartosc: "osobowe" },
    ]);
    expect(narzutPasuje(narzut({ warunki: oba }), PRODUKT)).toBe(true);
    expect(narzutPasuje(narzut({ warunki: jeden }), PRODUKT)).toBe(false);
  });

  it("uszkodzony JSON degraduje do typ/zakres", () => {
    expect(
      narzutPasuje(narzut({ typ: "dostawca", zakres: "MO5", warunki: "{to nie json" }), PRODUKT),
    ).toBe(true);
  });

  it("reguła SPECYFICZNA bije globalną mimo niższego priorytetu", () => {
    const globalna = narzut({ id: 1, typ: "globalny", wartosc: 6, priorytet: 99 });
    const specyficzna = narzut({ id: 2, typ: "dostawca", zakres: "MO5", wartosc: 20, priorytet: 1 });
    expect(wybierzNarzut([globalna, specyficzna], PRODUKT)?.id).toBe(2);
  });

  /**
   * ⭐ TO JEST TEST ODSTĘPSTWA D8. Oryginalny `Mb()` (`frontend-index.js:9485`) uznaje regułę
   * za specyficzną po PRAWDZIWOŚCI napisu `warunki`, więc `"[]"` — dokładnie to, co siedzi
   * w `contract/fixtures/GET_markups.json` — czyni ją specyficzną i kończy szukanie na niej.
   * Backend parsuje i widzi pustą listę, czyli regułę GLOBALNĄ, i szuka dalej. Liczymy jak
   * backend: przy dwóch regułach wygrywa ta po dostawcy, a nie globalna z `"[]"`.
   */
  it("⭐ reguła globalna z warunki:\"[]\" NIE jest specyficzna — jak backend, nie jak Mb()", () => {
    const globalnaZPustymi = narzut({ id: 1, typ: "globalny", warunki: "[]", wartosc: 6, priorytet: 99 });
    const poDostawcy = narzut({ id: 2, typ: "dostawca", zakres: "MO5", wartosc: 20, priorytet: 1 });
    expect(wybierzNarzut([globalnaZPustymi, poDostawcy], PRODUKT)?.id).toBe(2);
  });

  it("priorytet null traktowany jak 50 (backend ma `?? 50`, Mb() nie miał)", () => {
    const bezPriorytetu = { ...narzut({ id: 1, wartosc: 6 }), priorytet: null as unknown as number };
    const zPriorytetem = narzut({ id: 2, wartosc: 9, priorytet: 90 });
    expect(wybierzNarzut([bezPriorytetu, zPriorytetem], PRODUKT)?.id).toBe(2);
  });
});

describe("4. Wybór promocji", () => {
  it("aktywny status to „aktywna\", nie „aktywny\"", () => {
    expect(promocjaPasuje(promocja({ status: "aktywny" }), PRODUKT)).toBe(false);
    expect(promocjaPasuje(promocja({ status: "aktywna" }), PRODUKT)).toBe(true);
  });

  it("dopasowanie po zasięgu jest ODWRÓCONE — zasięg zawiera markę produktu", () => {
    expect(promocjaPasuje(promocja({ zasieg: "BKT,MICHELIN" }), PRODUKT)).toBe(true);
    expect(promocjaPasuje(promocja({ zasieg: "MICHELIN" }), PRODUKT)).toBe(false);
  });

  /**
   * ⚠ TEN SAM NIEZMIENNIK CO W TEŚCIE BACKENDU. Silnik NIE CZYTA dat (backlog #19), więc
   * wygasła promocja dalej obniża ceny. Test stoi po obu stronach, żeby przyszła
   * „oczywista poprawka" w jednej z nich nie rozjechała ich po cichu.
   */
  it("⚠ promocja WYGASŁA nadal obniża cenę — daty nie są czytane", () => {
    const wygasla = promocja({ start: "2020-01-01", koniec: "2020-03-31" });
    expect(promocjaPasuje(wygasla, PRODUKT)).toBe(true);
    expect(policzCene(PRODUKT, [], [wygasla]).cenaSprzedazy).toBe(1107);
  });

  it("wśród promocji wygrywa wyższy priorytet — bez reguły specyficzności", () => {
    const niska = promocja({ id: 1, rabatPct: 5, priorytet: 10 });
    const wysoka = promocja({ id: 2, rabatPct: 40, priorytet: 90 });
    expect(wybierzPromocje([niska, wysoka], PRODUKT)?.id).toBe(2);
  });
});

describe("5. Ostrzeżenie „poniżej kosztu\" — port 1:1, NIE silnik cen", () => {
  /**
   * ⚠ Ta funkcja CELOWO nie używa formuły z góry pliku. Oryginał liczy ostrzeżenie trzecim,
   * własnym sposobem (`el()`, `:24563-24597`): bierze AKTUALNĄ `cenaSprzedazy` z katalogu
   * i mnoży przez `(1 − rabat)`, a dopasowanie ma swoje — globalna obejmuje WSZYSTKO,
   * `marka`/`kategoria`/`dostawca`/`produkt` po RÓWNOŚCI, `rozmiar`/`bieznik` przez zawieranie.
   * Testy poniżej pilnują właśnie tych różnic, żeby ktoś ich „nie ujednolicił".
   */
  const wKatalogu = { ...PRODUKT, cenaSprzedazy: 1230 };

  it("liczy od AKTUALNEJ ceny sprzedaży, nie od zakupu przez narzut i VAT", () => {
    // 1230 × 0,5 = 615 < 1000 (zakup). Silnik cen dałby tu inną liczbę — i o to chodzi.
    const wynik = produktyPonizejKosztu([wKatalogu], [], true, 50);
    expect(wynik).toHaveLength(1);
    expect(wynik[0]!.poRabacie).toBeCloseTo(615, 6);
  });

  it("promocja globalna obejmuje WSZYSTKIE produkty", () => {
    expect(produktyPonizejKosztu([wKatalogu], [], true, 90)).toHaveLength(1);
  });

  it("bez warunków i bez „globalna\" nie ostrzega o niczym", () => {
    expect(produktyPonizejKosztu([wKatalogu], [], false, 90)).toHaveLength(0);
  });

  it("dopasowanie po marce jest przez RÓWNOŚĆ, nie zawieranie", () => {
    const warunek = [{ typ: "marka", wartosc: "BK" }];
    expect(produktyPonizejKosztu([wKatalogu], warunek, false, 90)).toHaveLength(0);
    const dokladny = [{ typ: "marka", wartosc: "BKT" }];
    expect(produktyPonizejKosztu([wKatalogu], dokladny, false, 90)).toHaveLength(1);
  });

  it("rozmiar dopasowuje się przez zawieranie", () => {
    const zRozmiarem = { ...wKatalogu, rozmiar: "480/70R28" };
    expect(produktyPonizejKosztu([zRozmiarem], [{ typ: "rozmiar", wartosc: "70R28" }], false, 90))
      .toHaveLength(1);
  });

  /** Typy dołożone w 4b (D4) są dla silnika ważne, ale ostrzeżenie ich NIE ZNA — jak oryginał. */
  it("⚠ warunek typu `srednica` nie jest rozpoznawany przez ostrzeżenie", () => {
    const zSrednica = { ...wKatalogu, srednica: 42 };
    expect(produktyPonizejKosztu([zSrednica], [{ typ: "srednica", wartosc: "42" }], false, 90))
      .toHaveLength(0);
  });

  it("pomija produkt, w którym któraś cena nie jest liczbą", () => {
    const bezCeny = { ...PRODUKT, cenaSprzedazy: null };
    expect(produktyPonizejKosztu([bezCeny], [], true, 90)).toHaveLength(0);
  });

  it("nie zgłasza produktu, który zostaje powyżej kosztu", () => {
    expect(produktyPonizejKosztu([wKatalogu], [], true, 5)).toHaveLength(0);
  });
});
