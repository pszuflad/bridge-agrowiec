/**
 * Jednostkowe testy portu `audit_log → widok historii` (`src/historia/mapowanie.ts`).
 *
 * Tu żyje cała logika wrażliwa na wierność: słownik akcji, kolejność fallbacków,
 * odporność parsera i clamp paginacji, który różni się od tego z `/api/staging/paged`.
 * Utrwalamy zastane zachowanie produkcji — także tam, gdzie wygląda ono na usterkę.
 */
import { describe, expect, it } from "vitest";
import type { WierszAudytu } from "../src/repos/audit.js";
import {
  dostawcyHistorii,
  limitZQuery,
  naWpisHistorii,
  parsujSzczegoly,
  stronaHistorii,
  stronaZQuery,
  typWpisu,
  wpisyHistorii,
  type WpisHistorii,
} from "../src/historia/mapowanie.js";

function wiersz(nadpisania: Partial<WierszAudytu> = {}): WierszAudytu {
  return {
    id: 1,
    uzytkownikId: 1,
    uzytkownikImie: "Marta Bieguniak",
    akcja: "import_cennika",
    encjaTyp: "dostawca",
    encjaId: "MO1",
    szczegolyJson: JSON.stringify({ wczytanych: 10 }),
    kiedy: "2026-07-28T06:00:00.000Z",
    ...nadpisania,
  };
}

describe("typWpisu — słownik pięciu rozpoznawanych akcji", () => {
  it.each([
    ["upload_pliku", "import"],
    ["import_cennika", "import"],
    ["eksport_csv", "eksport"],
    ["eksport_shoper", "eksport"],
    ["edycja_produktu", "edycja"],
  ])("%s → %s", (akcja, oczekiwany) => {
    expect(typWpisu(akcja)).toBe(oczekiwany);
  });

  /**
   * Wszystkie pozostałe akcje, które rebuild dziś zapisuje do `audit_log`, dają `null`
   * i wypadają z widoku. To port 1:1 — w produkcji jest tak samo (plan.md D2).
   * Ten test istnieje po to, żeby przyszła sesja nie „naprawiła" tego przez przypadek.
   */
  it.each([
    "import_z_url",
    "import_pliku",
    "synchronizacja_reczna",
    "edycja_dostawcy",
    "edycja_stagingu",
    "akceptacja_stagingu",
    "odrzucenie_stagingu",
    "override",
    "usuniecie_override",
    "czyszczenie_stagingu",
  ])("%s → null (akcja spoza słownika, wypada z widoku)", (akcja) => {
    expect(typWpisu(akcja)).toBeNull();
  });
});

describe("parsujSzczegoly — odporność na to, co realnie jest w bazie", () => {
  it("NULL daje pusty obiekt, nie wyjątek", () => {
    // Pisze go `POST /api/dostawcy/{kod}/synchronizuj-teraz` (audyt bez czwartego argumentu).
    expect(parsujSzczegoly(null)).toEqual({});
  });

  it("niepoprawny JSON daje pusty obiekt, nie wyjątek", () => {
    expect(parsujSzczegoly("{niepoprawny json")).toEqual({});
  });

  it("pusty string daje pusty obiekt", () => {
    expect(parsujSzczegoly("")).toEqual({});
  });

  it.each(['"tekst"', "5", "null", "[1,2]"])(
    "poprawny JSON, który nie jest obiektem (%s), daje pusty obiekt",
    (surowy) => {
      expect(parsujSzczegoly(surowy)).toEqual({});
    },
  );

  it("obiekt przechodzi bez zmian", () => {
    expect(parsujSzczegoly('{"nazwaPliku":"mo1.xlsx"}')).toEqual({ nazwaPliku: "mo1.xlsx" });
  });
});

describe("naWpisHistorii — mapowanie wiersza audytu", () => {
  it("import z `upload_pliku`: nazwa pliku, liczba pozycji i uwagi", () => {
    const wpis = naWpisHistorii(
      wiersz({
        akcja: "upload_pliku",
        szczegolyJson: JSON.stringify({ nazwaPliku: "mo1.xlsx", liczbaProduktow: 120 }),
      }),
    );

    expect(wpis).toMatchObject({
      typ: "import",
      dostawca: "MO1",
      liczbaPozycji: 120,
      nazwaPliku: "mo1.xlsx",
      format: null,
      kodProduktu: null,
      zmienionePola: [],
      uwagi: "Plik: mo1.xlsx",
    });
  });

  it("import bez nazwy pliku daje uwagi „Plik: ?” — 1:1 z oryginałem", () => {
    const wpis = naWpisHistorii(
      wiersz({ akcja: "import_cennika", szczegolyJson: JSON.stringify({ wczytanych: 7 }) }),
    );
    expect(wpis?.uwagi).toBe("Plik: ?");
    expect(wpis?.nazwaPliku).toBeNull();
  });

  it("liczbaPozycji dla importu: liczbaProduktow → wczytanych → doStagingu → null", () => {
    const dla = (szczegoly: Record<string, unknown>) =>
      naWpisHistorii(
        wiersz({ akcja: "import_cennika", szczegolyJson: JSON.stringify(szczegoly) }),
      )?.liczbaPozycji;

    expect(dla({ liczbaProduktow: 1, wczytanych: 2, doStagingu: 3 })).toBe(1);
    expect(dla({ wczytanych: 2, doStagingu: 3 })).toBe(2);
    expect(dla({ doStagingu: 3 })).toBe(3);
    expect(dla({})).toBeNull();
    // Zero jest wartością, nie brakiem — nie może przeskoczyć na kolejny fallback.
    expect(dla({ liczbaProduktow: 0, wczytanych: 9 })).toBe(0);
  });

  it("liczbaPozycji dla eksportu: liczbaProduktow → liczbaDostawcow → null", () => {
    const dla = (szczegoly: Record<string, unknown>) =>
      naWpisHistorii(
        wiersz({ akcja: "eksport_csv", szczegolyJson: JSON.stringify(szczegoly) }),
      )?.liczbaPozycji;

    expect(dla({ liczbaProduktow: 50 })).toBe(50);
    expect(dla({ liczbaDostawcow: 8 })).toBe(8);
    expect(dla({})).toBeNull();
  });

  it("eksport: format i uwagi zależą od akcji, nie od szczegółów", () => {
    expect(naWpisHistorii(wiersz({ akcja: "eksport_shoper", szczegolyJson: null }))).toMatchObject({
      format: "shoper",
      uwagi: "Format: shoper",
    });
    expect(naWpisHistorii(wiersz({ akcja: "eksport_csv", szczegolyJson: null }))).toMatchObject({
      format: "csv",
      uwagi: "Format: csv",
    });
  });

  it("edycja: kodProduktu z encja_id, zmienionePola z szczegoly.zmiany, liczbaPozycji zawsze 1", () => {
    const wpis = naWpisHistorii(
      wiersz({
        akcja: "edycja_produktu",
        encjaTyp: "produkt",
        encjaId: "MO2_1147700",
        szczegolyJson: JSON.stringify({ zmiany: ["kategoria", "labelSnow"] }),
      }),
    );

    expect(wpis).toMatchObject({
      typ: "edycja",
      kodProduktu: "MO2_1147700",
      zmienionePola: ["kategoria", "labelSnow"],
      liczbaPozycji: 1,
      // `encja_typ` to „produkt", nie „dostawca", a szczegóły nie niosą dostawcy.
      dostawca: null,
      uwagi: null,
    });
  });

  it("edycja bez `zmiany` albo z `zmiany` niebędącym tablicą daje pustą listę", () => {
    const dla = (szczegoly: unknown) =>
      naWpisHistorii(
        wiersz({
          akcja: "edycja_produktu",
          encjaTyp: "produkt",
          szczegolyJson: JSON.stringify(szczegoly),
        }),
      )?.zmienionePola;

    expect(dla({})).toEqual([]);
    expect(dla({ zmiany: "kategoria" })).toEqual([]);
  });

  it("dostawca spoza `encja_typ === 'dostawca'` bierze się ze szczegółów", () => {
    const wpis = naWpisHistorii(
      wiersz({
        akcja: "eksport_csv",
        encjaTyp: null,
        encjaId: null,
        szczegolyJson: JSON.stringify({ dostawca: "MO7" }),
      }),
    );
    expect(wpis?.dostawca).toBe("MO7");
  });

  /**
   * Ostrzeżenie z bloku I5 roadmapy: audyt zapisuje ZAMIAR przed operacją, więc `encja_id`
   * bywa kodem, którego nie ma w `suppliers`. Nie złączamy z tabelą dostawców — kod
   * przechodzi na wylot, wpis się nie gubi i nic nie wybucha.
   */
  it("encja_id niezłączalny z `suppliers` przechodzi na wylot", () => {
    const wpis = naWpisHistorii(wiersz({ akcja: "upload_pliku", encjaId: "MO99" }));
    expect(wpis?.dostawca).toBe("MO99");
  });

  it("akcja spoza słownika daje null jeszcze przed jakimkolwiek mapowaniem", () => {
    expect(naWpisHistorii(wiersz({ akcja: "synchronizacja_reczna", szczegolyJson: null }))).toBeNull();
  });

  it("wpisyHistorii odsiewa akcje nierozpoznane i zachowuje kolejność wejścia", () => {
    const wynik = wpisyHistorii([
      wiersz({ id: 1, akcja: "upload_pliku" }),
      wiersz({ id: 2, akcja: "synchronizacja_reczna", szczegolyJson: null }),
      wiersz({ id: 3, akcja: "edycja_produktu", encjaTyp: "produkt" }),
    ]);
    expect(wynik.map((w) => w.id)).toEqual([1, 3]);
  });
});

describe("dostawcyHistorii", () => {
  const zDostawca = (dostawca: string | null): WpisHistorii => ({
    id: 1,
    typ: "import",
    kiedy: "2026-07-28T06:00:00.000Z",
    dostawca,
    uzytkownik: null,
    liczbaPozycji: null,
    nazwaPliku: null,
    format: null,
    kodProduktu: null,
    zmienionePola: [],
    uwagi: null,
  });

  it("zwraca unikaty posortowane leksykograficznie (MO1, MO10, MO2 — jak w fixture)", () => {
    expect(
      dostawcyHistorii([
        zDostawca("MO2"),
        zDostawca("MO10"),
        zDostawca("MO1"),
        zDostawca("MO2"),
      ]),
    ).toEqual(["MO1", "MO10", "MO2"]);
  });

  it("pomija nulle", () => {
    expect(dostawcyHistorii([zDostawca(null), zDostawca("MO1")])).toEqual(["MO1"]);
  });
});

describe("clamp paginacji — inny niż w /api/staging/paged", () => {
  it.each([
    [undefined, 1],
    ["1", 1],
    // `parseInt("0") || 1` → 1. Fallback stoi PO parseInt, więc „0" nie zostaje zerem.
    ["0", 1],
    ["-5", 1],
    ["abc", 1],
    ["3", 3],
    ["7.9", 7],
  ])("stronaZQuery(%s) = %i", (wejscie, oczekiwana) => {
    expect(stronaZQuery(wejscie)).toBe(oczekiwana);
  });

  it.each([
    [undefined, 50],
    ["25", 25],
    ["0", 50],
    ["abc", 50],
    ["999", 200],
    ["-1", 1],
  ])("limitZQuery(%s) = %i", (wejscie, oczekiwany) => {
    expect(limitZQuery(wejscie)).toBe(oczekiwany);
  });

  /**
   * Kontrast z `/api/staging/paged`, gdzie `||` działa na STRINGU przed `parseInt`
   * i `pageSize=abc` przepuszcza `NaN` aż do SQLite. Tutaj `NaN` nie wycieka nigdy.
   */
  it("nieparsowalne wejście nie przepuszcza NaN", () => {
    expect(Number.isNaN(stronaZQuery("abc"))).toBe(false);
    expect(Number.isNaN(limitZQuery("abc"))).toBe(false);
  });
});

describe("stronaHistorii — filtrowanie, sortowanie i wycinanie strony", () => {
  const wpis = (nadpisania: Partial<WpisHistorii>): WpisHistorii => ({
    id: 1,
    typ: "import",
    kiedy: "2026-07-28T06:00:00.000Z",
    dostawca: "MO1",
    uzytkownik: "Marta Bieguniak",
    liczbaPozycji: 1,
    nazwaPliku: null,
    format: null,
    kodProduktu: null,
    zmienionePola: [],
    uwagi: null,
    ...nadpisania,
  });

  const wszystkie = [
    wpis({ id: 1, typ: "import", dostawca: "MO1", kiedy: "2026-07-28T06:00:00.000Z" }),
    wpis({ id: 2, typ: "eksport", dostawca: null, kiedy: "2026-07-28T07:00:00.000Z" }),
    wpis({
      id: 3,
      typ: "edycja",
      dostawca: null,
      kodProduktu: "MO2_1147700",
      zmienionePola: ["kategoria"],
      kiedy: "2026-07-28T08:00:00.000Z",
    }),
  ];

  const domyslne = { page: 1, limit: 50, search: "", typ: "all", dostawca: "all" };

  it("sortuje malejąco po `kiedy`, niezależnie od kolejności wejścia", () => {
    expect(stronaHistorii(wszystkie, domyslne).items.map((w) => w.id)).toEqual([3, 2, 1]);
  });

  it("filtr `typ` zwęża wynik, `all` przepuszcza wszystko", () => {
    expect(stronaHistorii(wszystkie, { ...domyslne, typ: "edycja" }).items).toHaveLength(1);
    expect(stronaHistorii(wszystkie, { ...domyslne, typ: "all" }).items).toHaveLength(3);
  });

  it("filtr `dostawca` porównuje wartość dokładnie", () => {
    expect(stronaHistorii(wszystkie, { ...domyslne, dostawca: "MO1" }).items).toHaveLength(1);
    expect(stronaHistorii(wszystkie, { ...domyslne, dostawca: "MO9" }).items).toHaveLength(0);
  });

  /**
   * `search` przeszukuje `JSON.stringify` CAŁEGO wpisu, nie wybranych pól — więc trafia
   * także w nazwę typu i w nazwy zmienionych pól. Placeholder w UI opisuje to węziej,
   * niż jest naprawdę; utrwalamy zastane zachowanie.
   */
  it("`search` przeszukuje cały zserializowany wpis, bez rozróżniania wielkości liter", () => {
    expect(stronaHistorii(wszystkie, { ...domyslne, search: "mo2_1147700" }).items).toHaveLength(1);
    expect(stronaHistorii(wszystkie, { ...domyslne, search: "KATEGORIA" }).items).toHaveLength(1);
    expect(stronaHistorii(wszystkie, { ...domyslne, search: "eksport" }).items).toHaveLength(1);
    expect(stronaHistorii(wszystkie, { ...domyslne, search: "brak-takiej-frazy" }).items).toEqual(
      [],
    );
  });

  it("filtry się sumują (AND)", () => {
    expect(
      stronaHistorii(wszystkie, { ...domyslne, typ: "import", dostawca: "MO1" }).items,
    ).toHaveLength(1);
    expect(
      stronaHistorii(wszystkie, { ...domyslne, typ: "edycja", dostawca: "MO1" }).items,
    ).toHaveLength(0);
  });

  it("tnie strony i liczy `total` z PRZEFILTROWANEGO zbioru", () => {
    const pierwsza = stronaHistorii(wszystkie, { ...domyslne, limit: 2, page: 1 });
    expect(pierwsza.items.map((w) => w.id)).toEqual([3, 2]);
    expect(pierwsza).toMatchObject({ total: 3, pages: 2, page: 1, limit: 2 });

    const druga = stronaHistorii(wszystkie, { ...domyslne, limit: 2, page: 2 });
    expect(druga.items.map((w) => w.id)).toEqual([1]);

    const poza = stronaHistorii(wszystkie, { ...domyslne, limit: 2, page: 9 });
    expect(poza.items).toEqual([]);
    expect(poza.page).toBe(9);
  });

  it("pusty wynik daje `pages: 1`, nie zero", () => {
    expect(stronaHistorii([], domyslne)).toMatchObject({ items: [], total: 0, pages: 1 });
  });
});
