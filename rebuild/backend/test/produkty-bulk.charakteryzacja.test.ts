/**
 * GATE SESJI 12a — dowód, że nasz `addProductsBulk` zachowuje się jak produkcja.
 *
 * METODA, TA SAMA CO W 3d-2: nie porównujemy kodu, tylko ZACHOWANIE uruchomionego oryginału.
 * `addProductsBulk` jest — jak `acceptStaging` — metodą obiektu `U`, która rozmawia wprost
 * z Drizzle i z surowym uchwytem sqlite (`Qi.transaction`, `bridge_ext`). Dlatego oryginał
 * dostaje PRAWDZIWĄ bazę zbudowaną z naszego kanonu, a porównujemy KOŃCOWY STAN DWÓCH
 * IDENTYCZNIE ZASIANYCH BAZ. Harness wycina go z bundla trzecim fragmentem, dołożonym w 12a
 * (`charakteryzacja/akceptacja/oryginal.mjs`).
 *
 * ⚠ CZEGO TA PRÓBA NIE MIERZY — I DLACZEGO TO NIE JEST LUKA. Propagacja `uwagaCena` do
 * kolumny jest w produkcji MONKEY-PATCHEM (`mirror/backend/uwaga_cena_patch.cjs:72-93`),
 * doklejanym do `index.cjs` po buildzie. Wycięty z bundla `addProductsBulk` go nie zawiera,
 * więc oryginał w tej próbie kolumny nie tknie, a nasz port — tknie. Porównanie stanu bazy
 * pomija więc `uwagaCena`; samą propagację mierzą testy tras (`produkty.mutacje.test.ts`),
 * gdzie wzorcem jest kod monkey-patcha. Gdyby pominąć to milczeniem, zielony wynik tutaj
 * znaczyłby mniej, niż się wydaje.
 */
import { afterEach, describe, expect, it } from "vitest";

import { dodajProduktyBulk } from "../src/import/bulk.js";
import {
  linkPamiecKod,
  linkPamiecMr,
  markups,
  nazwaPamiec,
  products,
  promotions,
  wagaPamiec,
} from "../src/db/schema.js";
import { stworzTestowaBaze, type TestowaBaza } from "./gate/baza.js";
import { wytnijFragmenty, zaladujOryginal } from "./charakteryzacja/akceptacja/oryginal.mjs";
import { SCENARIUSZE } from "./charakteryzacja/bulk/scenariusze.mjs";

type Wiersz = Record<string, unknown>;
type Scenariusz = (typeof SCENARIUSZE)[number];

const ZNACZNIK_CZASU = "<czas przebiegu>";
const ZNACZNIK_LOSOWY = "<losowy numer sześciocyfrowy>";

/** Zasiewa bazę stanem wejściowym scenariusza. Obie strony dostają dokładnie to samo. */
function zasiej(baza: TestowaBaza, s: Scenariusz): void {
  const wstaw = (tabela: never, wiersze?: Wiersz[]) => {
    if (wiersze?.length) baza.db.insert(tabela).values(wiersze as never).run();
  };
  wstaw(products as never, s.katalog as Wiersz[]);
  wstaw(nazwaPamiec as never, s.nazwaPamiec);
  wstaw(wagaPamiec as never, s.wagaPamiec);
  wstaw(linkPamiecKod as never, s.linkPamiecKod);
  wstaw(markups as never, s.narzuty);
  wstaw(promotions as never, s.promocje);
}

/**
 * Sprowadza stan bazy do postaci porównywalnej między przebiegami.
 *
 * Normalizujemy trzy rzeczy i tylko trzy:
 *  • znaczniki czasu — oryginał i port biorą `new Date()` w różnych milisekundach;
 *  • świeżo wylosowany `kodImportu` — `_kiGenUnique()` w `bridge_ext` używa `Math.random()`.
 *    ⚠ Numer ODZIEDZICZONY po grupie normalizacji NIE podlega: jest deterministyczny i to
 *    właśnie on jest w tym miejscu ciekawy;
 *  • `uwagaCena` — patrz nagłówek pliku; monkey-patcha nie ma w wycinku bundla.
 */
function normalizuj(baza: TestowaBaza, numeryZKatalogu: Set<string>) {
  const czas = (w: Wiersz, pola: string[]) => {
    for (const pole of pola) {
      const wartosc = w[pole];
      if (typeof wartosc === "string" && /^\d{4}-\d{2}-\d{2}[T ]/.test(wartosc)) {
        if (!wartosc.startsWith("2026-01") && !wartosc.startsWith("2026-02")) {
          w[pole] = ZNACZNIK_CZASU;
        }
      }
    }
    return w;
  };

  const produkty = (baza.db.select().from(products).all() as unknown as Wiersz[])
    .map((w) => czas({ ...w }, ["dataAktualizacji"]))
    .map((w) => {
      const numer = w.kodImportu;
      if (typeof numer === "string" && /^\d{6}$/.test(numer) && !numeryZKatalogu.has(numer)) {
        w.kodImportu = ZNACZNIK_LOSOWY;
      }
      delete w.uwagaCena;
      return w;
    })
    .sort((a, b) => String(a.kod).localeCompare(String(b.kod)));

  return {
    produkty,
    pamiecKod: (baza.db.select().from(linkPamiecKod).all() as unknown as Wiersz[]).map((w) =>
      czas({ ...w }, ["updatedAt"]),
    ),
    pamiecMr: (baza.db.select().from(linkPamiecMr).all() as unknown as Wiersz[]).map((w) =>
      czas({ ...w }, ["updatedAt"]),
    ),
    nazwaPamiec: baza.db.select().from(nazwaPamiec).all() as unknown as Wiersz[],
    wagaPamiec: baza.db.select().from(wagaPamiec).all() as unknown as Wiersz[],
    // Bulk CZYTA reguły, ale nie wolno mu ich tknąć — porównujemy, żeby wykryć, gdyby
    // któraś strona zaczęła je zapisywać.
    narzuty: baza.db.select().from(markups).all() as unknown as Wiersz[],
    promocje: baza.db.select().from(promotions).all() as unknown as Wiersz[],
  };
}

/** Numery `kodImportu` obecne w katalogu wejściowym — te muszą się zgadzać dosłownie. */
function numeryZKatalogu(s: Scenariusz): Set<string> {
  return new Set(
    (s.katalog as Wiersz[])
      .map((p) => p.kodImportu)
      .filter((n): n is string => typeof n === "string"),
  );
}

describe("1. Integralność wycinka produktowego", () => {
  it("trzeci fragment mirror/backend/index.cjs zawiera to, co ma zawierać", () => {
    const { produkty, integralnosc } = wytnijFragmenty();

    expect(produkty).toContain("addProductsBulk(t){");
    expect(produkty).toContain("updateProduct(t,e){");
    expect(produkty).toContain("deleteProduct(t){");
    // Gałąź cenowa i rozszerzenia MUSZĄ być w wycinku — bez nich porównanie byłoby zielone
    // z powodu, dla którego nie chcemy, żeby było zielone.
    expect(produkty).toContain("__bridgePickMarkup");
    expect(produkty).toContain("__BRIDGE_EXT.rememberLink");
    // Kotwica końcowa nie może wciągnąć metod stagingu — te są w osobnym, starszym wycinku.
    expect(produkty).not.toContain("acceptStaging(t,e){");
    expect(integralnosc.produkty.dlugosc).toBeGreaterThan(1000);
  });
});

describe("2. addProductsBulk — port == uruchomiony oryginał", () => {
  let bazaOryginalu: TestowaBaza | null = null;
  let bazaPortu: TestowaBaza | null = null;

  afterEach(() => {
    bazaOryginalu?.posprzataj();
    bazaPortu?.posprzataj();
    bazaOryginalu = null;
    bazaPortu = null;
  });

  for (const scenariusz of SCENARIUSZE) {
    it(`${scenariusz.nazwa}: ${scenariusz.opis.split(".")[0]}`, () => {
      const numery = numeryZKatalogu(scenariusz);
      const partia = scenariusz.partia as Wiersz[];

      bazaOryginalu = stworzTestowaBaze();
      zasiej(bazaOryginalu, scenariusz);
      const { U } = zaladujOryginal(bazaOryginalu);
      const ileOryginal = U.addProductsBulk(structuredClone(partia));
      const oczekiwany = normalizuj(bazaOryginalu, numery);

      bazaPortu = stworzTestowaBaze();
      zasiej(bazaPortu, scenariusz);
      const ilePortu = dodajProduktyBulk(bazaPortu.db, structuredClone(partia));
      const nasz = normalizuj(bazaPortu, numery);

      expect(ilePortu, `${scenariusz.nazwa}: liczba przetworzonych rekordów`).toBe(ileOryginal);
      expect(nasz.produkty, `${scenariusz.nazwa}: tabela products`).toEqual(oczekiwany.produkty);
      expect(nasz.pamiecKod, `${scenariusz.nazwa}: link_pamiec_kod`).toEqual(oczekiwany.pamiecKod);
      expect(nasz.pamiecMr, `${scenariusz.nazwa}: link_pamiec_mr`).toEqual(oczekiwany.pamiecMr);
      expect(nasz.nazwaPamiec, `${scenariusz.nazwa}: nazwa_pamiec`).toEqual(
        oczekiwany.nazwaPamiec,
      );
      expect(nasz.wagaPamiec, `${scenariusz.nazwa}: waga_pamiec`).toEqual(oczekiwany.wagaPamiec);
      expect(nasz.narzuty, `${scenariusz.nazwa}: tabela markups`).toEqual(oczekiwany.narzuty);
      expect(nasz.promocje, `${scenariusz.nazwa}: tabela promotions`).toEqual(
        oczekiwany.promocje,
      );
    });
  }
});

describe("3. Przydatność próby — zielony wynik nie może brać się z pustego przebiegu", () => {
  it("scenariusze pokrywają wszystkie gałęzie addProductsBulk", () => {
    const nazwy = SCENARIUSZE.map((s) => s.nazwa);
    for (const wymagana of [
      "nowy-produkt-wchodzi-do-katalogu",
      "istniejacy-produkt-jest-aktualizowany",
      "rekord-bez-kodu-jest-pomijany",
      "wartosci-domyslne-gdy-pozycja-jest-uboga",
      "cena-sprzedazy-liczy-sie-z-narzutu-25-procent",
      "zerowa-cena-zakupu-odcina-galaz-cenowa",
      "narzut-globalny-ustala-cene",
      "narzut-i-promocja-mnoza-sie-po-kolei",
      "sama-promocja-obniza-cene-przy-zerowym-narzucie",
      "regula-nadpisuje-cene-sprzedazy-z-pozycji",
      "kod-importu-dziedziczy-sie-po-grupie-ean",
      "link-zdjecia-wraca-z-pamieci-po-kodzie",
      "waga-wraca-z-pamieci-gdy-partia-jej-nie-niesie",
      "nazwa-wraca-z-pamieci-po-kodzie-importu",
      "partia-wielu-pozycji-idzie-w-jednej-transakcji",
      "wymiary-paczki-licza-sie-z-rozmiaru",
    ]) {
      expect(nazwy, `brak scenariusza ${wymagana}`).toContain(wymagana);
    }
  });

  /**
   * ⭐ KONTROLA NEGATYWNA GAŁĘZI CENOWEJ. Porównanie „port == oryginał" bywa zielone także
   * wtedy, gdy OBIE strony nic nie robią. Ten test mierzy co innego: że reguła w tabeli
   * FAKTYCZNIE zmienia wynik względem domyślnego `zakup × 1,25`, i to na uruchomionym
   * ORYGINALE. Gdyby kotwice rozjechały się tak, że pomocnicy przestaną się ładować, test
   * porównawczy dalej byłby zielony — a ten zapali.
   */
  it("reguła w tabeli realnie zmienia cenę liczoną przez ORYGINAŁ", () => {
    const scenariusz = SCENARIUSZE.find((s) => s.nazwa === "narzut-globalny-ustala-cene")!;
    const baza = stworzTestowaBaze();
    try {
      zasiej(baza, scenariusz);
      const { U } = zaladujOryginal(baza);
      U.addProductsBulk(structuredClone(scenariusz.partia as Wiersz[]));

      const produkt = baza.db.select().from(products).all()[0] as unknown as Wiersz;
      // floor(1000 × 1,06 × 1,23) = 1303 — a nie 1250 (zakup × 1,25) i nie 1303,8.
      expect(produkt.cenaSprzedazy, "narzut 6% nie wszedł w cenę").toBe(1303);
      expect(produkt.marzaPct, "marża powinna przyjąć PROCENT NARZUTU").toBe(6);
      expect(produkt.cenaSprzedazy).not.toBe(1250);
    } finally {
      baza.posprzataj();
    }
  });

  it("oryginał realnie coś robi — produkt powstaje i licznik go zlicza", () => {
    const baza = stworzTestowaBaze();
    try {
      zasiej(baza, SCENARIUSZE[0]!);
      const { U } = zaladujOryginal(baza);
      const ile = U.addProductsBulk(structuredClone(SCENARIUSZE[0]!.partia as Wiersz[]));
      expect(ile).toBe(1);
      expect(baza.db.select().from(products).all()).toHaveLength(1);
    } finally {
      baza.posprzataj();
    }
  });

  /**
   * Rozszerzenia `bridge_ext` MUSZĄ się wykonać po obu stronach. Gdyby port przestał je wołać
   * (albo `uchwytSqlite()` zaczął oddawać coś, czego `bridge_ext` nie rozumie), porównanie
   * stanu byłoby zielone, bo obie strony miałyby puste kolumny — a to nie to samo co zgodność.
   */
  it("applyDims realnie wypełnia wymiary paczki w ORYGINALE", () => {
    const scenariusz = SCENARIUSZE.find((s) => s.nazwa === "wymiary-paczki-licza-sie-z-rozmiaru")!;
    const baza = stworzTestowaBaze();
    try {
      zasiej(baza, scenariusz);
      const { U } = zaladujOryginal(baza);
      U.addProductsBulk(structuredClone(scenariusz.partia as Wiersz[]));

      const produkt = baza.db.select().from(products).all()[0] as unknown as Wiersz;
      expect(produkt.dlugosc, "applyDims nie policzył wymiarów").not.toBeNull();
      expect(Number(produkt.dlugosc)).toBeGreaterThan(0);
    } finally {
      baza.posprzataj();
    }
  });
});
