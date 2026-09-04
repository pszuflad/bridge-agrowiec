// Scenariusze celowane w gałęzie `addProductsBulk` (`backend-index.cjs:44746-44806`).
//
// Ta sama metoda co przy `acceptStaging` (3d-2): scenariusz opisuje STAN WEJŚCIOWY bazy
// i partię przekazaną do bulku, a test uruchamia na nim ORYGINAŁ wycięty z bundla obok
// NASZEGO portu i porównuje końcowy stan dwóch identycznie zasianych baz.
//
// Oczekiwań NIE piszemy ręcznie — wzorcem jest zachowanie uruchomionego oryginału.
//
// ⚠ CZEGO TU CELOWO NIE MA: propagacji `uwagaCena`. To monkey-patch
// (`mirror/backend/uwaga_cena_patch.cjs:72-93`) doklejany do bundla PO buildzie, więc wycięty
// `addProductsBulk` go nie zawiera i oryginał w tej próbie kolumny nie tknie. Porównanie
// stanu bazy pomija więc `uwagaCena`, a samą propagację mierzą testy tras
// (`test/produkty.mutacje.test.ts`), gdzie wzorcem jest kod monkey-patcha.

const EAN = "5901234123457";
const EAN_2 = "5901234123464";

/** Wiersz `products` obecny w katalogu PRZED bulkiem. */
export function produkt(pola) {
  return {
    kod: "P1",
    nazwa: "Opona 480/70R28 BKT AGRIMAX RT 765",
    marka: "BKT",
    kategoria: "Rolnicze",
    dostawca: "MO5",
    magazyn: "4",
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

/** Pozycja partii — ciało żądania `POST /api/products`, czyli cokolwiek klient przysłał. */
export function pozycja(pola) {
  return {
    kod: "P1",
    nazwa: "Opona 480/70R28 BKT AGRIMAX RT 765",
    marka: "BKT",
    kategoria: "Rolnicze",
    dostawca: "MO5",
    stan: 4,
    cenaZakupu: 1000,
    rozmiar: "480/70R28",
    ean: EAN,
    ...pola,
  };
}

/** Wiersz `markups`. */
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

/** Wiersz `promotions`. */
export function promocja(pola) {
  return {
    nazwa: "Promocja",
    rabatPct: 10,
    // `start`/`koniec` są NOT NULL w kanonie (`001_schema.sql`) — daty muszą tu być.
    zasieg: "",
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
    nazwa: "nowy-produkt-wchodzi-do-katalogu",
    opis: "Pusty katalog, jedna pozycja. Mierzy komplet wartości domyślnych i wszystkie sześć rozszerzeń.",
    katalog: [],
    partia: [pozycja({})],
  },
  {
    nazwa: "istniejacy-produkt-jest-aktualizowany",
    opis: "Ten sam `kod` w katalogu — bulk robi UPDATE, nie INSERT, i nie duplikuje wiersza.",
    katalog: [produkt({ stan: 1, cenaZakupu: 900, kodImportu: "111111" })],
    partia: [pozycja({ stan: 7, cenaZakupu: 1100 })],
  },
  {
    nazwa: "rekord-bez-kodu-jest-pomijany",
    opis: "Pozycja bez `kod` nie tworzy produktu i nie wchodzi do licznika; sąsiednia przechodzi.",
    katalog: [],
    partia: [pozycja({ kod: undefined }), pozycja({ kod: "P2", ean: EAN_2 })],
  },
  {
    nazwa: "wartosci-domyslne-gdy-pozycja-jest-uboga",
    opis: "Sama `kod` — mierzy `nazwa ?? ''`, `marka/kategoria/dostawca ?? '—'`, `magazyn = String(stan ?? 0)`, `vat ?? 23`, `status ?? 'aktywny'`.",
    katalog: [],
    partia: [{ kod: "P9" }],
  },
  {
    nazwa: "cena-sprzedazy-liczy-sie-z-narzutu-25-procent",
    opis: "Brak `cenaSprzedazy` w pozycji — domyślne `round(zakup × 1,25, 2)` i `marzaPct` policzona z faktycznych cen.",
    katalog: [],
    partia: [pozycja({ cenaZakupu: 999.99, cenaSprzedazy: undefined })],
  },
  {
    nazwa: "zerowa-cena-zakupu-odcina-galaz-cenowa",
    opis: "`cenaZakupu = 0` — próg `> 0` wypada przed odczytem reguł, więc narzut w tabeli nie działa, a `marzaPct` zostaje 0.",
    katalog: [],
    partia: [pozycja({ cenaZakupu: 0 })],
    narzuty: [narzut({})],
  },
  {
    nazwa: "narzut-globalny-ustala-cene",
    opis: "Reguła w `markups` nadpisuje domyślne zakup × 1,25 — `floor`, VAT, `marzaPct` = procent narzutu.",
    katalog: [],
    partia: [pozycja({})],
    narzuty: [narzut({})],
  },
  {
    nazwa: "narzut-i-promocja-mnoza-sie-po-kolei",
    opis: "Obie tabele niepuste — mierzy kolejność mnożenia narzut → rabat → VAT.",
    katalog: [],
    partia: [pozycja({})],
    narzuty: [narzut({ wartosc: 20 })],
    promocje: [promocja({ rabatPct: 15 })],
  },
  {
    nazwa: "sama-promocja-obniza-cene-przy-zerowym-narzucie",
    opis: "Pusty `markups`, sama promocja — gałąź wchodzi na `__pp`, a `marzaPct` spada do 0.",
    katalog: [],
    partia: [pozycja({})],
    promocje: [promocja({})],
  },
  {
    nazwa: "regula-nadpisuje-cene-sprzedazy-z-pozycji",
    opis: "Pozycja niesie własną `cenaSprzedazy`, a reguła i tak wygrywa — tak samo jak przy acceptStaging.",
    katalog: [],
    partia: [pozycja({ cenaSprzedazy: 4321 })],
    narzuty: [narzut({})],
  },
  {
    nazwa: "kod-importu-dziedziczy-sie-po-grupie-ean",
    opis: "Produkt z tym samym EAN ma już numer — `assignKodImportu` przypisuje ten sam, deterministycznie.",
    katalog: [produkt({ kod: "P0", ean: EAN, kodImportu: "424242" })],
    partia: [pozycja({ kod: "P2", ean: EAN })],
  },
  {
    nazwa: "link-zdjecia-wraca-z-pamieci-po-kodzie",
    opis: "`applyLinkMemory` uzupełnia `linkZdjecia` z `link_pamiec_kod`, a `rememberLink` zapisuje go z powrotem.",
    katalog: [],
    partia: [pozycja({})],
    linkPamiecKod: [
      { kod: "P1", link: "https://example.invalid/p1.jpg", updatedAt: "2026-01-01T00:00:00.000Z" },
    ],
  },
  {
    nazwa: "waga-wraca-z-pamieci-gdy-partia-jej-nie-niesie",
    opis: "`applyWagaPamiec` uzupełnia `waga` po `kod`, gdy pozycja przyszła bez niej.",
    katalog: [],
    partia: [pozycja({})],
    wagaPamiec: [{ kod: "P1", waga: 62.5, updatedAt: "2026-01-01T00:00:00.000Z" }],
  },
  {
    nazwa: "nazwa-wraca-z-pamieci-po-kodzie-importu",
    opis: "`applyNazwaPamiec` odtwarza ręcznie ustawioną nazwę — klucz to `kodImportu`, nie `kod`.",
    katalog: [produkt({ kod: "P0", ean: EAN, kodImportu: "424242" })],
    partia: [pozycja({ kod: "P2", ean: EAN })],
    nazwaPamiec: [
      { kodImportu: "424242", nazwa: "Nazwa ustawiona ręcznie", updatedAt: "2026-01-01T00:00:00.000Z" },
    ],
  },
  {
    nazwa: "partia-wielu-pozycji-idzie-w-jednej-transakcji",
    opis: "Trzy pozycje naraz, jedna aktualizuje istniejący produkt — mierzy licznik i wspólny `dataAktualizacji`.",
    katalog: [produkt({ kod: "P1", stan: 1 })],
    partia: [
      pozycja({ kod: "P1", stan: 9 }),
      pozycja({ kod: "P2", ean: EAN_2, rozmiar: "710/70R42" }),
      pozycja({ kod: "P3", ean: null, marka: undefined, kategoria: undefined }),
    ],
  },
  {
    nazwa: "wymiary-paczki-licza-sie-z-rozmiaru",
    opis: "`applyDims` wypełnia `dlugosc`/`szerokoscPaczki`/`wysokosc`/`wysokoscPrzesylki` z pola `rozmiar`.",
    katalog: [],
    partia: [pozycja({ rozmiar: "710/70R42" })],
  },
  {
    nazwa: "status-wstrzymany-przechodzi-z-pozycji",
    opis: "Pozycja niesie własny `status` — domyślne `'aktywny'` nie wchodzi, ale reguła cenowa i tak może go przestawić.",
    katalog: [],
    partia: [pozycja({ status: "wstrzymany" })],
  },
];
