/**
 * GATE ITERACJI 3d-2 — dowód, że nasz `acceptStaging` zachowuje się jak produkcja.
 *
 * METODA, TA SAMA CO W 3c I 3d-1: nie porównujemy kodu, tylko ZACHOWANIE uruchomionego
 * oryginału. Różnica jest w sposobie cięcia — `tk()` dało się wyciąć jako samodzielną funkcję
 * i nakarmić atrapami, a `acceptStaging` jest metodą obiektu, która rozmawia wprost z Drizzle.
 * Dlatego tutaj oryginał dostaje PRAWDZIWĄ bazę zbudowaną z naszego kanonu (`oryginal.mjs`),
 * a porównujemy KOŃCOWY STAN DWÓCH IDENTYCZNIE ZASIANYCH BAZ.
 *
 * To jest mocniejsze niż porównanie śladów wywołań: mierzy skutek, a nie drogę do niego.
 *
 * ⭐ ROZSZERZONA W ITERACJI 4a — GAŁĄŹ CENOWA JEST TERAZ REALNIE MIERZONA. Do 4a wszystkie
 * scenariusze miały `markups`/`promotions` PUSTE: oryginał wykonywał pełną gałąź cenową
 * (`__bridgePickMarkup`/`__bridgePickPromo` są wycięte NAPRAWDĘ, nie jako zaślepki) i wychodził
 * z niej bez zmiany — tak samo jak nasz port, który tej gałęzi wtedy nie miał. To dowodziło
 * decyzji D3 z I3, ale ZA CENĘ TEGO, ŻE SAMEJ FORMUŁY NIKT NIE SPRAWDZAŁ.
 *
 * 4a wpina gałąź do portu (`src/import/akceptacja.ts`) i dokłada trzynaście scenariuszy
 * z regułami w obu tabelach. Od tej chwili test mierzy to, na co czekał: czy port liczy ceny
 * TYMI SAMYMI liczbami co produkcja — priorytety, specyficzność reguł, `floor`, VAT,
 * i te miejsca, w których oryginał zachowuje się nieoczywiście (wygasła promocja dalej działa,
 * reguła nadpisuje cenę wpisaną ręcznie). Kontrola negatywna w `describe 3` pilnuje, że nowa
 * próba nie jest pusta.
 */
import { afterEach, describe, expect, it } from "vitest";

import { zatwierdzPozycjeStagingu } from "../src/import/akceptacja.js";
import {
  linkPamiecKod,
  linkPamiecMr,
  manualOverrides,
  markups,
  nazwaPamiec,
  products,
  promotions,
  stagingItems,
  wagaPamiec,
} from "../src/db/schema.js";
import { stworzTestowaBaze, type TestowaBaza } from "./gate/baza.js";
import { wytnijFragmenty, zaladujOryginal } from "./charakteryzacja/akceptacja/oryginal.mjs";
import { SCENARIUSZE } from "./charakteryzacja/akceptacja/scenariusze.mjs";

type Wiersz = Record<string, unknown>;
type Scenariusz = (typeof SCENARIUSZE)[number];

/** Znacznik podstawiany za wartości, których nie da się porównać między przebiegami. */
const ZNACZNIK_CZASU = "<czas przebiegu>";
const ZNACZNIK_LOSOWY = "<losowy numer sześciocyfrowy>";

/** Zasiewa bazę stanem wejściowym scenariusza. Obie strony dostają dokładnie to samo. */
function zasiej(baza: TestowaBaza, s: Scenariusz): number {
  const wstaw = (tabela: never, wiersze?: Wiersz[]) => {
    if (wiersze?.length) baza.db.insert(tabela).values(wiersze as never).run();
  };
  wstaw(products as never, s.katalog as Wiersz[]);
  wstaw(manualOverrides as never, (s as { overrides?: Wiersz[] }).overrides);
  wstaw(nazwaPamiec as never, (s as { nazwaPamiec?: Wiersz[] }).nazwaPamiec);
  wstaw(wagaPamiec as never, (s as { wagaPamiec?: Wiersz[] }).wagaPamiec);
  wstaw(linkPamiecKod as never, (s as { linkPamiecKod?: Wiersz[] }).linkPamiecKod);
  // Od 4a: reguły cenowe. Do tej pory obie tabele były zawsze puste, więc oryginał
  // przechodził przez gałąź `if (__mm || __pp)` bez efektu.
  wstaw(markups as never, (s as { narzuty?: Wiersz[] }).narzuty);
  wstaw(promotions as never, (s as { promocje?: Wiersz[] }).promocje);

  baza.db.insert(stagingItems).values(s.pozycja as never).run();
  return (baza.db.select().from(stagingItems).all()[0] as { id: number }).id;
}

/**
 * Sprowadza stan bazy do postaci porównywalnej między przebiegami.
 *
 * Normalizujemy dwie rzeczy i tylko dwie:
 *  • znaczniki czasu — oryginał i port biorą `new Date()` w różnych milisekundach;
 *  • świeżo wylosowany `kod_importu` — `_kiGenUnique()` w `bridge_ext` używa `Math.random()`.
 *    ⚠ Numer ODZIEDZICZONY po grupie normalizacji NIE podlega: jest deterministyczny i to
 *    właśnie on jest w tym miejscu ciekawy, więc porównujemy go dosłownie.
 */
function normalizuj(baza: TestowaBaza, numeryZKatalogu: Set<string>) {
  const czas = (w: Wiersz, pola: string[]) => {
    for (const pole of pola) {
      const wartosc = w[pole];
      if (typeof wartosc === "string" && /^\d{4}-\d{2}-\d{2}[T ]/.test(wartosc)) {
        // Zostawiamy znaczniki zasiane ręcznie (rok 2026-01/02) — one MAJĄ się zgadzać.
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
      return w;
    })
    // `id` zależy od kolejności wstawień, a te są identyczne po obu stronach — ale wolimy
    // porównywać po `kod`, żeby diff wskazywał produkt, a nie liczbę.
    .sort((a, b) => String(a.kod).localeCompare(String(b.kod)));

  const poprawki = (baza.db.select().from(manualOverrides).all() as unknown as Wiersz[])
    .map((w) => czas({ ...w }, ["createdAt"]))
    .sort((a, b) => String(a.fieldName).localeCompare(String(b.fieldName)));

  const pamiecKod = (baza.db.select().from(linkPamiecKod).all() as unknown as Wiersz[]).map((w) =>
    czas({ ...w }, ["updatedAt"]),
  );
  const pamiecMr = (baza.db.select().from(linkPamiecMr).all() as unknown as Wiersz[]).map((w) =>
    czas({ ...w }, ["updatedAt"]),
  );

  return {
    produkty,
    staging: baza.db.select().from(stagingItems).all() as unknown as Wiersz[],
    poprawki,
    pamiecKod,
    pamiecMr,
    nazwaPamiec: baza.db.select().from(nazwaPamiec).all() as unknown as Wiersz[],
    wagaPamiec: baza.db.select().from(wagaPamiec).all() as unknown as Wiersz[],
    // Akceptacja CZYTA reguły, ale nie wolno jej ich tknąć — porównujemy, żeby wykryć,
    // gdyby któraś strona zaczęła je zapisywać.
    narzuty: baza.db.select().from(markups).all() as unknown as Wiersz[],
    promocje: baza.db.select().from(promotions).all() as unknown as Wiersz[],
  };
}

/** Numery `kod_importu` obecne w katalogu wejściowym — te muszą się zgadzać dosłownie. */
function numeryZKatalogu(s: Scenariusz): Set<string> {
  return new Set(
    (s.katalog as Wiersz[])
      .map((p) => p.kodImportu)
      .filter((n): n is string => typeof n === "string"),
  );
}

describe("1. Integralność wycinka oryginału", () => {
  it("wycięte fragmenty mirror/backend/index.cjs mają oczekiwany kształt", () => {
    const { pomocnicy, metody, integralnosc } = wytnijFragmenty();

    // Nie zamrażamy skrótu w osobnym pliku (jak w 3c/3d-1), bo porównanie jest tu ŻYWE:
    // oryginał wykonuje się przy każdym teście. Pilnujemy natomiast, że wycięliśmy to,
    // co trzeba — gdyby kotwice złapały inny fragment, te asercje zapalą.
    expect(pomocnicy).toContain("__bridgePickMarkup");
    expect(pomocnicy).toContain("__bridgePickPromo");
    expect(metody).toContain("acceptStaging(t,e){");
    expect(metody).toContain("upsertOverride(t){");
    expect(integralnosc.pomocnicy.dlugosc).toBeGreaterThan(500);
    expect(integralnosc.metody.dlugosc).toBeGreaterThan(2000);
  });
});

describe("2. acceptStaging — port == uruchomiony oryginał", () => {
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

      bazaOryginalu = stworzTestowaBaze();
      const idOryginal = zasiej(bazaOryginalu, scenariusz);
      const { U } = zaladujOryginal(bazaOryginalu);
      U.acceptStaging(idOryginal, 1);
      const oczekiwany = normalizuj(bazaOryginalu, numery);

      bazaPortu = stworzTestowaBaze();
      const idPortu = zasiej(bazaPortu, scenariusz);
      zatwierdzPozycjeStagingu(bazaPortu.db, idPortu, 1);
      const nasz = normalizuj(bazaPortu, numery);

      // Porównanie tabela po tabeli, żeby diff od razu wskazywał, GDZIE się rozjechało.
      expect(nasz.produkty, `${scenariusz.nazwa}: tabela products`).toEqual(oczekiwany.produkty);
      expect(nasz.staging, `${scenariusz.nazwa}: tabela staging_items`).toEqual(oczekiwany.staging);
      expect(nasz.poprawki, `${scenariusz.nazwa}: tabela manual_overrides`).toEqual(
        oczekiwany.poprawki,
      );
      expect(nasz.pamiecKod, `${scenariusz.nazwa}: link_pamiec_kod`).toEqual(oczekiwany.pamiecKod);
      expect(nasz.pamiecMr, `${scenariusz.nazwa}: link_pamiec_mr`).toEqual(oczekiwany.pamiecMr);
      expect(nasz.nazwaPamiec, `${scenariusz.nazwa}: nazwa_pamiec`).toEqual(
        oczekiwany.nazwaPamiec,
      );
      expect(nasz.wagaPamiec, `${scenariusz.nazwa}: waga_pamiec`).toEqual(oczekiwany.wagaPamiec);
      expect(nasz.narzuty, `${scenariusz.nazwa}: tabela markups`).toEqual(oczekiwany.narzuty);
      expect(nasz.promocje, `${scenariusz.nazwa}: tabela promotions`).toEqual(oczekiwany.promocje);
    });
  }
});

describe("3. Przydatność próby — zielony wynik nie może brać się z pustego przebiegu", () => {
  it("scenariusze pokrywają wszystkie gałęzie acceptStaging", () => {
    const nazwy = SCENARIUSZE.map((s) => s.nazwa);
    for (const wymagana of [
      "nowa-pozycja-wchodzi-do-katalogu",
      "istniejaca-pozycja-jest-aktualizowana",
      "wycofana-wstrzymuje-zamiast-kasowac",
      "konflikt-z-poprawka-marty-zostaje-potwierdzony",
      "uwaga-cena-ze-snapshotu-trafia-do-kolumny",
      "kod-importu-dziedziczy-sie-po-grupie-ean",
      // Gałąź cenowa (4a) — bez tych nazw zielony wynik znów znaczyłby tylko „tabele puste".
      "narzut-globalny-ustala-cene",
      "narzut-specyficzny-bije-globalny-mimo-nizszego-priorytetu",
      "narzut-z-warunkami-jest-koniunkcja",
      "sama-promocja-obniza-cene-przy-zerowym-narzucie",
      "narzut-i-promocja-mnoza-sie-po-kolei",
      "promocja-wygasla-nadal-obniza-cene",
      "regula-nadpisuje-cene-sprzedazy-z-pozycji",
      "regula-nie-wchodzi-przy-zerowej-cenie-zakupu",
    ]) {
      expect(nazwy, `brak scenariusza ${wymagana}`).toContain(wymagana);
    }
  });

  /**
   * ⭐ KONTROLA NEGATYWNA GAŁĘZI CENOWEJ. Porównanie „port == oryginał" jest zielone także
   * wtedy, gdy OBIE strony nic nie robią — a dokładnie tak wyglądała ta próba przed 4a.
   * Ten test mierzy więc coś innego: że reguła w tabeli FAKTYCZNIE zmienia wynik względem
   * domyślnego `zakup × 1,25`, i to na uruchomionym ORYGINALE, nie na naszym porcie.
   * Gdyby ktoś kiedyś rozjechał kotwice w `oryginal.mjs` tak, że pomocnicy przestaną się
   * ładować, tamten test dalej byłby zielony — a ten zapali.
   */
  it("reguła w tabeli realnie zmienia cenę liczoną przez ORYGINAŁ", () => {
    const scenariusz = SCENARIUSZE.find((s) => s.nazwa === "narzut-globalny-ustala-cene")!;
    const baza = stworzTestowaBaze();
    try {
      const id = zasiej(baza, scenariusz);
      const { U } = zaladujOryginal(baza);
      U.acceptStaging(id, 1);

      const produkt = baza.db.select().from(products).all()[0] as unknown as Wiersz;
      // floor(1000 × 1,06 × 1,23) = 1303 — a nie 1250 (zakup × 1,25) i nie 1303,8.
      expect(produkt.cenaSprzedazy, "narzut 6% nie wszedł w cenę").toBe(1303);
      expect(produkt.marzaPct, "marża powinna przyjąć PROCENT NARZUTU").toBe(6);
      expect(produkt.cenaSprzedazy).not.toBe(1250);
    } finally {
      baza.posprzataj();
    }
  });

  it("oryginał realnie coś robi — produkt powstaje, a wiersz stagingu znika", () => {
    const baza = stworzTestowaBaze();
    try {
      const id = zasiej(baza, SCENARIUSZE[0]!);
      const { U } = zaladujOryginal(baza);
      U.acceptStaging(id, 1);
      expect(baza.db.select().from(products).all()).toHaveLength(1);
      expect(baza.db.select().from(stagingItems).all()).toHaveLength(0);
    } finally {
      baza.posprzataj();
    }
  });
});
