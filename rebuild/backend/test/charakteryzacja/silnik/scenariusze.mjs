// Scenariusze celowane w konkretne gałęzie silnika importu.
//
// PO CO, skoro jest już charakteryzacja na realnych cennikach MO1–MO10: bo realne cenniki
// pokrywają szeroko, ale nie wszędzie. Nagranie na próbkach dało 38 pozycji `nowa`,
// 310 `zmiana_kluczowa`, 283 auto-zatwierdzenia i 1206 `bezZmian` — ale ZERO wierszy `blad`,
// zero kasowań nie-opony i zero konfliktów EAN. Te gałęzie istnieją w produkcji, tylko akurat
// nie w tych dziesięciu plikach.
//
// Scenariusze NIE mają ręcznie pisanych oczekiwań. Tak samo jak charakteryzacja na cennikach,
// przechodzą przez ORYGINALNE `tk()` wycięte z bundla i to jego wyjście jest wzorcem. Różnica
// jest tylko w doborze wejścia: tam realne dane, tu dane skrojone tak, żeby wejść w gałąź.

/** Wypełnia wiersz `products` do kształtu, w jakim trzyma go wzorzec katalogu. */
function produkt(pola) {
  return {
    id: 0,
    kod: "",
    ean: null,
    eanIsValid: null,
    dostawca: "MO5",
    nazwa: "",
    marka: "BKT",
    model: null,
    kodDostawcy: null,
    rozmiar: null,
    szerokosc: null,
    profil: null,
    srednica: null,
    konstrukcja: null,
    indeksNosnosci: null,
    indeksPredkosci: null,
    vfIf: null,
    pr: null,
    cenaZakupu: 1000,
    cenaSprzedazy: 1300,
    marzaPct: 30,
    stan: 4,
    magazyn: "PL",
    magazynRaw: "PL",
    nieobecnoscPodRzad: 0,
    kategoria: "Opony rolnicze",
    vat: 23,
    status: "aktywny",
    dataAktualizacji: "2026-01-01T00:00:00.000Z",
    ...pola,
  };
}

/** EAN-13 z poprawną sumą kontrolną — używany wszędzie, gdzie EAN ma być „zdrowy". */
const EAN_POPRAWNY = "5901234123457";
const EAN_POPRAWNY_2 = "5901234123464";

const OPONA = {
  nazwa: "Opona 480/70R28 BKT AGRIMAX RT 765",
  rozmiar: "480/70R28",
  marka: "BKT",
  model: "AGRIMAX RT 765",
  kategoria: "Opony rolnicze",
};

export const SCENARIUSZE = [
  {
    nazwa: "nowa-czysta",
    opis: "Opona spoza katalogu, poprawny EAN, rozmiar wykryty → typZmiany 'nowa' bez ostrzeżeń.",
    dostawca: "MO5",
    katalog: [],
    rekordy: [{ kod: "S1", ...OPONA, ean: EAN_POPRAWNY, stan: 4, cenaZakupu: 1000 }],
  },
  {
    nazwa: "dopasowanie-po-kodzie",
    opis: "Kod z cennika trafia w products.kod → 'zmiana_kluczowa' z etykietami różnic z Vq.",
    dostawca: "MO5",
    katalog: [produkt({ id: 11, kod: "S2", nazwa: "STARA NAZWA", rozmiar: "480/70R28" })],
    rekordy: [{ kod: "S2", ...OPONA, ean: EAN_POPRAWNY, stan: 7, cenaZakupu: 1100 }],
  },
  {
    nazwa: "dopasowanie-po-eanie",
    opis: "Kod z cennika nieznany, ale EAN trafia w products.ean → dopasowanie drugą mapą.",
    dostawca: "MO5",
    katalog: [
      produkt({ id: 21, kod: "KAT-S3", nazwa: "STARA NAZWA", ean: EAN_POPRAWNY, eanIsValid: 1 }),
    ],
    rekordy: [{ kod: "CENNIK-S3", ...OPONA, ean: EAN_POPRAWNY, stan: 3, cenaZakupu: 1200 }],
  },
  {
    nazwa: "dopasowanie-po-eanie-znormalizowanym",
    opis:
      "Rekord bez kodu, EAN z wiodącymi zerami — surowy nie trafia w mapę, dopiero wynik Hq() " +
      "trafia w drugim podejściu (backend-index.cjs:47698). Po drodze EAN staje się identyfikatorem.",
    dostawca: "MO5",
    katalog: [
      produkt({ id: 31, kod: "KAT-S4", nazwa: "STARA NAZWA", ean: EAN_POPRAWNY, eanIsValid: 1 }),
    ],
    rekordy: [{ kod: "", ...OPONA, ean: `000${EAN_POPRAWNY}`, stan: 2, cenaZakupu: 1300 }],
  },
  {
    nazwa: "identyfikator-zastepczy-lq",
    opis:
      "Brak kodu i brak EAN-u, ale Zc() uznaje pozycję za oponę → identyfikator techniczny " +
      "z Lq() (sha1) i wymuszony 'blad'.",
    dostawca: "MO5",
    katalog: [],
    rekordy: [{ kod: "", ean: "", ...OPONA, stan: 1, cenaZakupu: 1400 }],
  },
  {
    nazwa: "nie-opona-z-kasowaniem-produktu",
    opis:
      "Kod trafia w istniejący produkt, ale nazwa z cennika to dętka → odrzucenie i SKASOWANIE " +
      "produktu z katalogu (backend-index.cjs:47689).",
    dostawca: "MO5",
    katalog: [produkt({ id: 41, kod: "S6", nazwa: "Opona 12.4-28 BKT", rozmiar: "12.4-28" })],
    rekordy: [{ kod: "S6", nazwa: "Dętka 12.4-28", kategoria: "Dętki", stan: 5, cenaZakupu: 90 }],
  },
  {
    nazwa: "konflikt-ean",
    opis:
      "Dwa produkty w katalogu dzielą EAN → mapa EAN dostaje null, a nowa pozycja z tym EAN-em " +
      "zostaje niedopasowana i dostaje ostrzeżenie o konflikcie.",
    dostawca: "MO5",
    katalog: [
      produkt({ id: 51, kod: "S7A", nazwa: "PIERWSZA", ean: EAN_POPRAWNY, eanIsValid: 1 }),
      produkt({ id: 52, kod: "S7B", nazwa: "DRUGA", ean: EAN_POPRAWNY, eanIsValid: 1 }),
    ],
    rekordy: [{ kod: "S7-NOWY", ...OPONA, ean: EAN_POPRAWNY, stan: 6, cenaZakupu: 1500 }],
  },
  {
    nazwa: "bledny-zapis-nazwy",
    opis: "Nazwa bez spacji po słowie 'Opona' → Kq() zgłasza błąd zapisu i wymusza 'blad'.",
    dostawca: "MO5",
    katalog: [],
    rekordy: [
      {
        kod: "S8",
        nazwa: "Opona480/70R28 BKT AGRIMAX RT 765",
        rozmiar: "480/70R28",
        marka: "BKT",
        kategoria: "Opony rolnicze",
        ean: EAN_POPRAWNY,
        stan: 2,
        cenaZakupu: 1000,
      },
    ],
  },
  {
    nazwa: "brak-rozmiaru",
    opis:
      "Zc() uznaje za oponę po słowie kluczowym, ale ani pole rozmiar, ani JT() z nazwy nic nie " +
      "daje → ostrzeżenie 'nie wykryto rozmiaru' i 'blad'.",
    dostawca: "MO5",
    katalog: [],
    rekordy: [
      {
        kod: "S9",
        nazwa: "Opona rolnicza uniwersalna",
        kategoria: "Opony rolnicze",
        ean: EAN_POPRAWNY,
        stan: 1,
        cenaZakupu: 700,
      },
    ],
  },
  {
    nazwa: "wiele-ostrzezen-naraz",
    opis:
      "Brak kodu, brak EAN-u i brak rozmiaru naraz → DWA składniki ostrzeżenia sklejone " +
      "separatorem ' • '. Bez tego przypadku separator nigdy by się nie pojawił w próbie.",
    dostawca: "MO5",
    katalog: [],
    rekordy: [
      {
        kod: "",
        ean: "",
        nazwa: "Opona rolnicza uniwersalna",
        kategoria: "Opony rolnicze",
        marka: "BKT",
        stan: 2,
        cenaZakupu: 500,
      },
    ],
  },
  {
    nazwa: "ean-notacja-naukowa",
    opis:
      "EAN zapisany przez Excela jako notacja naukowa. DOWÓD na błąd cieniowania Lq() " +
      "(plan.md D3): komunikat produkcji brzmi 'ma tylko null cyfr znaczących'.",
    dostawca: "MO5",
    katalog: [],
    rekordy: [{ kod: "S10", ...OPONA, ean: "6,41944E+12", stan: 3, cenaZakupu: 800 }],
  },
  {
    nazwa: "ean-nieczytelny",
    opis: "EAN za krótki → ean_source_status 'no_valid_candidate' i ostrzeżenie o EAN-ie.",
    dostawca: "MO5",
    katalog: [],
    rekordy: [{ kod: "S11", ...OPONA, ean: "12345", stan: 3, cenaZakupu: 800 }],
  },
  {
    nazwa: "smieci-mo2",
    opis: "Filtr śmieci MO2 (kod 999991 + brak EAN) → odrzuconeSmieciMO2, bez wpisu do stagingu.",
    dostawca: "MO2",
    katalog: [],
    rekordy: [
      { kod: "MO2_999991", nazwa: "6.50-16 BKT", ean: "", marka: "", stan: 1, cenaZakupu: 10 },
    ],
  },
  {
    nazwa: "brak-identyfikatora-i-danych",
    opis: "Brak kodu, brak EAN-u, a Zc() mówi że to nie opona → odrzuconeBrakDanych.",
    dostawca: "MO5",
    katalog: [],
    rekordy: [{ kod: "", ean: "", nazwa: "Zawór TR-218A", kategoria: "Akcesoria", stan: 9 }],
  },
  {
    nazwa: "bez-zmian",
    opis: "Rekord identyczny z produktem w katalogu → bezZmian, żadnego wiersza stagingu.",
    dostawca: "MO5",
    katalog: [
      produkt({
        id: 61,
        kod: "S14",
        nazwa: OPONA.nazwa,
        marka: OPONA.marka,
        model: OPONA.model,
        rozmiar: OPONA.rozmiar,
        ean: EAN_POPRAWNY,
        eanIsValid: 1,
        szerokosc: 480,
        profil: 70,
        srednica: 28,
        konstrukcja: "R",
        stan: 4,
        cenaZakupu: 1000,
        cenaSprzedazy: 1300,
        marzaPct: 30,
        magazyn: "PL",
        magazynRaw: "PL",
      }),
    ],
    rekordy: [
      {
        kod: "S14",
        ...OPONA,
        ean: EAN_POPRAWNY,
        stan: 4,
        cenaZakupu: 1000,
        cenaSprzedazy: 1300,
        marzaPct: 30,
        magazyn: "PL",
        magazynRaw: "PL",
      },
    ],
  },
  {
    nazwa: "auto-zatwierdzenie-decyzja",
    opis:
      "Zmienia się wyłącznie cena zakupu → decyzja o auto-zatwierdzeniu, bez wiersza stagingu. " +
      "3c liczy tę decyzję, ale nie wykonuje jej efektów (plan.md D5).",
    dostawca: "MO5",
    katalog: [
      produkt({
        id: 71,
        kod: "S15",
        nazwa: OPONA.nazwa,
        marka: OPONA.marka,
        model: OPONA.model,
        rozmiar: OPONA.rozmiar,
        ean: EAN_POPRAWNY,
        eanIsValid: 1,
        szerokosc: 480,
        profil: 70,
        srednica: 28,
        konstrukcja: "R",
        stan: 4,
        cenaZakupu: 1000,
        cenaSprzedazy: 1300,
        marzaPct: 30,
      }),
    ],
    rekordy: [
      {
        kod: "S15",
        ...OPONA,
        ean: EAN_POPRAWNY,
        stan: 4,
        cenaZakupu: 1111,
        cenaSprzedazy: 1300,
        marzaPct: 30,
        magazyn: "PL",
        magazynRaw: "PL",
      },
    ],
  },
  {
    nazwa: "reset-nieobecnosci",
    opis:
      "Dopasowany produkt miał nieobecnoscPodRzad > 0 → licznik wraca do zera " +
      "(backend-index.cjs:47702). Jedyna mutacja katalogu, jaką 3c wykonuje poza kasowaniem.",
    dostawca: "MO5",
    katalog: [
      produkt({ id: 81, kod: "S16", nazwa: "STARA NAZWA", nieobecnoscPodRzad: 2 }),
    ],
    rekordy: [{ kod: "S16", ...OPONA, ean: EAN_POPRAWNY_2, stan: 5, cenaZakupu: 1000 }],
  },
  {
    nazwa: "deduplikacja-addstaging",
    opis:
      "Dwa identyczne rekordy dają dwa identyczne wiersze w buforze, ale addStaging " +
      "(backend-index.cjs:44923) deduplikuje po (kod, typZmiany, powod) → jeden wiersz. " +
      "doStagingu i tak liczy bufor, nie zapisy (:47850).",
    dostawca: "MO5",
    katalog: [],
    rekordy: [
      { kod: "S17", ...OPONA, ean: EAN_POPRAWNY, stan: 4, cenaZakupu: 1000 },
      { kod: "S17", ...OPONA, ean: EAN_POPRAWNY, stan: 4, cenaZakupu: 1000 },
    ],
  },
];
