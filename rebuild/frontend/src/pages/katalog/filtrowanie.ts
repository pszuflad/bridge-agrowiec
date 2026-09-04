/**
 * Filtrowanie, sortowanie i budowanie list słownikowych katalogu.
 *
 * Wszystko dzieje się PO STRONIE KLIENTA — dokładnie jak w oryginale
 * (`deminified/frontend-index.js:23276-23312`). Backend `GET /api/products` nie zna
 * ani `search`, ani `sort`, ani filtrów innych niż `dostawca`, więc katalog pobiera
 * całą tabelę jednym żądaniem i przetwarza ją u siebie.
 *
 * Świadomie wydzielone jako czyste funkcje: to najgęstsza logika tego widoku i jedyny
 * jego fragment, który da się sensownie przetestować bez renderowania.
 */

/** Produkt tak, jak oddaje go `GET /api/products` (kształt z contract/fixtures/GET_products.json). */
export type Produkt = {
  id: number;
  kod: string;
  nazwa: string;
  marka: string | null;
  kategoria: string | null;
  dostawca: string;
  magazyn: string | null;
  stan: number | null;
  ean: string | null;
  status: string;
  rozmiar: string | null;
  /**
   * ⚠ `number | string | null` NIE jest tu niechlujstwem, tylko odwzorowaniem stanu
   * faktycznego (plan.md D1, backlog #3): kanoniczny schemat trzyma tę kolumnę jako REAL,
   * a produkcja po migracji `szertxt` jako TEXT z zapisem „10.00". Backend przepuszcza
   * wartość bez konwersji, więc front musi radzić sobie z obiema.
   */
  szerokosc: number | string | null;
  [pole: string]: unknown;
};

/** Pola przeszukiwane przez szukajkę — kolejność i skład 1:1 (frontend-index.js:23301). */
export const POLA_SZUKAJKI = [
  "kod",
  "nazwa",
  "sku",
  "kodDostawcy",
  "magazyn",
  "ean",
  "marka",
  "model",
  "rozmiar",
  "rozmiarAlternatywny",
  "indeksy",
  "indeks1",
  "indeks2",
  "dot",
  "kategoria",
  "dostawca",
] as const;

export type TrybStatusu = "all" | "dostepne" | "aktywny" | "wstrzymany" | "brak_ean";
export type KierunekSortowania = "asc" | "desc";

/**
 * Szukajka tokenowa (frontend-index.js:23297-23305): fraza dzielona po białych znakach,
 * KAŻDY token musi trafić w KTÓREKOLWIEK z 16 pól (AND po tokenach, OR po polach).
 * Dopasowanie to zwykły `includes` po zamianie na małe litery — bez granic słowa,
 * więc „BKT" znajdzie też „ABKTX".
 *
 * Oryginał nie ma debounce'u — filtr przelicza się na każde naciśnięcie klawisza.
 * Zostawiamy tak samo; przy pełnym katalogu to i tak jedna pętla po tablicy w pamięci.
 */
export function filtrujSzukajka(produkty: Produkt[], fraza: string): Produkt[] {
  const tokeny = fraza.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokeny.length === 0) return produkty;

  return produkty.filter((produkt) => {
    const pola = POLA_SZUKAJKI.map((pole) => String(produkt[pole] ?? "").toLowerCase());
    return tokeny.every((token) => pola.some((wartosc) => wartosc.includes(token)));
  });
}

/**
 * Filtr statusu (frontend-index.js:23306). Uwaga: to NIE jest filtr po samej kolumnie
 * `status` — dwie z pięciu opcji są wyliczeniami klienta:
 *  - `dostepne`  → `typeof stan === "number" && stan > 0` (uwaga: `stan === -1`,
 *    czyli „na zamówienie", też odpada),
 *  - `brak_ean`  → puste albo brakujące `ean`,
 *  - pozostałe   → dosłowne porównanie z kolumną `status`.
 */
export function filtrujStatus(produkty: Produkt[], tryb: TrybStatusu): Produkt[] {
  if (tryb === "all") return produkty;
  if (tryb === "dostepne") {
    return produkty.filter((p) => typeof p.stan === "number" && p.stan > 0);
  }
  if (tryb === "brak_ean") {
    return produkty.filter((p) => !p.ean);
  }
  return produkty.filter((p) => p.status === tryb);
}

/**
 * Sortowanie po kolumnie (frontend-index.js:23307-23311). Numerycznie tylko wtedy, gdy
 * OBIE porównywane wartości są liczbami; w każdym innym przypadku `localeCompare`
 * na reprezentacji tekstowej. Brak wartości traktowany jest jak pusty string.
 *
 * Konsekwencja dla `szerokosc` (D1): na kanonie kolumna jest liczbowa i sortuje się
 * numerycznie, na stagingu po `szertxt` jest tekstem i sortuje się leksykalnie
 * („10.00" przed „9"). To zachowanie ORYGINAŁU, nie nasza decyzja — ta sama funkcja
 * w produkcji robi dziś dokładnie to samo.
 */
export function sortuj(
  produkty: Produkt[],
  kolumna: string,
  kierunek: KierunekSortowania,
): Produkt[] {
  if (!kolumna) return produkty;

  return [...produkty].sort((a, b) => {
    const lewa = a[kolumna] ?? "";
    const prawa = b[kolumna] ?? "";
    const roznica =
      typeof lewa === "number" && typeof prawa === "number"
        ? lewa - prawa
        : String(lewa).localeCompare(String(prawa));
    return kierunek === "asc" ? roznica : -roznica;
  });
}

/**
 * Wartość słownika atrybutów w zakresie, którego potrzebują filtry katalogu.
 *
 * Typ jest lokalny i STRUKTURALNY (nie import z `pages/atrybuty/api.ts`) celowo: ten moduł
 * jest czystą logiką bez zależności — tak samo trzyma tu własną definicję `Produkt`.
 * Kształt zgodny z `GET /api/atrybuty` → `wartosci[]`.
 */
export type WartoscSlownika = { rodzaj: string; wartosc: string };

/**
 * Lista marek do filtra — port `frontend-index.js:23287-23291`.
 *
 * SUMA dwóch źródeł: wartości słownikowych rodzaju `marka` ORAZ marek obecnych w danych.
 *
 * ⚠ FILTR „BEZ CYFR" DOTYCZY WYŁĄCZNIE MAREK Z PRODUKTÓW (`!/\d/.test(e)` — odsiewa śmieci
 * z importu w rodzaju „11.2-24"). Wartości ze słownika wchodzą BEZ tego filtra, bo w oryginale
 * `filter` wisi tylko na gałęzi produktowej (`:23288`), a nie na złączeniu. To nie przeoczenie
 * portu — sprawdzone w kodzie przy zamykaniu sesji 7c.
 *
 * Sort: `localeCompare(…, "pl")`.
 */
export function listaMarek(produkty: Produkt[], wartosciSlownika: WartoscSlownika[] = []): string[] {
  const zProduktow = produkty
    .map((p) => p.marka)
    .filter((marka): marka is string => Boolean(marka) && !/\d/.test(marka as string));
  const zeSlownika = wartosciSlownika
    .filter((wartosc) => wartosc.rodzaj === "marka")
    .map((wartosc) => wartosc.wartosc);
  return Array.from(new Set([...zeSlownika, ...zProduktow]))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "pl"));
}

/**
 * Lista kategorii — port `frontend-index.js:23292-23295`. Też SUMA słownika i danych.
 *
 * ⚠ DWIE ASYMETRIE WOBEC MAREK, obie w oryginale i obie zachowane: kategorie NIE mają filtra
 * „bez cyfr" (ani dla produktów, ani dla słownika) i sortują się domyślnym `sort()`,
 * a nie `localeCompare`.
 *
 * ⚠ NIE MYLIĆ Z DIALOGIEM REGUŁ w `/narzuty` (sesja 7b): tam kategorie idą WYŁĄCZNIE ze
 * słownika (`:24210`), bo regułę cenową można założyć na kategorię spoza katalogu.
 * Tutaj filtr ma zawężać to, co widać w tabeli, więc źródła się sumują.
 */
export function listaKategorii(
  produkty: Produkt[],
  wartosciSlownika: WartoscSlownika[] = [],
): string[] {
  const zProduktow = produkty
    .map((p) => p.kategoria)
    .filter((kategoria): kategoria is string => Boolean(kategoria));
  const zeSlownika = wartosciSlownika
    .filter((wartosc) => wartosc.rodzaj === "kategoria")
    .map((wartosc) => wartosc.wartosc);
  return Array.from(new Set([...zeSlownika, ...zProduktow]))
    .filter(Boolean)
    .sort();
}

export type KryteriaFiltrow = {
  fraza: string;
  marki: Set<string>;
  kategorie: Set<string>;
  status: TrybStatusu;
  sortKolumna: string;
  sortKierunek: KierunekSortowania;
};

/**
 * Pełny łańcuch filtrów w kolejności z oryginału (frontend-index.js:23295-23311):
 * szukajka → marki → kategorie → status → sortowanie. Kolejność ma znaczenie tylko
 * dla wydajności, ale trzymamy się jej dla wierności.
 */
export function zastosujFiltry(produkty: Produkt[], kryteria: KryteriaFiltrow): Produkt[] {
  let wynik = filtrujSzukajka(produkty, kryteria.fraza);
  if (kryteria.marki.size > 0) wynik = wynik.filter((p) => p.marka && kryteria.marki.has(p.marka));
  if (kryteria.kategorie.size > 0) {
    wynik = wynik.filter((p) => p.kategoria && kryteria.kategorie.has(p.kategoria));
  }
  wynik = filtrujStatus(wynik, kryteria.status);
  return sortuj(wynik, kryteria.sortKolumna, kryteria.sortKierunek);
}
