/**
 * Definicje kolumn tabeli katalogu — 1:1 z `deminified/frontend-index.js:22732-23021`
 * (tablica `$r`). Kolejność, etykiety, szerokości i wyrównanie przepisane dosłownie,
 * łącznie z etykietami w stylu `snake_case` („cena_zakupu", „data_aktualizacji"),
 * bo dokładnie tak widzi je dziś Ania.
 *
 * `KOLUMNY_DOMYSLNE` odpowiada tablicy `Nn` (:23021) — 15 kolumn włączonych na start.
 */

export type DefinicjaKolumny = {
  /** Klucz pola produktu — także identyfikator w konfiguratorze widoczności. */
  key: string;
  label: string;
  width: number;
  align?: "right" | "center";
};

export const KOLUMNY: DefinicjaKolumny[] = [
  { key: "nazwa", label: "Nazwa-produktu", width: 280 },
  { key: "kodImportu", label: "Kod-importu", width: 100 },
  { key: "dostawca", label: "Dost", width: 70 },
  { key: "marka", label: "Producent-opony", width: 130 },
  { key: "cenaZakupu", label: "Cena-zakupu", width: 90, align: "right" },
  { key: "marzaPct", label: "marza_pct", width: 70, align: "right" },
  { key: "cenaSprzedazy", label: "cena_sprzedazy", width: 100, align: "right" },
  { key: "promocja", label: "Promocja", width: 150 },
  { key: "stan", label: "Stan-magazynowy", width: 90, align: "right" },
  { key: "kodDostawcy", label: "Kod-dostawcy", width: 120 },
  { key: "ean", label: "EAN", width: 130 },
  { key: "rozmiar", label: "Rozmiar", width: 130 },
  { key: "rozmiarAlternatywny", label: "Rozmiar-alternatywny", width: 130 },
  { key: "model", label: "Bieznik/model", width: 140 },
  { key: "szerokosc", label: "Szerokość opony", width: 80, align: "right" },
  { key: "profil", label: "Profil", width: 60, align: "right" },
  { key: "srednica", label: "Srednica", width: 70, align: "right" },
  { key: "dlugosc", label: "Dlugosc-paczki-cm", width: 90, align: "right" },
  { key: "szerokoscPaczki", label: "Szerokosc-paczki-cm", width: 100, align: "right" },
  { key: "wysokosc", label: "Wysokosc-paczki-cm", width: 90, align: "right" },
  { key: "wysokoscPrzesylki", label: "Wysokosc-przesylki-cm", width: 110, align: "right" },
  { key: "indeksNosnosci", label: "Indeks-nosnosci", width: 90, align: "center" },
  { key: "indeksPredkosci", label: "Indeks-predkosci", width: 95, align: "center" },
  { key: "indeksy", label: "Indeksy", width: 90 },
  { key: "kategoria", label: "Kategoria", width: 110 },
  { key: "dot", label: "DOT", width: 120, align: "center" },
  { key: "waga", label: "Waga", width: 70, align: "right" },
  { key: "tlTt", label: "TL/TT", width: 55, align: "center" },
  { key: "pr", label: "Ilość płócien", width: 50, align: "center" },
  { key: "konstrukcja", label: "Konstrukcja opony", width: 50, align: "center" },
  { key: "vfIf", label: "IF/VF", width: 55, align: "center" },
  { key: "oznaczenieBieznika", label: "Oznaczenie-bieznika", width: 130 },
  { key: "linkZdjecia", label: "Link-do-zdjecia", width: 180 },
  { key: "sezon", label: "Sezon", width: 90 },
  { key: "ms", label: "Bloto+snieg", width: 80, align: "center" },
  { key: "snow3pmsf", label: "Snieg-3PMSF", width: 90, align: "center" },
  { key: "wentyl", label: "Wentyl", width: 80 },
  { key: "cfo", label: "CFO", width: 50, align: "center" },
  { key: "sf", label: "SF", width: 50, align: "center" },
  { key: "sb", label: "SB", width: 50, align: "center" },
  { key: "nro", label: "NRO", width: 55, align: "center" },
  { key: "cho", label: "CHO", width: 55, align: "center" },
  { key: "hf", label: "HF", width: 50, align: "center" },
  { key: "ls", label: "LS", width: 50, align: "center" },
  { key: "reinforced", label: "Reinforced", width: 70, align: "center" },
  { key: "extraLoad", label: "ExtraLoad", width: 70, align: "center" },
  { key: "cutResistant", label: "CutResistant", width: 70, align: "center" },
  { key: "heatResistant", label: "HeatResistant", width: 70, align: "center" },
  { key: "stubbleResistant", label: "StubbleResistant", width: 90, align: "center" },
  { key: "dostepnosc", label: "Dostepnosc", width: 100 },
  { key: "labelRolling", label: "Opor-toczenia", width: 90, align: "center" },
  { key: "labelWet", label: "Przyczepnosc", width: 90, align: "center" },
  { key: "labelNoise", label: "Halas", width: 70, align: "center" },
  { key: "labelIce", label: "Lod", width: 50, align: "center" },
  { key: "labelSnow", label: "Snieg", width: 60, align: "center" },
  { key: "vat", label: "vat", width: 50, align: "right" },
  { key: "status", label: "status", width: 90 },
  { key: "zastosowanie", label: "Zastosowanie", width: 220 },
  { key: "dataAktualizacji", label: "data_aktualizacji", width: 140 },
  /**
   * Backlog #73 — kolumna dołożona produkcji 2026-09-10 skryptem
   * `mirror/frontend/assets/payment-blocks-injection.js`, nie obecna w tablicy `$r`.
   *
   * Etykieta i szerokość są z tego skryptu (`th.textContent`, `style.minWidth = "420px"`) —
   * stąd polskie znaki, mimo że sąsiednie etykiety ich nie mają: tak to widzi Ania.
   * Oryginał wstrzykiwał `<th>` PRZED kolumną „Akcje"; u nas ta kolumna jest osobnym,
   * stałym `<th>` poza tą tablicą (`TabelaProduktow.tsx`), więc wpis na końcu daje tę samą
   * pozycję. Wartość liczy `formatujKomorke` z kodu dostawcy (patrz `formatowanie.tsx`).
   *
   * ⚠ MECHANIZMU ZE SKRYPTU NIE PORTUJEMY. `MutationObserver`, `hashchange` i `setInterval`
   * z oryginału obsługiwały wstrzykiwanie do CUDZEGO DOM-u przy routerze haszowym
   * (`#/katalog`, poprawka `routefix` z `0c4d2f2`). Odbudowa porzuciła routing po hashu
   * (odstępstwo O1 z I1, `docs/cutover.md`) i renderuje kolumnę natywnie — cała ta maszyneria
   * jest tu bezprzedmiotowa.
   */
  { key: "blokowaneFormyPlatnosci", label: "Blokowane formy płatności", width: 420 },
];

/**
 * Kolumny widoczne domyślnie (`Nn`, frontend-index.js:23021).
 *
 * ⚠ `promocja` jest w produkcji MARTWA — czyta `produkt._reguly?.promocja`, a `_reguly` nie
 * jest ustawiane NIGDZIE w produkcyjnym bundlu (jedno wystąpienie, wyłącznie odczyt) ani nie
 * przychodzi z `GET /api/products` (72 klucze nagrania, żaden nie niesie promocji).
 *
 * ⭐ W ODBUDOWIE OŻYWIONA w karcie 14h (ticket 61) — ŚWIADOME ODSTĘPSTWO, nie przywrócenie:
 * backend dokłada `_reguly.promocja` do odpowiedzi `GET /api/products`. Decyzja Ani
 * z 2026-09-18. Kolumna pokazuje „—" tylko wtedy, gdy produktowi nie odpowiada żadna aktywna
 * promocja. Pełny opis: `docs/rebuild-backlog.md` #22.
 */
export const KOLUMNY_DOMYSLNE: string[] = [
  "nazwa",
  "kodImportu",
  "dostawca",
  "marka",
  "cenaZakupu",
  "marzaPct",
  "cenaSprzedazy",
  "promocja",
  "stan",
  "kodDostawcy",
  "ean",
  "rozmiar",
  "rozmiarAlternatywny",
  "model",
  "zastosowanie",
  // Backlog #73 — w produkcji kolumna jest WSTRZYKIWANA, czyli widoczna zawsze i niezależnie
  // od konfiguratora. Domyślnie włączona = ten sam widok co dziś, a Ania może ją schować.
  "blokowaneFormyPlatnosci",
];

/**
 * Trzy kolumny, które tabela pokazuje ZAWSZE i przyklejone do lewej krawędzi,
 * niezależnie od konfiguratora (frontend-index.js:23725-23744). Z listy wybranych
 * kolumn są odfiltrowywane, żeby się nie zdublowały.
 */
export const KOLUMNY_PRZYKLEJONE = ["nazwa", "ean", "dostawca"] as const;

/**
 * Retrofit zapisanej listy kolumn — 1:1 z `MT()` (`frontend-index.js:23032-23035`).
 *
 * Kolumna `kodImportu` doszła do zestawu domyślnego już po tym, jak część użytkowników
 * miała zapisany wybór w IndexedDB. Oryginał dokłada ją takim zapisom tuż za `nazwa`
 * (a gdy `nazwa` nie ma — na początek), żeby nikomu nagle nie zniknęła.
 *
 * Nie jest to martwy kod „na wszelki wypadek": po cutoverze nowy panel stanie pod tą samą
 * domeną co stary, a IndexedDB jest per-origin — czyli zastane zapisy realnie tam będą.
 */
export function uzupelnijKodImportu(zapisane: string[]): string[] {
  if (zapisane.includes("kodImportu")) return zapisane;
  const wynik = [...zapisane];
  const poNazwie = wynik.indexOf("nazwa");
  if (poNazwie >= 0) wynik.splice(poNazwie + 1, 0, "kodImportu");
  else wynik.unshift("kodImportu");
  return wynik;
}

/**
 * Retrofit kolumny blokowanych form płatności (backlog #73) — ta sama potrzeba co przy
 * `uzupelnijKodImportu`, inny powód.
 *
 * W produkcji kolumna jest WSTRZYKIWANA do tabeli, więc konfigurator o niej nie wie i nikt
 * nie ma jej w zapisanym wyborze. U nas jest zwykłą kolumną, a wybór kolumn żyje w IndexedDB
 * — per origin. Po cutoverze nowy panel stanie pod TĄ SAMĄ domeną co stary, więc zastany
 * zapis Ani realnie tam będzie i bez tego retrofitu kolumna po prostu by jej zniknęła,
 * mimo że dziś ją widzi. Dokładamy na KONIEC, czyli tam, gdzie wstrzykiwał ją oryginał.
 */
export function uzupelnijBlokowaneFormy(zapisane: string[]): string[] {
  if (zapisane.includes("blokowaneFormyPlatnosci")) return zapisane;
  return [...zapisane, "blokowaneFormyPlatnosci"];
}
