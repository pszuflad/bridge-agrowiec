/**
 * Generator codziennego CSV dla Selly (blok 8a) — siatka dla portu
 * `mirror/backend/generate_selly_export.cjs`.
 *
 * W `contract/fixtures/` tego nie ma (to plik na dysku, nie odpowiedź HTTP), więc format
 * zamrażamy TU: 60 kolumn w kolejności, BOM, `;`, `\r\n` i transformacje uzgodnione z Selly,
 * które najłatwiej przy refaktorze zgubić. Sam nagłówek porównujemy z NAGRANIEM realnego pliku
 * produkcji (`test/nagrania/selly-csv-naglowek.csv`, `origin/main` @ `88fa31c`).
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  LICZBA_KOLUMN,
  nazwaKategoriiSklepu,
  sciezkaPliku,
  statusPlikuCsv,
  wygenerujCsvSelly,
  zbudujCsvSelly,
} from "../src/selly/generator-csv.js";
import { stworzTestowaBaze, type TestowaBaza } from "./gate/baza.js";
import { PRODUKTY_TESTOWE, zasiejProdukty } from "./gate/dane.js";

describe("generator CSV dla Selly (blok 8a)", () => {
  let baza: TestowaBaza;

  beforeEach(() => {
    baza = stworzTestowaBaze();
    zasiejProdukty(baza.db);
  });

  afterEach(() => baza.posprzataj());

  /** Nagłówek pliku, bez BOM-u, rozbity na kolumny. */
  const naglowek = (): string[] => zbudujCsvSelly(baza.db).tresc.slice(1).split("\r\n")[0]!.split(";");

  /** Wiersz danych o podanym kodzie produktu (`Kod-dostawcy` to 10. kolumna). */
  const wiersz = (kodBezPodkreslnika: string): string[] | undefined =>
    zbudujCsvSelly(baza.db)
      .tresc.split("\r\n")
      .slice(1)
      .map((w) => w.split(";"))
      .find((k) => k[9] === kodBezPodkreslnika);

  it("ma dokładnie 60 kolumn w kolejności z pliku wzorcowego", () => {
    const kolumny = naglowek();

    expect(kolumny).toHaveLength(60);
    expect(LICZBA_KOLUMN).toBe(60);
    expect(kolumny[0]).toBe("Nazwa-produktu");
    expect(kolumny[9]).toBe("Kod-dostawcy");
    expect(kolumny[57]).toBe("Zastosowanie");
    expect(kolumny[58]).toBe("data_aktualizacji");
    // Backlog #73 — kolumna dołożona na KONIEC, za `data_aktualizacji`.
    expect(kolumny[59]).toBe("Blokowane-formy-platnosci");
  });

  /**
   * ⭐ NAJMOCNIEJSZY DOWÓD FORMATU w tym pliku: cała linia nagłówkowa porównana z NAGRANIEM
   * realnego pliku, który produkcja wysyła do Selly (`origin/main` @ `88fa31c`).
   *
   * Selly parsuje plik po nazwach kolumn, więc literówka w jednej nazwie nie wywala importu —
   * po cichu przestaje aktualizować jedną cechę w sklepie. Dokładnie to zdarzyło się przy
   * zmianie `R/D` → `Konstrukcja` (backlog #76, 01.09 → powrót 14.09) i wyszło dopiero
   * ze zgłoszenia Ani. Lista nazw przepisana ręcznie do testu nie chroni przed tym wcale,
   * bo przepisuje się ją z tego samego kodu, który ma być sprawdzony.
   *
   * ⚠ Nie czytamy `mirror/` wprost: `mirror/` przychodzi na `develop` z opóźnieniem triażu
   * i w chwili pisania miał tam jeszcze wersję 59-kolumnową. Szczegóły: `test/nagrania/README.md`.
   */
  it("linia nagłówkowa jest identyczna z nagraniem pliku produkcji", () => {
    const nagranie = readFileSync(
      join(fileURLToPath(new URL("./nagrania/", import.meta.url)), "selly-csv-naglowek.csv"),
      "utf8",
    );
    // Nagranie to surowa pierwsza linia pliku: BOM + nagłówek + `\r\n`.
    expect(nagranie.startsWith("﻿")).toBe(true);

    const { tresc } = zbudujCsvSelly(baza.db);
    const naszaLinia = tresc.slice(0, tresc.indexOf("\r\n") + 2);

    expect(naszaLinia).toBe(nagranie);
  });

  /**
   * Backlog #76 pkt 3: nagłówek `R/D` (wymóg importera Selly) przy PEŁNYCH wartościach
   * „Radialna"/„Diagonalna". Produkcja zmieniła go 01.09 na „Konstrukcja", przez co Selly
   * przestało aktualizować cechę konstrukcji, i 14.09 wróciła. Odbudowa nigdy tej zmiany nie
   * przejęła — karta kazała to SPRAWDZIĆ TESTEM, nie założyć. To jest ten test.
   */
  it("nagłówek konstrukcji to `R/D`, a wartości zostają pełnymi słowami", () => {
    const kolumny = naglowek();

    expect(kolumny).toContain("R/D");
    expect(kolumny).not.toContain("Konstrukcja");
    expect(kolumny[29]).toBe("R/D");

    baza.sqlite.prepare("UPDATE products SET konstrukcja = ? WHERE kod = ?").run("Radialna", "MO9_336320");
    baza.sqlite.prepare("UPDATE products SET konstrukcja = ? WHERE kod = ?").run("Diagonalna", "MO9_336319");

    expect(wiersz("MO9336320")?.[29]).toBe("Radialna");
    expect(wiersz("MO9336319")?.[29]).toBe("Diagonalna");
  });

  it("zaczyna się BOM-em, łączy wiersze `\\r\\n` i kończy złamaniem", () => {
    const { tresc } = zbudujCsvSelly(baza.db);

    expect(tresc.startsWith("﻿")).toBe(true);
    expect(tresc.endsWith("\r\n")).toBe(true);
    expect(tresc).not.toContain("\n\n");
  });

  it("bierze wyłącznie produkty ze statusem `aktywny`", () => {
    const { wiersze } = zbudujCsvSelly(baza.db);
    const aktywne = PRODUKTY_TESTOWE.filter((p) => (p.status ?? "aktywny") === "aktywny").length;

    expect(wiersze).toBe(aktywne);
    // `MO1_100001` jest „wstrzymany" — nie może się pojawić.
    expect(zbudujCsvSelly(baza.db).tresc).not.toContain("MO1100001");
  });

  /**
   * ⚠ `Kod-dostawcy` bierze kolumnę `kod` (NIE `kod_dostawcy`) i usuwa z niej podkreślniki:
   * `MO9_336320` → `MO9336320`. Zgodnie z plikiem wzorcowym wysłanym do Selly.
   */
  it("`Kod-dostawcy` to `kod` bez podkreślników, nie `kod_dostawcy`", () => {
    const dane = zbudujCsvSelly(baza.db)
      .tresc.split("\r\n")
      .slice(1)
      .filter(Boolean)
      .map((w) => w.split(";")[9]);

    expect(dane).toContain("MO9336320");
    expect(dane).not.toContain("MO9_336320");
    // `kodDostawcy` produktu MO9_336319 to „521559" — nie może trafić do tej kolumny.
    expect(dane).not.toContain("521559");
  });

  /** ⚠ Zmiana z 2026-07-24 na prośbę Selly: wartość opisowa zamiast 0/1. */
  it("kolumny boolowskie oddają „Tak” albo PUSTE pole, nigdy 0/1", () => {
    const kolumny = naglowek();
    const zPrawda = wiersz("MO9336319"); // ten produkt ma komplet flag ustawionych na true
    const zNull = wiersz("MO9336320"); // ten ma je nieustawione

    expect(zPrawda?.[kolumny.indexOf("Reinforced")]).toBe("Tak");
    expect(zPrawda?.[kolumny.indexOf("ExtraLoad")]).toBe("Tak");
    expect(zNull?.[kolumny.indexOf("Reinforced")]).toBe("");
    expect(zNull?.[kolumny.indexOf("CFO")]).toBe("");
  });

  /**
   * Wpis backlogu #153.1 — generator gubił flagi zapisane w bazie jako TEKST `'Tak'`.
   *
   * SQLite pozwala trzymać tekst w kolumnie `INTEGER`, a import z tego korzystał: na kopii
   * produkcji z 23.09 obok `0`/`1` siedział napis `'Tak'` w 750 (`snow_3pmsf`), 713 (`ms`),
   * 52 (`cfo`), 12 (`nro`) i 10 (`cho`) wierszach. Mapper boolean drizzle robi
   * `Number(v) === 1`, więc tekst dawał `false` i `wartosc ? "Tak" : ""` wypisywało pustkę —
   * 899 z 5396 wierszy różniło się od pliku produkcji, która czyta `SELECT *` surowo.
   *
   * ⚠ Te testy MUSZĄ wstrzykiwać wartości surowym SQL-em (`baza.sqlite`), bo typowany insert
   * drizzle zmapowałby `boolean` z powrotem na `0`/`1` i usterka byłaby nieodtwarzalna.
   */
  describe("flagi zapisane jako tekst (#153.1, karta FIX.1)", () => {
    /**
     * Dziesiątka z `boolCols` oryginału (`generate_selly_export.cjs:76`) — nazwa kolumny SQL
     * i odpowiadający jej nagłówek CSV. Lista jest tu wypisana wprost, bo to ODWZOROWANIE
     * oryginału: gdyby ktoś zmienił ją w generatorze, ten test ma o tym powiedzieć.
     */
    const FLAGI: readonly (readonly [kolumnaSql: string, naglowekCsv: string])[] = [
      ["reinforced", "Reinforced"],
      ["extra_load", "ExtraLoad"],
      ["cut_resistant", "CutResistant"],
      ["heat_resistant", "HeatResistant"],
      ["stubble_resistant", "StubbleResistant"],
      ["nro", "NRO"],
      ["cho", "CHO"],
      ["ms", "Bloto+snieg"],
      ["snow_3pmsf", "Snieg-3PMSF"],
      ["cfo", "CFO"],
    ] as const;

    /** Wstawia wartość do kolumny poza typowaniem drizzle — inaczej nie da się tu wsadzić tekstu. */
    const ustawSurowo = (kolumnaSql: string, wartosc: unknown, kod = "MO9_336320"): void => {
      baza.sqlite.prepare(`UPDATE products SET ${kolumnaSql} = ? WHERE kod = ?`).run(wartosc, kod);
    };

    it("tekst `'Tak'` w pięciu kolumnach z pomiaru daje `Tak`, nie pustkę", () => {
      for (const kolumna of ["ms", "snow_3pmsf", "cfo", "nro", "cho"]) {
        ustawSurowo(kolumna, "Tak");
      }

      const kolumny = naglowek();
      const dane = wiersz("MO9336320");

      expect(dane?.[kolumny.indexOf("Bloto+snieg")]).toBe("Tak");
      expect(dane?.[kolumny.indexOf("Snieg-3PMSF")]).toBe("Tak");
      expect(dane?.[kolumny.indexOf("CFO")]).toBe("Tak");
      expect(dane?.[kolumny.indexOf("NRO")]).toBe("Tak");
      expect(dane?.[kolumny.indexOf("CHO")]).toBe("Tak");
    });

    /**
     * Karta FIX.1: „popraw wszystkie dziesięć, bo kolejny import może wstawić tekst do każdej".
     * Pomiar zastał tekst w sześciu kolumnach — ten test pilnuje pozostałych czterech.
     */
    it("tekst `'Tak'` daje `Tak` w KAŻDEJ z dziesięciu kolumn, nie tylko w zmierzonych", () => {
      for (const [kolumnaSql] of FLAGI) ustawSurowo(kolumnaSql, "Tak");

      const kolumny = naglowek();
      const dane = wiersz("MO9336320");
      const puste = FLAGI.filter(([, naglowekCsv]) => dane?.[kolumny.indexOf(naglowekCsv)] !== "Tak");

      expect(puste.map(([, naglowekCsv]) => naglowekCsv)).toEqual([]);
    });

    /**
     * Reguła oryginału to goły `v ? 'Tak' : ''` na wartości SUROWEJ (`:127-131`) — patrzy na
     * pustość, nie na treść. Odtwarzamy ją WIERNIE i ten test jest po to, żeby nikt jej później
     * „nie poprawił" na wariant `v === 1 || v === 'Tak'` — zawężenie rozjechałoby nas z produkcją
     * (napisy inne niż `'Tak'` przestałyby działać).
     *
     * ⚠ CO FILTRUJE SAMO SQLITE, a czego nie musimy filtrować my: kolumna jest zadeklarowana
     * `INTEGER`, więc działa na niej POWINOWACTWO TYPÓW — napis dający się przeczytać jako
     * liczba jest przy zapisie KONWERTOWANY, i to zanim jakikolwiek kod go zobaczy. Zmierzone:
     * `'0'` → `integer 0`, `'1'` → `integer 1`, a `'Tak'`, `'Nie'` i `''` zostają tekstem.
     * Dlatego tekstowe `'0'` w tych kolumnach NIE ISTNIEJE i nie ma jak dać „Tak" — pytanie
     * „czy niepusty napis `'0'` jest truthy" jest tu bezprzedmiotowe. Produkcja stoi na tym samym
     * SQLite z tą samą deklaracją kolumny, więc zachowuje się identycznie.
     */
    it.each([
      { opis: "liczba 1", wartosc: 1, oczekiwane: "Tak" },
      { opis: "liczba 0", wartosc: 0, oczekiwane: "" },
      { opis: "tekst 'Tak' (zostaje tekstem)", wartosc: "Tak", oczekiwane: "Tak" },
      { opis: "NULL", wartosc: null, oczekiwane: "" },
      { opis: "tekst pusty (zostaje tekstem, falsy)", wartosc: "", oczekiwane: "" },
      { opis: "tekst '0' — SQLite zamienia na integer 0", wartosc: "0", oczekiwane: "" },
      { opis: "tekst '1' — SQLite zamienia na integer 1", wartosc: "1", oczekiwane: "Tak" },
      { opis: "tekst 'Nie' — zostaje tekstem, oryginał nie patrzy na treść", wartosc: "Nie", oczekiwane: "Tak" },
    ])("$opis → `$oczekiwane`", ({ wartosc, oczekiwane }) => {
      ustawSurowo("ms", wartosc);

      const kolumny = naglowek();
      expect(wiersz("MO9336320")?.[kolumny.indexOf("Bloto+snieg")]).toBe(oczekiwane);
    });

    /**
     * Dowód mechanizmu z komentarza wyżej, na tej samej bazie i tej samej kolumnie — żeby
     * „SQLite to konwertuje" nie było w tym pliku gołym twierdzeniem.
     */
    it("powinowactwo typów: `'0'`/`'1'` wchodzą jako liczby, `'Tak'`/`'Nie'`/`''` jako tekst", () => {
      const typWKolumnie = (wartosc: unknown): string => {
        ustawSurowo("ms", wartosc);
        return (
          baza.sqlite.prepare("SELECT typeof(ms) t FROM products WHERE kod = ?").get("MO9_336320") as {
            t: string;
          }
        ).t;
      };

      expect(typWKolumnie("0")).toBe("integer");
      expect(typWKolumnie("1")).toBe("integer");
      expect(typWKolumnie("Tak")).toBe("text");
      expect(typWKolumnie("Nie")).toBe("text");
      expect(typWKolumnie("")).toBe("text");
    });

    it("surowy odczyt nie przecieka do pliku — nigdy nie wychodzi `1` ani goły tekst", () => {
      for (const [kolumnaSql] of FLAGI) ustawSurowo(kolumnaSql, "Tak");
      const kolumny = naglowek();
      // MO9336319 ma wszystkie dziesięć jako `true` (czyli `1` w bazie).
      const zJedynkami = wiersz("MO9336319");
      const zTekstem = wiersz("MO9336320");

      for (const [, naglowekCsv] of FLAGI) {
        expect(zJedynkami?.[kolumny.indexOf(naglowekCsv)]).toBe("Tak");
        expect(zTekstem?.[kolumny.indexOf(naglowekCsv)]).toBe("Tak");
      }
    });
  });

  /** ⚠ Zmiana z 2026-07-31: `123,-` zamiast surowej liczby z kropką. */
  it("`cena_sprzedazy` wychodzi w formacie `123,-`", () => {
    const kolumny = naglowek();
    const dane = wiersz("MO9336320");

    expect(dane?.[kolumny.indexOf("cena_sprzedazy")]).toBe("7252,-");
    // `Cena-zakupu` NIE jest tak formatowana — zostaje surową liczbą.
    expect(dane?.[kolumny.indexOf("Cena-zakupu")]).toBe("5562.4");
  });

  /**
   * Backlog #76 pkt 1–2. Integrator Selly o 12:00 przypisywał produkty do starych, ukrytych
   * kategorii 7–10, bo CSV niósł WEWNĘTRZNE nazwy Bridge. Generator mapuje je na nazwy żywych
   * kategorii sklepu.
   */
  describe("nazwy kategorii sklepu (`toSellyCategoryName`, backlog #76)", () => {
    it("mapuje pięć kluczy mapy na nazwy żywych kategorii sklepu", () => {
      expect(nazwaKategoriiSklepu("Rolnicze")).toBe("Opony rolnicze");
      expect(nazwaKategoriiSklepu("Rolnicze małe")).toBe("Opony rolnicze");
      expect(nazwaKategoriiSklepu("Leśne")).toBe("Opony leśne");
      expect(nazwaKategoriiSklepu("Ciężarowe")).toBe("Opony ciężarowe");
    });

    /**
     * ⭐ REGRESJA Z 14.09 (`.bak_fix_polish_l_20260914_131800`). Kontrola pierwszego eksportu
     * wykazała, że JEDNA z czterech kategorii zachowała starą nazwę: `normalize("NFD")` rozkłada
     * `ś`→`s`+znak diakrytyczny, ale `ł` to OSOBNY punkt kodowy (U+0142) i NFD go nie rusza,
     * więc „Przemysłowe" → „przemysłowe" i nie trafia w klucz `przemyslowe`.
     *
     * Bez jawnego `.replace(/ł/g,"l")` ten jeden expect pada, a reszta testu przechodzi —
     * dokładnie tak, jak to wyglądało w produkcji.
     */
    it("radzi sobie z `ł`, którego `normalize(\"NFD\")` nie rozkłada", () => {
      expect(nazwaKategoriiSklepu("Przemysłowe")).toBe("Opony przemysłowe");
      expect(nazwaKategoriiSklepu("PRZEMYSŁOWE")).toBe("Opony przemysłowe");
    });

    it("wartość spoza mapy przechodzi bez zmian, a pusta daje pusty string", () => {
      // W bazie testowej `MO2_200002` ma kategorię „Przyczepy" — nie ma jej w mapie.
      expect(nazwaKategoriiSklepu("Przyczepy")).toBe("Przyczepy");
      expect(nazwaKategoriiSklepu(null)).toBe("");
      expect(nazwaKategoriiSklepu(undefined)).toBe("");
    });

    it("kolumna `Kategoria` w pliku niesie nazwę sklepu, nie nazwę Bridge", () => {
      const kolumny = naglowek();
      const i = kolumny.indexOf("Kategoria");

      expect(wiersz("MO9336320")?.[i]).toBe("Opony rolnicze");
      // Kategoria spoza mapy zostaje taka, jaka była.
      expect(wiersz("MO2200002")?.[i]).toBe("Przyczepy");
    });
  });

  /**
   * Backlog #73 — 60. kolumna. Wartość utrzymują triggery `products_blokowane_formy_ai/_au`
   * z migracji 011 (karta I15.1); baza testowa przechodzi te same migracje co staging,
   * więc pole jest wypełnione samym `INSERT`-em, bez pomocy generatora.
   */
  describe("blokowane formy płatności (60. kolumna, backlog #73)", () => {
    const wartosc = (kod: string): string | undefined =>
      wiersz(kod)?.[naglowek().indexOf("Blokowane-formy-platnosci")];

    it("bierze wartość utrzymywaną przez trigger migracji 011", () => {
      expect(wartosc("MO9336320")).toBe(
        "201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 217, 218, 219",
      );
      expect(wartosc("MO2200002")).toBe(
        "201, 202, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219",
      );
    });

    /**
     * Fallback oryginału (`generate_selly_export.cjs:142-144`): pusta kolumna → mapa po
     * `dostawca`.
     *
     * ⚠ Trigger NIE stoi tu na przeszkodzie i nie trzeba go zdejmować: `products_blokowane_formy_au`
     * jest `AFTER UPDATE OF dostawca`, więc aktualizacja samej kolumny blokad go nie uruchamia.
     * Dzięki temu pustkę da się wymusić zwykłym `UPDATE`, a test nie rusza schematu bazy.
     */
    it("pustą wartość uzupełnia z mapy po kodzie dostawcy", () => {
      baza.sqlite
        .prepare("UPDATE products SET blokowane_formy_platnosci = NULL WHERE kod = ?")
        .run("MO9_336320");
      // Kontrola założenia: trigger faktycznie nie odtworzył wartości.
      expect(
        baza.sqlite
          .prepare("SELECT blokowane_formy_platnosci AS b FROM products WHERE kod = ?")
          .get("MO9_336320"),
      ).toEqual({ b: null });

      expect(wartosc("MO9336320")).toBe(
        "201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 217, 218, 219",
      );
    });

    /**
     * ⚠ MO6 (Uniglory) CELOWO nie ma mapowania — CHANGELOG produkcji 2026-09-10 14:53:
     * „nie będzie na razie w sprzedaży". Puste pole jest tu POPRAWNYM wynikiem, nie luką
     * (backlog #101, zamknięte 2026-09-23 po pomiarze na żywej produkcji).
     */
    it("MO6 i nieznany dostawca dają puste pole, nie wartość zastępczą", () => {
      baza.sqlite.prepare("UPDATE products SET dostawca = ? WHERE kod = ?").run("MO6", "MO9_336320");
      baza.sqlite.prepare("UPDATE products SET dostawca = ? WHERE kod = ?").run("XYZ", "MO9_336319");

      expect(wartosc("MO9336320")).toBe("");
      expect(wartosc("MO9336319")).toBe("");
    });

    /** Wartość jest tekstem („201, 202, …"), więc nie wolno jej potraktować jak flagi → „Tak". */
    it("nie wpada w gałąź kolumn boolowskich", () => {
      expect(wartosc("MO9336320")).not.toBe("Tak");
    });
  });

  it("kolumna `Promocja` jest zawsze pusta — nie ma jej w bazie", () => {
    const kolumny = naglowek();
    const dane = wiersz("MO9336320");

    expect(kolumny).toContain("Promocja");
    expect(dane?.[kolumny.indexOf("Promocja")]).toBe("");
  });

  /**
   * Ten format JEST escapowany, w odróżnieniu od OBU eksportów Shopera, które zamiast
   * cudzysłowów zamieniają `;` na `,` (`selly/csv-shoper.ts`). Trzy formaty CSV w jednym
   * projekcie, dwie różne strategie — stąd osobny test na każdą.
   *
   * Wiersza nie rozbijamy tu po `;`, bo escapowane pole zawiera separator w środku;
   * sprawdzamy fragment treści, tak jak zrobiłby to Excel po sparsowaniu cudzysłowów.
   */
  it("pole ze średnikiem trafia w cudzysłowy, a cudzysłów jest podwajany", () => {
    baza.sqlite
      .prepare("UPDATE products SET nazwa = ? WHERE kod = ?")
      .run('Opona; 20" "premium"', "MO9_336320");

    const { tresc } = zbudujCsvSelly(baza.db);

    expect(tresc).toContain('"Opona; 20"" ""premium"""');
    // Pole zawiera średnik, więc naiwny podział wiersza da o jedną kolumnę za dużo —
    // to jest właśnie powód, dla którego escaping tu jest, a w eksportach Shopera go nie ma.
    const wiersze = tresc.split("\r\n").slice(1).filter(Boolean);
    const zEscapem = wiersze.find((w) => w.startsWith('"Opona'));
    expect(zEscapem?.split(";")).toHaveLength(61);
  });

  describe("zapis pliku i odczyt jego statusu", () => {
    it("`wygenerujCsvSelly` pisze plik i zwraca jego statystyki", () => {
      const sciezki = {
        katalog: `${baza.sciezka}-csv`,
        plik: "selly.csv",
        url: "https://przyklad/selly.csv",
      };

      const wynik = wygenerujCsvSelly(baza.db, sciezki);

      expect(wynik.ok).toBe(true);
      expect(wynik.wiersze).toBe(3);
      expect(wynik.czas_ms).toBeGreaterThanOrEqual(0);
      expect(wynik.stdout).toContain("Liczba kolumn: 60");
      // ⚠ Bez nawiasów — tak wypisuje produkcja na `88fa31c` (`generate_selly_export.cjs:160`).
      // Tekst ewoluował: „(aktywnych)" → „(aktywnych i wstrzymanych)" (#77) → „aktywnych" (#104).
      expect(wynik.stdout).toContain("Liczba produktow aktywnych: 3");

      const zDysku = readFileSync(sciezkaPliku(sciezki), "utf8");
      expect(zDysku).toBe(zbudujCsvSelly(baza.db).tresc);
    });

    /**
     * Backlog #104 (produkcja 2026-09-22): zapis przez plik tymczasowy + `rename`. `rename`
     * w obrębie jednego systemu plików jest atomowy, więc Selly przychodzące po plik nigdy
     * nie zobaczy go w połowie zapisu (~2,5 MB, kilkaset ms).
     *
     * Testujemy SKUTEK, a nie wywołania `fs` (podmiana `fs` sprawdzałaby tylko, że test zna
     * implementację): po generowaniu w katalogu ma być wyłącznie plik docelowy.
     */
    it("zapisuje atomowo i nie zostawia pliku tymczasowego", () => {
      const sciezki = {
        katalog: `${baza.sciezka}-csv-atomowy`,
        plik: "selly.csv",
        url: "https://przyklad/selly.csv",
      };

      wygenerujCsvSelly(baza.db, sciezki);
      wygenerujCsvSelly(baza.db, sciezki); // druga generacja nadpisuje w miejsce

      expect(readdirSync(sciezki.katalog)).toEqual(["selly.csv"]);
    });

    /**
     * Na produkcji plik leży w katalogu chronionym `.htaccess` z białą listą IP (Selly +
     * Agrowiec). Podmiana katalogu bez tego pliku odbiera Selly dostęp do CSV (403) —
     * `docs/cutover.md`, krok „Frontend na miejsce". Generator ma ruszać WYŁĄCZNIE swój plik.
     */
    it("nie dotyka innych plików w katalogu eksportu (w tym `.htaccess`)", () => {
      const sciezki = {
        katalog: `${baza.sciezka}-csv-htaccess`,
        plik: "selly.csv",
        url: "https://przyklad/selly.csv",
      };
      mkdirSync(sciezki.katalog, { recursive: true });
      writeFileSync(join(sciezki.katalog, ".htaccess"), "Require ip 127.0.0.1\n", "utf8");

      wygenerujCsvSelly(baza.db, sciezki);

      expect(readFileSync(join(sciezki.katalog, ".htaccess"), "utf8")).toBe("Require ip 127.0.0.1\n");
      expect(readdirSync(sciezki.katalog).sort()).toEqual([".htaccess", "selly.csv"]);
    });

    /**
     * ⚠ Brak pliku daje INNY, pięciokluczowy kształt odpowiedzi (`routes.cjs:303-305`) —
     * bez `ostatnia_synchronizacja`, `wiersze` i reszty. Frontend rozgałęzia się na `exists`.
     */
    it("brak pliku daje pięciokluczową odpowiedź z `exists: false`", () => {
      const status = statusPlikuCsv({
        katalog: `${baza.sciezka}-nie-ma`,
        plik: "brak.csv",
        url: "https://przyklad/brak.csv",
      });

      expect(status).toEqual({
        ok: false,
        exists: false,
        status: "blad",
        powod: "Brak pliku CSV",
        url: "https://przyklad/brak.csv",
      });
    });

    it("świeży plik jest `ok`, a `wiersze` liczy dane bez nagłówka", () => {
      const sciezki = {
        katalog: `${baza.sciezka}-csv2`,
        plik: "selly.csv",
        url: "https://przyklad/selly.csv",
      };
      wygenerujCsvSelly(baza.db, sciezki);

      const status = statusPlikuCsv(sciezki);

      expect(status.exists).toBe(true);
      expect(status).toMatchObject({ ok: true, status: "ok", powod: null, wiersze: 3 });
    });

    /**
     * Plik z wczoraj jest `blad` z konkretnym powodem — to jest sygnał, że cron o 6:00
     * nie zadziałał i Selly ciągnie wczorajsze ceny.
     */
    it("plik nie z dzisiaj jest `blad` z powodem o dacie", () => {
      const sciezki = {
        katalog: `${baza.sciezka}-csv3`,
        plik: "selly.csv",
        url: "https://przyklad/selly.csv",
      };
      wygenerujCsvSelly(baza.db, sciezki);

      const zaDwaDni = new Date(Date.now() + 2 * 86_400_000);
      const status = statusPlikuCsv(sciezki, zaDwaDni);

      expect(status).toMatchObject({
        ok: false,
        exists: true,
        status: "blad",
        powod: "Plik nie zostal wygenerowany dzisiaj",
        wygenerowany_dzisiaj: false,
      });
    });
  });
});
