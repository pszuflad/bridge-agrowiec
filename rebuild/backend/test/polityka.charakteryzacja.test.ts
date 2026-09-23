/**
 * GATE KARTY I15.4c — charakteryzacja polityki stagingu na URUCHOMIONYM oryginale.
 *
 * Dla `checkAcceptance` i czterech tras polityki nie ma ani nagrań w `contract/fixtures/`,
 * ani wpisów w `contract/openapi.yaml` — nie ma więc czego „porównać z nagraniem". Decyzją
 * użytkownika (plan.md D129.5) dowodem wierności jest URUCHOMIONY `staging_policy.cjs`
 * @ 88fa31c, zainstalowany dokładnie tak, jak robi to produkcja przy starcie.
 *
 * METODA (ta sama co w 3c/3d-1/3d-2): dwie identycznie zasiane bazy, po jednej dla oryginału
 * i dla portu, ta sama akcja po obu stronach, porównanie KOŃCOWEGO STANU BAZY oraz
 * RZUCONEGO KOMUNIKATU. Nie wpisujemy ręcznie, co „powinno wyjść".
 *
 * Dzięki temu test pilnuje naraz trzech rzeczy, których code review nie złapie:
 *  • komunikaty blokad co do znaku (siedem `fail()` w `checkAcceptance`),
 *  • kolejność blokad (pozycja z kilkoma wadami musi zgłosić tę samą, pierwszą),
 *  • skutki uboczne w pięciu tabelach polityki, nie tylko odpowiedź.
 */
import { afterEach, describe, expect, it } from "vitest";

import {
  productAutoSuspensions,
  products,
  stagingAbsenceDecisions,
  stagingItems,
  stagingMatches,
} from "../src/db/schema.js";
import { version } from "../src/import/polityka/helpery.js";
import { zatwierdzPozycjeZPolityka } from "../src/import/polityka/akceptacja.js";
import { rozstrzygnijZgloszenie } from "../src/import/polityka/zgloszenia.js";
import {
  wybierzKarteNieobecnej,
  zamknijPrzegladNieobecnej,
} from "../src/import/polityka/nieobecne.js";
import { stworzTestowaBaze, type TestowaBaza } from "./gate/baza.js";
import { zaladujPolityke } from "./charakteryzacja/polityka/oryginal.mjs";
import { pozycja, produkt } from "./charakteryzacja/akceptacja/scenariusze.mjs";

type Wiersz = Record<string, unknown>;

/** Ten sam EAN, który `pozycja()` wpisuje do snapshotu — potrzebny do kontroli „ta sama opona". */
const EAN_KARTY = "5901234123457";

const ZNACZNIK_CZASU = "<czas przebiegu>";
const ZNACZNIK_LOSOWY = "<losowy numer sześciocyfrowy>";

const otwarte: TestowaBaza[] = [];
afterEach(() => {
  for (const baza of otwarte.splice(0)) baza.posprzataj();
});

/** Zrzut wszystkich tabel, których dotyka polityka — z zamaskowaniem wartości niestabilnych. */
function stan(baza: TestowaBaza, numeryZKatalogu: Set<string>) {
  const maskuj = (w: Wiersz) => {
    const kopia = { ...w };
    for (const pole of ["dataAktualizacji", "suspendedAt", "decidedAt", "createdAt", "utworzono"]) {
      if (typeof kopia[pole] === "string") kopia[pole] = ZNACZNIK_CZASU;
    }
    if (
      typeof kopia.kodImportu === "string" &&
      /^\d{6}$/.test(kopia.kodImportu) &&
      !numeryZKatalogu.has(kopia.kodImportu)
    ) {
      kopia.kodImportu = ZNACZNIK_LOSOWY;
    }
    return kopia;
  };
  return {
    produkty: (baza.db.select().from(products).all() as unknown as Wiersz[]).map(maskuj),
    staging: (baza.db.select().from(stagingItems).all() as unknown as Wiersz[]).map(maskuj),
    dopasowania: (baza.db.select().from(stagingMatches).all() as unknown as Wiersz[]).map(maskuj),
    wstrzymania: (
      baza.db.select().from(productAutoSuspensions).all() as unknown as Wiersz[]
    ).map(maskuj),
    decyzje: (
      baza.db.select().from(stagingAbsenceDecisions).all() as unknown as Wiersz[]
    ).map(maskuj),
  };
}

type Zasiew = { katalog?: Wiersz[]; staging?: Wiersz[] };
type Akcja = "accept" | "resolve" | "close" | "choose";

/**
 * Uruchamia TĘ SAMĄ akcję po obu stronach na identycznie zasianych bazach.
 *
 * `argumenty` dostają `id` pierwszej pozycji stagingu — dzięki temu scenariusz nie musi
 * znać identyfikatorów nadanych przez bazę.
 */
function obieStrony(
  zasiew: Zasiew,
  akcja: Akcja,
  argumenty: (id: number) => unknown[] = () => [],
) {
  const numery = new Set(
    (zasiew.katalog ?? [])
      .map((p) => p.kodImportu)
      .filter((n): n is string => typeof n === "string"),
  );

  const zasiejBaze = (baza: TestowaBaza) => {
    if (zasiew.katalog?.length) baza.db.insert(products).values(zasiew.katalog as never).run();
    if (zasiew.staging?.length) baza.db.insert(stagingItems).values(zasiew.staging as never).run();
    const pierwsza = baza.db.select().from(stagingItems).all()[0] as { id: number } | undefined;
    return pierwsza?.id ?? 9999;
  };

  const zlap = (f: () => void) => {
    try {
      f();
      return null;
    } catch (e) {
      return {
        message: e instanceof Error ? e.message : String(e),
        status: (e as { status?: number }).status ?? null,
      };
    }
  };

  const bazaOryginalu = stworzTestowaBaze();
  const bazaPortu = stworzTestowaBaze();
  otwarte.push(bazaOryginalu, bazaPortu);

  const idOryginalu = zasiejBaze(bazaOryginalu);
  const { U } = zaladujPolityke(bazaOryginalu);
  const argsO = argumenty(idOryginalu);
  const bladOryginalu = zlap(() => {
    if (akcja === "accept") U.acceptStaging(idOryginalu, 1);
    else if (akcja === "resolve") U.resolveStaging(idOryginalu, ...argsO);
    else if (akcja === "close") U.closeAbsenceReview(idOryginalu);
    else U.chooseAbsenceCard(idOryginalu, ...argsO);
  });

  const idPortu = zasiejBaze(bazaPortu);
  const argsP = argumenty(idPortu);
  const bladPortu = zlap(() => {
    if (akcja === "accept") zatwierdzPozycjeZPolityka(bazaPortu.db, idPortu, 1);
    else if (akcja === "resolve")
      rozstrzygnijZgloszenie(bazaPortu.db, idPortu, argsP[0], argsP[1]);
    else if (akcja === "close") zamknijPrzegladNieobecnej(bazaPortu.db, idPortu);
    else wybierzKarteNieobecnej(bazaPortu.db, idPortu, argsP[0], argsP[1]);
  });

  return {
    oryginal: { blad: bladOryginalu, stan: stan(bazaOryginalu, numery) },
    port: { blad: bladPortu, stan: stan(bazaPortu, numery) },
  };
}

/** Skrót: obie strony muszą zgłosić to samo i zostawić bazę w tym samym stanie. */
function zgodne(wynik: ReturnType<typeof obieStrony>) {
  expect(wynik.port.blad, "komunikat i status muszą być identyczne").toEqual(wynik.oryginal.blad);
  expect(wynik.port.stan, "stan bazy musi być identyczny").toEqual(wynik.oryginal.stan);
}

/** Kompletna pozycja Staging v2 — przechodzi wszystkie siedem blokad. */
function pozycjaV2(pola: Record<string, unknown> = {}) {
  const wlasnySnapshot = (pola.snapshot ?? {}) as Record<string, unknown>;
  return pozycja({
    ...pola,
    snapshot: { _policyVersion: 2, _catalogVersion: null, ...wlasnySnapshot },
  }) as Wiersz;
}

describe("GATE — siedem blokad `checkAcceptance` zgadza się z oryginałem co do znaku", () => {
  it("1/7 brak wiersza", () => {
    zgodne(obieStrony({}, "accept"));
  });

  it("2/7 sprawa starej karty (`_absenceReview`)", () => {
    zgodne(
      obieStrony({ staging: [pozycjaV2({ snapshot: { _absenceReview: true } })] }, "accept"),
    );
  });

  it("3/7 wycofanie bez trzech dowodów nieobecności", () => {
    zgodne(
      obieStrony(
        {
          katalog: [produkt({}) as Wiersz],
          staging: [
            pozycjaV2({ typZmiany: "wycofana", snapshot: { _absenceEvidence: ["a", "b"] } }),
          ],
        },
        "accept",
      ),
    );
  });

  it("4/7 zgłoszenie ze starego importu (brak `_policyVersion`)", () => {
    zgodne(obieStrony({ staging: [pozycja({}) as Wiersz] }, "accept"));
  });

  it("5/7 nierozstrzygnięte dopasowanie", () => {
    zgodne(
      obieStrony({ staging: [pozycjaV2({ snapshot: { _matchIssue: "ambiguous" } })] }, "accept"),
    );
  });

  it("6/7 błędny EAN (decyzja D4)", () => {
    zgodne(
      obieStrony(
        { staging: [pozycjaV2({ snapshot: { ean: "123", eanRaw: "8,05997E+12" } })] },
        "accept",
      ),
    );
  });

  it("7/7 produkt zmienił się po utworzeniu zgłoszenia", () => {
    zgodne(
      obieStrony(
        {
          katalog: [produkt({}) as Wiersz],
          // W katalogu produkt JEST, więc `version(current)` nie jest `null` — a snapshot
          // niesie `null`. To właśnie ten rozjazd blokuje akceptację.
          staging: [pozycjaV2({ typZmiany: "zmiana_kluczowa" })],
        },
        "accept",
      ),
    );
  });

  it("kolejność blokad — pozycja z KILKOMA wadami zgłasza tę samą, pierwszą", () => {
    const wynik = obieStrony(
      {
        staging: [
          pozycjaV2({
            snapshot: {
              _absenceReview: true,
              _matchIssue: "ambiguous",
              ean: "123",
              eanRaw: "8,05997E+12",
            },
          }),
        ],
      },
      "accept",
    );
    zgodne(wynik);
    expect(wynik.port.blad?.message).toContain("Ta stara karta wymaga porównania");
  });
});

describe("GATE — akceptacja, która przechodzi", () => {
  it("pozycja kompletna wg Staging v2 wchodzi do katalogu identycznie jak u produkcji", () => {
    const wynik = obieStrony({ staging: [pozycjaV2({})] }, "accept");
    zgodne(wynik);
    expect(wynik.port.blad, "nic nie miało zostać zablokowane").toBeNull();
    expect(wynik.port.stan.produkty).toHaveLength(1);
    expect(wynik.port.stan.staging, "pozycja znika po akceptacji").toHaveLength(0);
  });

  it("świadome rozstrzygnięcie zapamiętuje się w `staging_matches`", () => {
    const wynik = obieStrony(
      { staging: [pozycjaV2({ snapshot: { _resolution: "new", _sourceKey: "KLUCZ-1" } })] },
      "accept",
    );
    zgodne(wynik);
    expect(wynik.port.stan.dopasowania).toHaveLength(1);
  });
});

describe("GATE — `resolveStaging`", () => {
  it("`new` zakłada nowe zgłoszenie zamiast edytować stare", () => {
    zgodne(
      obieStrony(
        { staging: [pozycjaV2({ snapshot: { _matchIssue: "ambiguous" } })] },
        "resolve",
        () => ["new", undefined],
      ),
    );
  });

  it("`link` z kandydatem tego dostawcy", () => {
    zgodne(
      obieStrony(
        {
          katalog: [produkt({ kod: "P9" }) as Wiersz],
          staging: [
            pozycjaV2({
              snapshot: { _matchIssue: "ambiguous", _candidates: [{ kod: "P9" }] },
            }),
          ],
        },
        "resolve",
        () => ["link", "P9"],
      ),
    );
  });

  it("`link` na kod spoza listy kandydatów jest odrzucany", () => {
    zgodne(
      obieStrony(
        {
          katalog: [produkt({ kod: "P9" }) as Wiersz],
          staging: [pozycjaV2({ snapshot: { _matchIssue: "ambiguous", _candidates: [] } })],
        },
        "resolve",
        () => ["link", "P9"],
      ),
    );
  });

  it("nieznana decyzja", () => {
    zgodne(
      obieStrony(
        { staging: [pozycjaV2({ snapshot: { _matchIssue: "ambiguous" } })] },
        "resolve",
        () => ["cokolwiek", undefined],
      ),
    );
  });

  it("zgłoszenie bez `_matchIssue` nie wymaga rozstrzygnięcia", () => {
    zgodne(obieStrony({ staging: [pozycjaV2({})] }, "resolve", () => ["new", undefined]));
  });

  it("sprzeczne wiersze dostawcy blokują rozstrzygnięcie", () => {
    zgodne(
      obieStrony(
        {
          staging: [
            pozycjaV2({ snapshot: { _matchIssue: "ambiguous", _duplicateSource: true } }),
          ],
        },
        "resolve",
        () => ["new", undefined],
      ),
    );
  });
});

describe("GATE — decyzje o nieobecnych kartach (#106)", () => {
  /**
   * Stara karta: wstrzymana, stan 0 — taką sprawę zakłada importer.
   *
   * ⚠ `id` PODANE JAWNIE, i to jest istotne: `version()` (`staging_policy.cjs:71`) liczy
   * odcisk z `[p.id, …]`, więc snapshot musi nieść odcisk WIERSZA, a nie obiektu sprzed
   * zapisu. Bez jawnego `id` scenariusz cicho wpada w blokadę „dane starej karty się
   * zmieniły" i testuje coś zupełnie innego, niż zamierzał.
   */
  const staraKarta = () =>
    produkt({
      id: 1,
      kod: "P1",
      status: "wstrzymany",
      stan: 0,
      dot: "1223",
      // ⚠ `model` i `ean` MUSZĄ zgadzać się ze snapshotem zgłoszenia. `chooseAbsenceCard`
      // (`:271`) sprawdza `[...KEYS,'dot','ean']` polem po polu i przy pierwszej różnicy
      // odmawia („Dane starej karty zmieniły się"). Domyślny `produkt()` nie ma ani `model`,
      // ani `ean`, więc bez tego scenariusz padałby na tej kontroli zamiast dojść do wyboru.
      model: "AGRIMAX RT 765",
      ean: EAN_KARTY,
    }) as Wiersz;

  /**
   * ⚠ Kandydat musi nieść `rozmiar`. Filtr `options` (`:274-279`) porównuje ZAPAMIĘTANY
   * rozmiar kandydata z rozmiarem jego żywej karty; kandydat bez tego pola odpada na
   * kontroli rozmiaru i sprawa kończy się komunikatem o „różnym DOT", choć DOT jest zgodny.
   */
  const zgloszenieSprawy = (kandydaci: Wiersz[], dodatki: Record<string, unknown> = {}) =>
    pozycjaV2({
      snapshot: {
        _absenceReview: true,
        _catalogVersion: version(staraKarta()),
        dot: "1223",
        _candidates: kandydaci,
        ...dodatki,
      },
    });

  it("zamknięcie sprawy bez scalania zapisuje decyzję i kasuje zgłoszenie", () => {
    const wynik = obieStrony(
      { katalog: [staraKarta()], staging: [zgloszenieSprawy([{ kod: "P2", ean: null, dot: "1223", rozmiar: "480/70R28" }])] },
      "close",
    );
    zgodne(wynik);
    expect(wynik.port.stan.decyzje).toHaveLength(1);
    expect(
      wynik.port.stan.decyzje[0]!.selectedSourceCode,
      "zamknięcie bez wyboru nie ustawia kodu źródłowego",
    ).toBeNull();
  });

  it("zgłoszenie, które nie jest sprawą starej karty", () => {
    zgodne(obieStrony({ katalog: [staraKarta()], staging: [pozycjaV2({})] }, "close"));
  });

  it("RÓŻNY DOT — tych opon nie wolno połączyć", () => {
    zgodne(
      obieStrony(
        {
          katalog: [
            staraKarta(),
            produkt({ id: 2, kod: "P2", dot: "0124", status: "aktywny" }) as Wiersz,
          ],
          staging: [zgloszenieSprawy([{ kod: "P2", ean: null, dot: "0124", rozmiar: "480/70R28" }])],
        },
        "choose",
        () => ["P2", "cokolwiek"],
      ),
    );
  });

  it("wybór karty z bieżącej oferty — stara zostaje wstrzymana, kod źródłowy wyzerowany", () => {
    const kandydat = produkt({ id: 2, kod: "P2", dot: "1223", status: "aktywny" }) as Wiersz;
    const wynik = obieStrony(
      {
        katalog: [staraKarta(), kandydat],
        staging: [zgloszenieSprawy([{ kod: "P2", ean: null, dot: "1223", rozmiar: "480/70R28" }])],
      },
      "choose",
      () => ["P2", version(kandydat)],
    );
    zgodne(wynik);
    expect(wynik.port.blad, "wybór miał przejść").toBeNull();
    expect(wynik.port.stan.decyzje).toHaveLength(1);
    expect(wynik.port.stan.decyzje[0]!.selectedSourceCode).toBeNull();
  });

  it("wybór STAREJ karty — przejmuje ofertę, kandydat wstrzymany, kod źródłowy zapamiętany", () => {
    // To jest gałąź, w której #106 zapamiętuje `selected_source_code` (indeks unikalny
    // `staging_absence_one_choice` pilnuje, żeby jeden kod źródłowy nie trafił do dwóch kart).
    // Wymaga ŚWIEŻEGO odczytu oferty: `sourceKey` + `stan` + `cenaZakupu` na kandydacie.
    const kandydat = produkt({ id: 2, kod: "P2", dot: "1223", status: "aktywny" }) as Wiersz;
    const wynik = obieStrony(
      {
        katalog: [staraKarta(), kandydat],
        staging: [
          zgloszenieSprawy([
            {
              kod: "P2",
              ean: null,
              dot: "1223",
              rozmiar: "480/70R28",
              sourceKey: "KLUCZ-9",
              stan: 7,
              cenaZakupu: 900,
            },
          ]),
        ],
      },
      "choose",
      () => ["P1", version(kandydat)],
    );
    zgodne(wynik);
    expect(wynik.port.blad, "wybór starej karty miał przejść").toBeNull();

    const stara = wynik.port.stan.produkty.find((p) => p.kod === "P1")!;
    const drugi = wynik.port.stan.produkty.find((p) => p.kod === "P2")!;
    expect(stara.status, "stara karta przejmuje bieżącą ofertę").toBe("aktywny");
    expect(stara.stan).toBe(7);
    expect(stara.cenaZakupu).toBe(900);
    expect(drugi.status, "niewybrana karta zostaje wstrzymana").toBe("wstrzymany");
    expect(wynik.port.stan.wstrzymania, "i to wstrzymanie jest AUTOMATYCZNE").toHaveLength(1);
    expect(wynik.port.stan.decyzje[0]!.selectedSourceCode, "zapamiętany kod źródłowy").toBe("P2");
    expect(wynik.port.stan.dopasowania[0]!.productCode, "oferta przypięta do starej karty").toBe(
      "P1",
    );
  });

  it("nieaktualny odcisk kandydata zatrzymuje wybór", () => {
    zgodne(
      obieStrony(
        {
          katalog: [
            staraKarta(),
            produkt({ id: 2, kod: "P2", dot: "1223", status: "aktywny" }) as Wiersz,
          ],
          staging: [zgloszenieSprawy([{ kod: "P2", ean: null, dot: "1223", rozmiar: "480/70R28" }])],
        },
        "choose",
        () => ["P2", "odcisk-sprzed-zmiany"],
      ),
    );
  });
});
