/**
 * Parser i filtry „Dziennika" (`pages/konfiguracja/dziennik.ts`).
 *
 * ⚠ `parsujSzczegoly` jest DRUGĄ definicją w repo — oryginał żyje w backendzie
 * (`rebuild/backend/src/historia/mapowanie.ts:87`). Ten plik jest zabezpieczeniem przed
 * dryfem: sprawdza DOKŁADNIE te same wejścia co `backend/test/historia.mapowanie.test.ts`,
 * więc rozejście się obu implementacji zapali test po jednej ze stron.
 */
import { describe, expect, it } from "vitest";

import type { WpisAudytu } from "@/pages/konfiguracja/admin";
import {
  BRAK_WARTOSCI,
  filtrujWpisy,
  parsujSzczegoly,
  streszczSzczegoly,
  wartosciFiltrow,
} from "@/pages/konfiguracja/dziennik";

function wpis(nadpisania: Partial<WpisAudytu> = {}): WpisAudytu {
  return {
    id: 1,
    uzytkownikId: 1,
    uzytkownikImie: "Marta Bieguniak",
    akcja: "auto_pull",
    encjaTyp: "dostawca",
    encjaId: "MO3",
    szczegolyJson: '{"wczytanych":590}',
    kiedy: "2026-08-17T15:49:19.820Z",
    ...nadpisania,
  };
}

describe("parsujSzczegoly", () => {
  it("parsuje poprawny obiekt", () => {
    expect(parsujSzczegoly('{"wczytanych":590,"source":"scheduler"}')).toEqual({
      wczytanych: 590,
      source: "scheduler",
    });
  });

  /** Pisze go m.in. `synchronizacja_reczna` (`:48240`) i `products/clear` (`:48332`). */
  it("NULL daje pusty obiekt, nie wyjątek", () => {
    expect(parsujSzczegoly(null)).toEqual({});
  });

  it("pusty string daje pusty obiekt", () => {
    expect(parsujSzczegoly("")).toEqual({});
  });

  it("niepoprawny JSON daje pusty obiekt, nie wyjątek", () => {
    expect(parsujSzczegoly("to nie jest JSON {{{")).toEqual({});
  });

  /**
   * `JSON.parse("5")` i `JSON.parse("[1,2]")` się UDAJĄ, ale wynik nie jest obiektem —
   * odczyt pola dałby `undefined`. Sprowadzamy do `{}`, tak jak backend.
   */
  it("poprawny JSON, który nie jest obiektem, daje pusty obiekt", () => {
    expect(parsujSzczegoly("5")).toEqual({});
    expect(parsujSzczegoly("null")).toEqual({});
    expect(parsujSzczegoly('"tekst"')).toEqual({});
    expect(parsujSzczegoly("[1,2,3]")).toEqual({});
  });
});

describe("streszczSzczegoly", () => {
  it("skleja pola skalarne w jedną linię", () => {
    expect(streszczSzczegoly('{"wczytanych":590,"nowe":31}')).toBe("wczytanych: 590 · nowe: 31");
  });

  /** Tablica odrzuconych pozycji potrafi mieć setki wpisów — pokazujemy sam licznik. */
  it("tablicę zwija do licznika, a pustą pomija", () => {
    expect(streszczSzczegoly('{"szczegolyOdrzuconych":[{"nazwa":"x"},{"nazwa":"y"}]}')).toBe(
      "szczegolyOdrzuconych: 2",
    );
    expect(streszczSzczegoly('{"szczegolyOdrzuconych":[],"nowe":1}')).toBe("nowe: 1");
  });

  it("obiekt zagnieżdżony zwija do {…}", () => {
    expect(streszczSzczegoly('{"nowe":{"a":1}}')).toBe("nowe: {…}");
  });

  it("NULL i zepsuty JSON dają pusty string", () => {
    expect(streszczSzczegoly(null)).toBe("");
    expect(streszczSzczegoly("{{{")).toBe("");
  });
});

describe("wartosciFiltrow", () => {
  /**
   * Zbiór akcji rośnie z każdą iteracją, więc listy filtrów MUSZĄ pochodzić z danych.
   * Zaszyta lista rozjechałaby się z bazą przy pierwszej nowej akcji.
   */
  it("zbiera akcje i encje z danych, posortowane", () => {
    const { akcje, encje } = wartosciFiltrow([
      wpis({ akcja: "zmiana_hasla", encjaTyp: "user" }),
      wpis({ akcja: "auto_pull", encjaTyp: "dostawca" }),
      wpis({ akcja: "auto_pull", encjaTyp: "dostawca" }),
    ]);

    expect(akcje).toEqual(["auto_pull", "zmiana_hasla"]);
    expect(encje).toEqual(["dostawca", "user"]);
  });

  it("null w encjaTyp staje się jawnym (brak)", () => {
    const { encje } = wartosciFiltrow([wpis({ encjaTyp: null })]);

    expect(encje).toEqual([BRAK_WARTOSCI]);
  });
});

describe("filtrujWpisy", () => {
  const WPISY = [
    wpis({ id: 1, akcja: "auto_pull", encjaTyp: "dostawca", encjaId: "MO3" }),
    wpis({
      id: 2,
      akcja: "synchronizacja_reczna",
      encjaTyp: "dostawca",
      encjaId: "MO99",
      szczegolyJson: null,
    }),
    wpis({
      id: 3,
      akcja: "edycja_konfiguracji",
      encjaTyp: "config",
      encjaId: "shoper.token_api",
      szczegolyJson: '{"wartosc":"abc"}',
    }),
    wpis({ id: 4, akcja: "czyszczenie_katalogu", encjaTyp: null, encjaId: "wszystkie" }),
  ];

  const idki = (filtry: Parameters<typeof filtrujWpisy>[1]) =>
    filtrujWpisy(WPISY, filtry).map((w) => w.id);

  it("bez filtrów oddaje wszystko", () => {
    expect(idki({ akcja: "all", encjaTyp: "all", szukaj: "" })).toEqual([1, 2, 3, 4]);
  });

  it("filtruje po akcji", () => {
    expect(idki({ akcja: "edycja_konfiguracji", encjaTyp: "all", szukaj: "" })).toEqual([3]);
  });

  it("filtruje po typie encji, w tym po (brak)", () => {
    expect(idki({ akcja: "all", encjaTyp: "dostawca", szukaj: "" })).toEqual([1, 2]);
    expect(idki({ akcja: "all", encjaTyp: BRAK_WARTOSCI, szukaj: "" })).toEqual([4]);
  });

  /** Nazwy plików i adresy siedzą w szczegółach, więc szukanie musi tam sięgać. */
  it("szuka także w szczegółach", () => {
    expect(idki({ akcja: "all", encjaTyp: "all", szukaj: "token_api" })).toEqual([3]);
    expect(idki({ akcja: "all", encjaTyp: "all", szukaj: "590" })).toEqual([1, 4]);
  });

  it("szukanie jest bez względu na wielkość liter i przycina spacje", () => {
    expect(idki({ akcja: "all", encjaTyp: "all", szukaj: "  MO99  " })).toEqual([2]);
    expect(idki({ akcja: "all", encjaTyp: "all", szukaj: "mo99" })).toEqual([2]);
  });

  /** Wiersz z `szczegolyJson === null` nie może wywrócić sklejania stogu do szukania. */
  it("znosi wpis z NULL w szczegółach przy wyszukiwaniu", () => {
    expect(idki({ akcja: "all", encjaTyp: "all", szukaj: "synchronizacja" })).toEqual([2]);
  });

  it("łączy filtry", () => {
    expect(idki({ akcja: "auto_pull", encjaTyp: "dostawca", szukaj: "MO3" })).toEqual([1]);
    expect(idki({ akcja: "auto_pull", encjaTyp: "config", szukaj: "" })).toEqual([]);
  });
});
