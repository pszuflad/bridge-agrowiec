// Scenariusze celowane w gałęzie `acceptStaging`.
//
// Każdy scenariusz opisuje STAN WEJŚCIOWY (katalog, poprawki Marty, pamięci `bridge_ext`
// i jedną pozycję stagingu). Test uruchamia na nim ORYGINAŁ wycięty z bundla i NASZ port —
// na dwóch identycznie zasianych bazach — i porównuje końcowy stan obu.
//
// Oczekiwań NIE piszemy ręcznie: wzorcem jest zachowanie uruchomionego oryginału.

const EAN = "5901234123457";
const EAN_2 = "5901234123464";

/** Wiersz `products` z sensownymi wartościami domyślnymi. */
export function produkt(pola) {
  return {
    kod: "P1",
    nazwa: "Opona 480/70R28 BKT AGRIMAX RT 765",
    marka: "BKT",
    kategoria: "Rolnicze",
    dostawca: "MO5",
    magazyn: "PL",
    stan: 4,
    cenaZakupu: 1000,
    cenaSprzedazy: 1300,
    marzaPct: 30,
    vat: 23,
    status: "aktywny",
    rozmiar: "480/70R28",
    dataAktualizacji: "2026-01-01T00:00:00.000Z",
    ...pola,
  };
}

/** Wiersz `staging_items` — kształt taki, jaki produkuje silnik z 3d-1. */
export function pozycja(pola) {
  const snapshot = {
    kod: "P1",
    nazwa: "Opona 480/70R28 BKT AGRIMAX RT 765",
    marka: "BKT",
    model: "AGRIMAX RT 765",
    kategoria: "Rolnicze",
    rozmiar: "480/70R28",
    ean: EAN,
    eanIsValid: 1,
    uwagaCena: null,
    ...(pola.snapshot ?? {}),
  };
  const { snapshot: _pominiete, ...reszta } = pola;
  return {
    typZmiany: "nowa",
    kod: "P1",
    nazwa: "Opona 480/70R28 BKT AGRIMAX RT 765",
    dostawca: "MO5",
    magazyn: "PL",
    stanNowy: 4,
    cenaZakupuNowa: 1000,
    utworzono: "2026-02-01T00:00:00.000Z",
    ...reszta,
    snapshotJson: JSON.stringify(snapshot),
  };
}

/** Wiersz `markups`. `zakres` i `wartosc` są NOT NULL, reszta ma sensowne domyślne. */
export function narzut(pola) {
  return {
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

/**
 * Wiersz `promotions`. `start`/`koniec` są NOT NULL, ale silnik ich NIE CZYTA — patrz
 * scenariusz `promocja-wygasla-nadal-obniza-cene`.
 */
export function promocja(pola) {
  return {
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

export const SCENARIUSZE = [
  {
    nazwa: "nowa-pozycja-wchodzi-do-katalogu",
    opis:
      "Pozycji nie ma w katalogu → INSERT z wartościami domyślnymi: cena sprzedaży = zakup × 1,25, " +
      "marża 25, kategoria „Rolnicze\", marka z pierwszego słowa nazwy, VAT 23.",
    katalog: [],
    pozycja: pozycja({}),
  },
  {
    nazwa: "istniejaca-pozycja-jest-aktualizowana",
    opis: "Produkt o tym samym `kod` już jest → UPDATE, nie drugi wiersz.",
    katalog: [produkt({ cenaZakupu: 900, stan: 1 })],
    pozycja: pozycja({ cenaZakupuNowa: 1234.5, stanNowy: 9 }),
  },
  {
    nazwa: "wycofana-wstrzymuje-zamiast-kasowac",
    opis:
      "`typZmiany: wycofana` → produkt dostaje `status: wstrzymany` i `stan: 0`, ale ZOSTAJE " +
      "w katalogu. Gałąź kończy się wcześnie, więc żadne rozszerzenia się nie wykonują.",
    katalog: [produkt({ stan: 7, status: "aktywny" })],
    pozycja: pozycja({ typZmiany: "wycofana", stanNowy: 0, cenaZakupuNowa: null }),
  },
  {
    nazwa: "wycofana-bez-produktu-w-katalogu",
    opis: "Wycofanie pozycji, której w katalogu nie ma — kasuje wiersz stagingu i nic więcej.",
    katalog: [],
    pozycja: pozycja({ typZmiany: "wycofana", kod: "NIEISTNIEJE" }),
  },
  {
    nazwa: "konflikt-z-poprawka-marty-zostaje-potwierdzony",
    opis:
      "⭐ Domknięcie pętli z 3d-1: `_srcConflict` ze snapshotu trafia do " +
      "`manual_overrides.acknowledgedSourceValue`, więc ten sam konflikt nie zaalarmuje " +
      "przy następnym imporcie. Sama poprawka zostaje nietknięta.",
    katalog: [produkt({ model: "MODEL OD MARTY" })],
    overrides: [
      {
        supplierKod: "MO5",
        supplierProductId: "P1",
        fieldName: "model",
        overrideValue: "MODEL OD MARTY",
        reason: "edycja w katalogu",
        createdBy: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    pozycja: pozycja({
      typZmiany: "blad",
      snapshot: { model: "MODEL OD MARTY", _srcConflict: { model: "MODEL Z PLIKU" } },
    }),
  },
  {
    nazwa: "konflikt-bez-istniejacej-poprawki-nic-nie-tworzy",
    opis:
      "`_srcConflict` wskazuje pole, dla którego poprawki NIE MA — oryginał tylko szuka " +
      "i nic nie zapisuje (`if (_ov)`). Nie wolno tu tworzyć poprawki z powietrza.",
    katalog: [produkt({})],
    pozycja: pozycja({ snapshot: { _srcConflict: { model: "MODEL Z PLIKU" } } }),
  },
  {
    nazwa: "cena-zero-wstrzymuje-produkt",
    opis: "Cena zakupu 0 → `status: wstrzymany`, mimo że pozycja jest zwykłą nowością.",
    katalog: [],
    pozycja: pozycja({ cenaZakupuNowa: 0 }),
  },
  {
    nazwa: "cena-sprzedazy-z-pozycji-wygrywa-nad-domyslna",
    opis:
      "Gdy staging niesie `cenaSprzedazyNowa`, nie liczy się narzutu 1,25 — ale `marzaPct` " +
      "i tak ląduje na sztywno 25. To niespójność oryginału, odtwarzana świadomie.",
    katalog: [],
    pozycja: pozycja({ cenaZakupuNowa: 1000, cenaSprzedazyNowa: 2000 }),
  },
  {
    nazwa: "uwaga-cena-ze-snapshotu-trafia-do-kolumny",
    opis: "Cena „na zapytanie\" (MO7 Nokian) przechodzi ze snapshotu do `products.uwaga_cena`.",
    katalog: [],
    pozycja: pozycja({ snapshot: { uwagaCena: "na zapytanie" } }),
  },
  {
    nazwa: "kod-importu-dziedziczy-sie-po-grupie-ean",
    opis:
      "W katalogu jest inny produkt z tym samym EAN-em i nadanym `kod_importu` → nowa pozycja " +
      "dostaje TEN SAM numer, zamiast losowego. To sedno grupowania `assignKodImportu`.",
    katalog: [
      produkt({ kod: "INNY", ean: EAN, eanIsValid: 1, kodImportu: "424242" }),
    ],
    pozycja: pozycja({ kod: "P-NOWY", snapshot: { kod: "P-NOWY", ean: EAN, eanIsValid: 1 } }),
  },
  {
    nazwa: "pamiec-nazwy-nadpisuje-nazwe-z-pliku",
    opis:
      "`nazwa_pamiec` (klucz: `kod_importu`) odtwarza ręcznie ustawioną nazwę — plik dostawcy " +
      "jej nie nadpisze.",
    katalog: [produkt({ kod: "INNY", ean: EAN, eanIsValid: 1, kodImportu: "515151" })],
    nazwaPamiec: [{ kodImportu: "515151", nazwa: "NAZWA OD ANI", updatedAt: "2026-01-01", source: "manual" }],
    pozycja: pozycja({ kod: "P-NOWY", snapshot: { kod: "P-NOWY", ean: EAN, eanIsValid: 1 } }),
  },
  {
    nazwa: "pamiec-wagi-uzupelnia-brakujaca-wage",
    opis: "`waga_pamiec` (klucz: `kod`) uzupełnia wagę, której import nie przyniósł.",
    katalog: [],
    wagaPamiec: [{ kod: "P1", waga: 78.5, updatedAt: "2026-01-01", source: "manual" }],
    pozycja: pozycja({}),
  },
  {
    nazwa: "pamiec-linku-odtwarza-zdjecie-i-zapamietuje-nowe",
    opis:
      "Link z `link_pamiec_kod` wraca na produkt, a `rememberLink` zapisuje go z powrotem — " +
      "także pod kluczem marka|model|rozmiar.",
    katalog: [],
    linkPamiecKod: [{ kod: "P1", link: "https://example/zdjecie.jpg", updatedAt: "2026-01-01" }],
    pozycja: pozycja({}),
  },
  {
    nazwa: "pozycja-bez-snapshotu",
    opis:
      "Wiersz stagingu bez `snapshotJson` (tak wygląda `wycofana`, ale trafia się i przy " +
      "danych z ery 3b) — rekord powstaje z samych pól wiersza.",
    katalog: [],
    pozycja: { ...pozycja({}), snapshotJson: null },
  },
  {
    nazwa: "uszkodzony-snapshot-nie-wywraca-akceptacji",
    opis: "Niepoprawny JSON w `snapshotJson` jest połykany — akceptacja idzie dalej.",
    katalog: [],
    pozycja: { ...pozycja({}), snapshotJson: "{to nie jest json" },
  },
  {
    nazwa: "ean-bierze-sie-wylacznie-ze-snapshotu",
    opis:
      "Wiersz stagingu ma `eanRaw`, ale `ean` czytane jest TYLKO ze snapshotu (`r.ean ?? null`). " +
      "Snapshot bez `ean` → produkt bez EAN-u, mimo `eanRaw` w pozycji.",
    katalog: [],
    pozycja: pozycja({ eanRaw: EAN_2, snapshot: { ean: undefined } }),
  },
  // ——— ITERACJA 4a: gałąź cenowa (`:44882-44895`) ———
  //
  // ⭐ TO JEST TA CZĘŚĆ PRÓBY, NA KTÓRĄ 3d-2 CZEKAŁA. Do tej pory wszystkie scenariusze miały
  // `markups`/`promotions` PUSTE, więc oryginał wykonywał gałąź cenową i wychodził z niej bez
  // zmiany — dokładnie jak nasz port, który jej nie miał. Poniższe scenariusze wpisują reguły
  // do obu tabel, więc gałąź realnie liczy i port musi trafić w te same liczby, nie „w okolice".
  //
  // Domyślne wejście: zakup 1000, VAT 23, marka BKT, kategoria „Rolnicze", dostawca MO5.
  // Bez reguł dałoby to `cenaSprzedazy = 1250` (zakup × 1,25) i `marzaPct = 25`.
  {
    nazwa: "narzut-globalny-ustala-cene",
    opis:
      "Jedna reguła globalna 6% → cena idzie z formuły floor(1000 × 1,06 × 1,23) = 1303, " +
      "a `marzaPct` przyjmuje PROCENT NARZUTU (6), nie policzoną marżę.",
    katalog: [],
    narzuty: [narzut({ nazwa: "Reguła Globalna", wartosc: 6 })],
    pozycja: pozycja({}),
  },
  {
    nazwa: "narzut-specyficzny-bije-globalny-mimo-nizszego-priorytetu",
    opis:
      "Reguła po dostawcy z priorytetem 1 wygrywa z globalną o priorytecie 99 — `__bridgePickMarkup` " +
      "przerywa na pierwszej SPECYFICZNEJ, a globalną trzyma tylko jako zapasową.",
    katalog: [],
    narzuty: [
      narzut({ typ: "globalny", zakres: "", wartosc: 6, priorytet: 99 }),
      narzut({ typ: "dostawca", zakres: "MO5", wartosc: 20, priorytet: 1 }),
    ],
    pozycja: pozycja({}),
  },
  {
    nazwa: "narzut-z-warunkami-jest-koniunkcja",
    opis:
      "Reguła `globalny` z niepustymi `warunki` staje się SPECYFICZNA i wymaga spełnienia " +
      "WSZYSTKICH warunków (marka BKT i kategoria zawierająca „roln\").",
    katalog: [],
    narzuty: [
      narzut({
        typ: "globalny",
        zakres: "",
        wartosc: 15,
        warunki: JSON.stringify([
          { typ: "marka", wartosc: "BKT" },
          { typ: "kategoria", wartosc: "roln" },
        ]),
      }),
    ],
    pozycja: pozycja({}),
  },
  {
    nazwa: "narzut-z-warunkami-niespelnionymi-nie-wchodzi",
    opis:
      "Ten sam kształt reguły, ale drugi warunek nie pasuje → żadna reguła nie pasuje, gałąź " +
      "cenowa się nie wykonuje i zostaje domyślne zakup × 1,25 z marżą 25.",
    katalog: [],
    narzuty: [
      narzut({
        typ: "globalny",
        zakres: "",
        wartosc: 15,
        warunki: JSON.stringify([
          { typ: "marka", wartosc: "BKT" },
          { typ: "kategoria", wartosc: "osobowe" },
        ]),
      }),
    ],
    pozycja: pozycja({}),
  },
  {
    nazwa: "narzut-nieaktywny-jest-pomijany",
    opis: "`status` inny niż „aktywny\" wyklucza regułę — cena zostaje domyślna.",
    katalog: [],
    narzuty: [narzut({ wartosc: 40, status: "wylaczony" })],
    pozycja: pozycja({}),
  },
  {
    nazwa: "uszkodzone-warunki-degraduja-do-typu-i-zakresu",
    opis:
      "Niepoprawny JSON w `warunki` jest połykany i traktowany jak brak warunków, więc reguła " +
      "`dostawca`/`MO5` dalej działa.",
    katalog: [],
    narzuty: [narzut({ typ: "dostawca", zakres: "MO5", wartosc: 12, warunki: "{to nie json" })],
    pozycja: pozycja({}),
  },
  {
    nazwa: "sama-promocja-obniza-cene-przy-zerowym-narzucie",
    opis:
      "Bez narzutu, z promocją 10% po `zasieg` → floor(1000 × 1 × 0,9 × 1,23) = 1107, " +
      "a `marzaPct` spada do 0, bo bierze się z NARZUTU, nie z rabatu.",
    katalog: [],
    promocje: [promocja({ rabatPct: 10, zasieg: "BKT,MICHELIN" })],
    pozycja: pozycja({}),
  },
  {
    nazwa: "narzut-i-promocja-mnoza-sie-po-kolei",
    opis: "Narzut 20% i rabat 10% składają się multiplikatywnie, nie sumują.",
    katalog: [],
    narzuty: [narzut({ wartosc: 20 })],
    promocje: [promocja({ rabatPct: 10 })],
    pozycja: pozycja({}),
  },
  {
    nazwa: "promocja-wygasla-nadal-obniza-cene",
    opis:
      "⚠ DEFEKT PRODUKCJI ODTWARZANY 1:1 (plan.md D4): `__bridgePromoMatches` nie czyta " +
      "`start` ani `koniec`, więc promocja sprzed lat dalej działa, dopóki ma status „aktywna\".",
    katalog: [],
    promocje: [promocja({ rabatPct: 30, start: "2020-01-01", koniec: "2020-03-31" })],
    pozycja: pozycja({}),
  },
  {
    nazwa: "promocja-po-warunkach-wygrywa-nad-zasiegiem",
    opis:
      "Niepuste `warunki` całkowicie zastępują `zasieg` — promocja pasuje mimo `zasieg`, " +
      "który z produktem nie ma nic wspólnego.",
    katalog: [],
    promocje: [
      promocja({
        rabatPct: 25,
        zasieg: "COSINNEGO",
        warunki: JSON.stringify([{ typ: "dostawca", wartosc: "MO5" }]),
      }),
    ],
    pozycja: pozycja({}),
  },
  {
    nazwa: "regula-nadpisuje-cene-sprzedazy-z-pozycji",
    opis:
      "⚠ Reguła cenowa NADPISUJE `cenaSprzedazyNowa` wpisaną ręcznie w stagingu — człowiek " +
      "przegrywa z regułą. Zaskakujące, ale tak liczy produkcja.",
    katalog: [],
    narzuty: [narzut({ wartosc: 6 })],
    pozycja: pozycja({ cenaZakupuNowa: 1000, cenaSprzedazyNowa: 2000 }),
  },
  {
    nazwa: "regula-nie-wchodzi-przy-zerowej-cenie-zakupu",
    opis:
      "Próg `cenaZakupu > 0` odcina gałąź WCZEŚNIEJ niż dopasowanie reguł — mimo aktywnego " +
      "narzutu produkt zostaje `wstrzymany` z ceną 0.",
    katalog: [],
    narzuty: [narzut({ wartosc: 40 })],
    pozycja: pozycja({ cenaZakupuNowa: 0 }),
  },
  {
    nazwa: "regula-przelicza-takze-aktualizowany-produkt",
    opis: "Gałąź cenowa działa tak samo na ścieżce UPDATE, nie tylko przy nowym produkcie.",
    katalog: [produkt({ cenaZakupu: 900, cenaSprzedazy: 1125, marzaPct: 25 })],
    narzuty: [narzut({ typ: "kategoria", zakres: "Rolnicze", wartosc: 8 })],
    pozycja: pozycja({ cenaZakupuNowa: 1234.5, stanNowy: 9 }),
  },
];
