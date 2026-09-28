/**
 * Rozpoznanie dostawcy po pliku — port `FE()` + tablicy `qu`
 * (`deminified/frontend-index.js:18309-18432`), razem z pomocnikami `$y`, `LE`,
 * `nP` (kodowanie) i `rP` (rozbicie CSV).
 *
 * ⚠ ZAKRES ŚWIADOMIE WĘŻSZY NIŻ ORYGINAŁ (decyzja sesji 3f-1, wariant „b").
 * Produkcyjne `oP()` po detekcji budowało jeszcze PODGLĄD 8 pozycji, mapując wiersze
 * per dostawca (`tP()`, osobna gałąź `HE()` dla MO1, plus parser rozmiarów opon) —
 * około 305 linii, które są DRUGĄ implementacją mapowania mającego już wierny port
 * po stronie backendu (`src/import/legacy/`, charakteryzacja sha256 z 3a). Kopia
 * w przeglądarce nie byłaby niczym scharakteryzowana i rozjeżdżałaby się w ciszy.
 * Podgląd bierzemy więc z pola `podglad` odpowiedzi uploadu — z portu parserów,
 * czyli ze źródła prawdy. Tutaj zostaje sama detekcja, bo ona odpowiednika
 * w backendzie NIE ma i to ona daje wgrywanie wielu plików naraz.
 *
 * ⚠ DRUGIE ODSTĘPSTWO: oryginał odrzucał XLSX i pliki > 10 MB (`oP()`:18793-18794).
 * Nie odtwarzamy tego — patrz `KRYTERIA` niżej i raport sesji.
 */

/** Pewność rozpoznania — wartości 1:1 z oryginałem. */
export type PewnoscDetekcji = "wysoka" | "srednia" | "brak" | "wymuszona";

export type WynikDetekcji = {
  kod: string;
  pewnosc: PewnoscDetekcji;
  powod: string;
};

type SygnaturaDostawcy = {
  kod: string;
  /** Wzorce nazwy pliku — najmocniejsza przesłanka, sprawdzana pierwsza. */
  nazwy: RegExp[];
  /** Zestawy nagłówków; dopasowanie liczone jest na przecięciu, nie na równości. */
  naglowkiSygn: string[][];
  bezNaglowkow?: boolean;
  pierwszaLiniaWzor?: RegExp;
};

/**
 * Tablica sygnatur — przepisana 1:1 z `qu` (`frontend-index.js:18309-18372`).
 * Kolejność ma znaczenie: przy remisie trafień wygrywa wpis wcześniejszy.
 */
export const SYGNATURY: SygnaturaDostawcy[] = [
  {
    kod: "MO1",
    nazwy: [/boh[ne]+kamp/i, /bohenekamp/i],
    naglowkiSygn: [],
    bezNaglowkow: true,
    pierwszaLiniaWzor: /^\d{7,};\d{12,};[A-Za-z]/,
  },
  {
    kod: "MO2",
    nazwy: [/jmk/i, /cennik_26002/i, /^Cennik_\d{4,5}/i],
    naglowkiSygn: [
      ["Kod producenta", "id JMK", "Producent", "Bieżnik", "Indeks prędkości 1", "Magazyn 1 ilosc"],
      ["id JMK", "Cena klient netto", "Cena detal netto"],
    ],
  },
  {
    kod: "MO3",
    nazwy: [/grasdorf/i, /test-csv/i, /t1003/i, /kolarolnicze/i],
    naglowkiSygn: [
      ["id", "eid", "indexCatalogue", "name", "basePriceNet"],
      ["eid", "indexCatalogue", "Rozmiar opony", "Średnica felgi"],
      ["nazwa", "ean", "producent", "bieznik", "rozmiar", "cena", "stan_magazynu"],
    ],
  },
  {
    kod: "MO4",
    nazwy: [/agrowiec_wr/i, /handlopex.*wr/i, /wroclaw/i],
    naglowkiSygn: [
      ["kod producenta", "symbol handlopex", "producent", "nazwa", "szerokosc", "profil", "srednica"],
    ],
  },
  {
    kod: "MO5",
    nazwy: [/agrowiec_mw/i, /handlopex.*rz/i, /rzeszow/i],
    naglowkiSygn: [
      ["kod producenta", "symbol handlopex", "producent", "nazwa", "szerokosc", "profil", "srednica"],
    ],
  },
  {
    kod: "MO6",
    nazwy: [/cennik_agrowiec/i, /uniglory/i],
    naglowkiSygn: [["EAN", "Beschreibung", "Hersteller", "Lagerbestand", "Cena", "Model"]],
  },
  {
    kod: "MO7",
    nazwy: [/nokian/i],
    naglowkiSygn: [["Kod produktu", "Rozmiar", "MODEL", "PRODUCENT", "BIEŻNIK", "TL/TT", "LI/SI"]],
  },
  {
    kod: "MO8",
    nazwy: [/trelleborg/i],
    naglowkiSygn: [["Rozmiar", "VF/IF", "CFO", "TT/TL", "LI/SI", "PR", "PRODUCENT"]],
  },
  {
    kod: "MO9",
    nazwy: [/agrorami/i, /agro-rami/i, /agro_rami/i],
    naglowkiSygn: [["id", "ean", "producent", "bieznik", "rozmiar", "nosnosc", "predkosc", "tl/tt"]],
  },
  {
    kod: "MO10",
    nazwy: [/^gri/i, /gri[-_]/i, /\/gri/i],
    naglowkiSygn: [["NR KAT", "EAN", "Rozmiar", "cena netto/szt"]],
  },
];

/** Normalizacja nagłówka do porównań — port `$y()` (`:18374`). */
export function znormalizuj(tekst: string): string {
  return tekst
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 /]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Ile nagłówków z sygnatury występuje w pliku — port `LE()` (`:18377`).
 *
 * Dopasowanie jest LUŹNE w obie strony (`includes`), więc „Cena netto" trafia i w „cena",
 * i w „cena netto szt". To celowa cecha oryginału i zostaje.
 *
 * ⚠ ODSTĘPSTWO ŚWIADOME (decyzja użytkownika, sesja 3f-1) — ODSIEWAMY PUSTE NAGŁÓWKI.
 *
 * Oryginał tego nie robi i ma przez to defekt: pusty łańcuch jest podciągiem KAŻDEGO
 * tokenu (`"id".includes("")` → true), więc jedna pusta kolumna daje komplet trafień
 * DOWOLNEJ sygnaturze. A pustą kolumnę ma każdy cennik z kończącym średnikiem — czyli
 * MO4, MO5 i MO7. Wygrywa wtedy sygnatura najdłuższa, czyli MO9 (8 tokenów).
 *
 * Zmierzone na próbkach z `test/charakteryzacja/probki/`, przy nazwie pliku niepasującej
 * do żadnego wzorca:
 *
 *   dostawca   trafienia MO9 (oryginał)   trafienia MO9 (po odsianiu)   rozpoznanie
 *   ────────   ────────────────────────   ───────────────────────────   ───────────
 *   MO4                          8 / 8                         2 / 8   MO9 → MO4
 *   MO5                          8 / 8                         2 / 8   MO9 → MO4*
 *   MO7                          8 / 8                         6 / 8   MO9 → MO7
 *
 *   (* MO4 i MO5 mają identyczną sygnaturę nagłówków — rozróżnia je wyłącznie nazwa pliku.)
 *
 * Skutek defektu jest cichy i kosztowny: cennik Handlopexu opisany jako MO9 „z wysoką
 * pewnością" przepisuje katalog cudzego dostawcy, a etykieta pewności każe temu zaufać.
 * W produkcji nie bije mocniej tylko dlatego, że wzorce NAZWY PLIKU sprawdzane są pierwsze
 * i pokrywają wszystkich dziesięciu dostawców. Backlog: patrz raport sesji 3f-1.
 */
export function policzTrafienia(naglowkiPliku: string[], sygnatura: string[]): number {
  const znormalizowane = naglowkiPliku.map(znormalizuj).filter((n) => n.length > 0);
  let trafienia = 0;
  for (const oczekiwany of sygnatura) {
    const szukany = znormalizuj(oczekiwany);
    if (!szukany) continue;
    if (znormalizowane.some((n) => n.includes(szukany) || szukany.includes(n))) trafienia++;
  }
  return trafienia;
}

/**
 * Rozpoznanie dostawcy — port `FE()` (`:18388-18432`). Trzy przesłanki, w tej kolejności:
 *  1. nazwa pliku pasuje do wzorca → `wysoka`,
 *  2. plik bez nagłówków, pierwsza linia pasuje do wzorca (MO1) → `srednia`,
 *  3. przecięcie nagłówków: ≥4 trafienia → `wysoka`, ≥2 → `srednia`, mniej → `brak`.
 */
export function rozpoznajDostawce(
  nazwaPliku: string,
  naglowki: string[],
  pierwszaLinia?: string,
): WynikDetekcji {
  const nazwa = nazwaPliku.toLowerCase();

  for (const sygnatura of SYGNATURY) {
    for (const wzorzec of sygnatura.nazwy) {
      if (wzorzec.test(nazwa)) {
        return {
          kod: sygnatura.kod,
          pewnosc: "wysoka",
          powod: `Nazwa pliku pasuje do wzorca ${wzorzec.source}`,
        };
      }
    }
  }

  if (pierwszaLinia) {
    for (const sygnatura of SYGNATURY) {
      if (sygnatura.bezNaglowkow && sygnatura.pierwszaLiniaWzor?.test(pierwszaLinia)) {
        return {
          kod: sygnatura.kod,
          pewnosc: "srednia",
          powod: "Plik bez nagłówków — pierwsza linia pasuje do formatu Bohnenkamp",
        };
      }
    }
  }

  let najlepszy = { kod: "", trafienia: 0, ile: 0 };
  for (const sygnatura of SYGNATURY) {
    for (const zestaw of sygnatura.naglowkiSygn) {
      const trafienia = policzTrafienia(naglowki, zestaw);
      const udzial = zestaw.length ? trafienia / zestaw.length : 0;
      // Warunek remisu przepisany z oryginału dosłownie — porównuje udział bieżącego
      // zestawu z udziałem dotychczasowego lidera liczonym wobec DŁUGOŚCI BIEŻĄCEGO
      // zestawu. To dziwne, ale takie jest w produkcji i zmiana zmieniłaby wyniki.
      if (
        trafienia > najlepszy.trafienia ||
        (trafienia === najlepszy.trafienia && udzial > najlepszy.ile / Math.max(1, zestaw.length))
      ) {
        najlepszy = { kod: sygnatura.kod, trafienia, ile: zestaw.length };
      }
    }
  }

  if (najlepszy.trafienia >= 4) {
    return {
      kod: najlepszy.kod,
      pewnosc: "wysoka",
      powod: `Dopasowano ${najlepszy.trafienia}/${najlepszy.ile} nagłówków`,
    };
  }
  if (najlepszy.trafienia >= 2) {
    return {
      kod: najlepszy.kod,
      pewnosc: "srednia",
      powod: `Dopasowano ${najlepszy.trafienia}/${najlepszy.ile} nagłówków`,
    };
  }
  return {
    kod: "",
    pewnosc: "brak",
    powod: "Nie rozpoznano formatu — wybierz dostawcę ręcznie",
  };
}

/**
 * Dekodowanie fragmentu pliku — port `nP()` (`:18742`). Próbuje UTF-8, a gdy w pierwszych
 * 2048 znakach jest więcej niż 0,2% znaków zastępczych, przechodzi na windows-1250.
 */
export function zdekoduj(bajty: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bajty);
  const probka = utf8.slice(0, 2048);
  const zastepcze = (probka.match(/\uFFFD/g) || []).length;
  if (zastepcze / Math.max(1, probka.length) > 0.002) {
    try {
      return new TextDecoder("windows-1250", { fatal: false }).decode(bajty);
    } catch {
      return utf8;
    }
  }
  return utf8;
}

export type RozbityCsv = {
  naglowki: string[];
  separator: ";" | ",";
  pierwszaLinia: string;
  liczbaWierszy: number;
};

/**
 * Rozbicie CSV na nagłówki — port `rP()` (`:18758`), ograniczony do tego, czego
 * potrzebuje detekcja. Separator wybierany po pierwszej linii (więcej `;` niż `,` → `;`),
 * cudzysłowy obsługiwane tak jak w oryginale (`""` w środku pola = jeden cudzysłów).
 */
export function rozbijCsv(tekst: string): RozbityCsv {
  const linie = tekst
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((l) => l.length > 0);

  if (linie.length === 0) {
    return { naglowki: [], separator: ";", pierwszaLinia: "", liczbaWierszy: 0 };
  }

  const pierwsza = linie[0] ?? "";
  const separator = pierwsza.split(";").length > pierwsza.split(",").length ? ";" : ",";

  const pola: string[] = [];
  let biezace = "";
  let wCudzyslowie = false;
  for (let i = 0; i < pierwsza.length; i++) {
    const znak = pierwsza[i];
    if (znak === '"') {
      if (wCudzyslowie && pierwsza[i + 1] === '"') {
        biezace += '"';
        i++;
      } else {
        wCudzyslowie = !wCudzyslowie;
      }
    } else if (znak === separator && !wCudzyslowie) {
      pola.push(biezace);
      biezace = "";
    } else {
      biezace += znak;
    }
  }
  pola.push(biezace);

  return {
    naglowki: pola.map((p) => p.trim()),
    separator,
    pierwszaLinia: pierwsza,
    // Liczba wierszy danych; przy pliku czytanym we fragmencie jest to DOLNE oszacowanie.
    liczbaWierszy: Math.max(0, linie.length - 1),
  };
}

/**
 * Ile bajtów początku pliku wystarczy do detekcji.
 *
 * ⚠ TU ZNIKA LIMIT 10 MB Z ORYGINAŁU. Produkcyjne `nP()` robiło `file.arrayBuffer()`
 * na CAŁYM pliku, żeby obejrzeć pierwsze 2048 znaków i pierwszą linię — i dlatego `oP()`
 * musiało odrzucać pliki > 10 MB (`:18794`). My czytamy wyłącznie ten fragment, więc
 * rozmiar pliku przestaje mieć dla przeglądarki znaczenie; jedynym limitem zostaje
 * 50 MB multera po stronie backendu (decyzja sesji 3f-1).
 */
export const FRAGMENT_DO_DETEKCJI = 64 * 1024;

const ROZSZERZENIA_ARKUSZA = /\.xlsx?$/i;

export type AnalizaPliku = {
  plik: File;
  nazwaPliku: string;
  rozmiar: number;
  /** `true` dla XLS/XLSX — treści nie czytamy, detekcja idzie po samej nazwie. */
  arkusz: boolean;
  naglowki: string[];
  separator: ";" | "," | null;
  /** Liczba wierszy danych albo `null`, gdy plik czytaliśmy tylko we fragmencie. */
  liczbaWierszy: number | null;
  detekcja: WynikDetekcji;
};

/**
 * Analiza pliku wybranego w przeglądarce — odpowiednik `oP()` zawężony do detekcji.
 *
 * ⚠ TU ZNIKA BLOKADA XLSX Z ORYGINAŁU (`:18793`, „Format XLSX nie jest jeszcze
 * obsługiwany. Zapisz jako CSV."). Blokada istniała dlatego, że `oP()` parsowało treść
 * pliku w przeglądarce, a XLSX-a przeczytać nie umiało. Skoro treści nie parsujemy,
 * powód zniknął — a backend XLSX obsługuje przez port parserów z 3a. Bez tego MO8
 * (Trelleborg) i MO10 (GRI), oba jeżdżące na XLSX, byłyby przez tę zakładkę niewgrywalne,
 * a to właśnie te pliki Ania dostaje mailem. Dla arkusza detekcja opiera się na wzorcach
 * nazwy pliku z `SYGNATURY` — dla MO8 i MO10 one istnieją.
 */
export async function przeanalizujPlik(plik: File): Promise<AnalizaPliku> {
  const arkusz = ROZSZERZENIA_ARKUSZA.test(plik.name);

  if (arkusz) {
    return {
      plik,
      nazwaPliku: plik.name,
      rozmiar: plik.size,
      arkusz: true,
      naglowki: [],
      separator: null,
      liczbaWierszy: null,
      detekcja: rozpoznajDostawce(plik.name, []),
    };
  }

  const calyPlik = plik.size <= FRAGMENT_DO_DETEKCJI;
  const bajty = await odczytajFragment(plik);
  const tekst = zdekoduj(bajty);
  const { naglowki, separator, pierwszaLinia, liczbaWierszy } = rozbijCsv(tekst);

  return {
    plik,
    nazwaPliku: plik.name,
    rozmiar: plik.size,
    arkusz: false,
    naglowki,
    separator,
    // Przy fragmencie nie znamy pełnej liczby wierszy i NIE zgadujemy — lepiej nie
    // pokazać liczby niż pokazać zaniżoną, którą Ania wzięłaby za liczbę pozycji.
    liczbaWierszy: calyPlik ? liczbaWierszy : null,
    detekcja: rozpoznajDostawce(plik.name, naglowki, pierwszaLinia),
  };
}

/**
 * Odczyt początku pliku jako `ArrayBuffer`.
 *
 * Najpierw `Blob.arrayBuffer()` — tak robi to każda przeglądarka, którą obsługujemy.
 * `FileReader` jest ścieżką zapasową dla środowisk, w których `slice()` zwraca `Blob`
 * bez tej metody; takie jest jsdom, na którym stoją testy widoku. Obie robią to samo,
 * więc rozgałęzienie nie zmienia zachowania — chroni tylko przed padem w testach.
 */
function odczytajFragment(plik: File): Promise<ArrayBuffer> {
  const fragment = plik.slice(0, FRAGMENT_DO_DETEKCJI);
  if (typeof fragment.arrayBuffer === "function") return fragment.arrayBuffer();

  return new Promise((rozwiaz, odrzuc) => {
    const czytnik = new FileReader();
    czytnik.onload = () => rozwiaz(czytnik.result as ArrayBuffer);
    czytnik.onerror = () => odrzuc(czytnik.error ?? new Error("Nie udało się odczytać pliku"));
    czytnik.readAsArrayBuffer(fragment);
  });
}

/** Nadpisanie detekcji wyborem z UI — port `:18868` (`pewnosc: "wymuszona"`). */
export function wymusDostawce(analiza: AnalizaPliku, kod: string): AnalizaPliku {
  if (!kod || analiza.detekcja.kod === kod) return analiza;
  return {
    ...analiza,
    detekcja: { kod, pewnosc: "wymuszona", powod: `Wymuszone z UI (${kod})` },
  };
}
