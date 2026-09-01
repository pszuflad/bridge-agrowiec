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
];
