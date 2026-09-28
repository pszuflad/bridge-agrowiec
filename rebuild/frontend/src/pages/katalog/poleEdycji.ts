/**
 * Opis formularza edycji produktu — 42 pola dialogu `LT()` jako DANE.
 *
 * Port `deminified/frontend-index.js:24041-24095` (siatka pól) + `:23966-24019`
 * (pomocniki `f`/`h`/`y`/`g`, czyli input / select / flaga / pole scalone).
 *
 * PO CO OSOBNY PLIK: to jedyny fragment dialogu, który da się przetestować bez renderowania,
 * i jedyne miejsce, w którym da się porównać listę kluczy wysyłanych przez front z listą
 * `POLA_EDYTOWALNE_PRODUKTU` po stronie backendu (12a). Rozjazd tych dwóch list oznacza albo
 * pole, które backend po cichu odrzuci, albo pole, którego Ania nie może już edytować.
 *
 * ⚠ ETYKIETY SĄ DOSŁOWNE, BEZ POLSKICH ZNAKÓW — tak jak w oryginale („Cena sprzedazy",
 * „Bieznik/model", „Szerokosc", „Opor toczenia"). To nie są literówki do poprawienia:
 * odtwarzamy ekran, który Ania zna.
 */

/** Rodzaj kontrolki — odpowiada czterem pomocnikom oryginału. */
export type Kontrolka =
  /** `f` bez `num` (`:23968`). */
  | { typ: "tekst"; mono?: true; span?: true; disabled?: true }
  /**
   * `f` z `num` (`:23968`). `calkowita` rozróżnia `parseInt` (stan, VAT) od `parseFloat`
   * (ceny, wymiary). `step` idzie do atrybutu `step` inputa — oryginał podaje go tylko
   * przy `parseFloat`.
   */
  | { typ: "liczba"; step?: string; calkowita?: true }
  /** `h` z listą stałą (`:23985`) — np. `["aktywny","wstrzymany"]`. */
  | { typ: "select"; opcje: readonly string[] }
  /** `h` z `p(rodzaj)` — ZAWSZE select, nawet gdy słownik pusty (Producent, Kategoria). */
  | { typ: "selectSlownik"; rodzajSlownika: string }
  /**
   * `p(rodzaj).length ? h(...) : f(...)` — select TYLKO gdy słownik ma wartości tego
   * rodzaju, inaczej zwykły input. Dotyczy czterech pól (`:24065,24081,24082,24089`).
   */
  | { typ: "selectAlboTekst"; rodzajSlownika: string }
  /** `y` (`:24000`) — tri-state Tak / Nie / „-". */
  | { typ: "flaga" }
  /** `g` (`:24019`) — jedno pole piszące DWA klucze naraz. */
  | { typ: "scalone"; klucze: readonly [string, string] };

export type PoleEdycji = {
  /** Dosłowna etykieta z oryginału. */
  etykieta: string;
  /**
   * Klucz wiodący. Dla pola scalonego to `model` — po nim idzie odczyt wartości
   * i wybór etykiety override'u (`l.model ? "model" : "bieznik"`, `:24022`).
   */
  klucz: string;
  kontrolka: Kontrolka;
  /** Blok siatki; między nimi oryginał wstawia nagłówek „Parametry techniczne" (`:24060`). */
  sekcja: "naglowek" | "techniczne";
};

/**
 * ⚠ KOLEJNOŚĆ JEST CZĘŚCIĄ PORTU — to kolejność renderowania w oryginale, nie alfabet
 * i nie kolejność kolumn w bazie.
 */
export const POLA_EDYCJI: readonly PoleEdycji[] = [
  // ——— Nagłówek produktu (`:24041-24059`) ———
  { etykieta: "Nazwa", klucz: "nazwa", sekcja: "naglowek", kontrolka: { typ: "tekst", span: true } },
  { etykieta: "Producent", klucz: "marka", sekcja: "naglowek", kontrolka: { typ: "selectSlownik", rodzajSlownika: "marka" } },
  { etykieta: "Kategoria", klucz: "kategoria", sekcja: "naglowek", kontrolka: { typ: "selectSlownik", rodzajSlownika: "kategoria" } },
  // `disabled` w oryginale (`:24048`) — dlatego `dostawca` NIE jest na liście pól
  // edytowalnych backendu: dialog go pokazuje, ale nigdy nie wysyła. Zmiana dostawcy
  // osierociłaby wszystkie `manual_overrides` produktu (kluczują się po `supplierKod`).
  { etykieta: "Dostawca", klucz: "dostawca", sekcja: "naglowek", kontrolka: { typ: "tekst", disabled: true, mono: true } },
  { etykieta: "Kod dostawcy", klucz: "kodDostawcy", sekcja: "naglowek", kontrolka: { typ: "tekst", mono: true } },
  { etykieta: "Stan magazynowy", klucz: "stan", sekcja: "naglowek", kontrolka: { typ: "liczba", calkowita: true } },
  { etykieta: "VAT %", klucz: "vat", sekcja: "naglowek", kontrolka: { typ: "liczba", calkowita: true } },
  { etykieta: "Cena zakupu", klucz: "cenaZakupu", sekcja: "naglowek", kontrolka: { typ: "liczba", step: "0.01" } },
  { etykieta: "Cena sprzedazy", klucz: "cenaSprzedazy", sekcja: "naglowek", kontrolka: { typ: "liczba", step: "0.01" } },
  { etykieta: "EAN", klucz: "ean", sekcja: "naglowek", kontrolka: { typ: "tekst", mono: true } },
  { etykieta: "Status", klucz: "status", sekcja: "naglowek", kontrolka: { typ: "select", opcje: ["aktywny", "wstrzymany"] } },
  { etykieta: "Link do zdjecia", klucz: "linkZdjecia", sekcja: "naglowek", kontrolka: { typ: "tekst", span: true } },

  // ——— Parametry techniczne (`:24064-24095`) ———
  { etykieta: "Rozmiar", klucz: "rozmiar", sekcja: "techniczne", kontrolka: { typ: "selectAlboTekst", rodzajSlownika: "rozmiar" } },
  { etykieta: "Rozmiar alternatywny", klucz: "rozmiarAlternatywny", sekcja: "techniczne", kontrolka: { typ: "tekst" } },
  /**
   * ⚠ `type="number"` + `parseFloat` NA KOLUMNIE TEXT — port 1:1, decyzja D3 planu.
   * Kanon trzyma `szerokosc` jako TEXT (migracja `003_szerokosc_text.sql`, saga `szertxt`,
   * backlog #3), więc ręczna edycja zgubi zera końcowe: „10.00" zapisze się jako „10".
   * To zastane zachowanie produkcji (`:24076-24079`), nie regres odbudowy — odtwarzamy je
   * świadomie razem z wadą.
   */
  { etykieta: "Szerokosc", klucz: "szerokosc", sekcja: "techniczne", kontrolka: { typ: "liczba", step: "0.01" } },
  { etykieta: "Profil", klucz: "profil", sekcja: "techniczne", kontrolka: { typ: "liczba", step: "0.01" } },
  { etykieta: "Srednica", klucz: "srednica", sekcja: "techniczne", kontrolka: { typ: "liczba", step: "0.01" } },
  // ⚠ „-" to REALNA wartość konstrukcji (opona diagonalna bez oznaczenia), nie placeholder.
  // Placeholderem jest osobna pozycja „__empty" → `null`, dokładana przy renderowaniu.
  { etykieta: "Konstrukcja", klucz: "konstrukcja", sekcja: "techniczne", kontrolka: { typ: "select", opcje: ["R", "D", "B", "-"] } },
  // ⚠ RODZAJ SŁOWNIKOWY JEST snake_case, A POLE camelCase — nie da się wyprowadzić jednego
  // z drugiego (`:24081-24082`).
  { etykieta: "Indeks nosnosci (LI)", klucz: "indeksNosnosci", sekcja: "techniczne", kontrolka: { typ: "selectAlboTekst", rodzajSlownika: "indeks_nosnosci" } },
  { etykieta: "Indeks predkosci (SI)", klucz: "indeksPredkosci", sekcja: "techniczne", kontrolka: { typ: "selectAlboTekst", rodzajSlownika: "indeks_predkosci" } },
  { etykieta: "VF/IF", klucz: "vfIf", sekcja: "techniczne", kontrolka: { typ: "select", opcje: ["VF", "IF", "CFO"] } },
  { etykieta: "PR / PLY", klucz: "pr", sekcja: "techniczne", kontrolka: { typ: "tekst" } },
  { etykieta: "TL/TT", klucz: "tlTt", sekcja: "techniczne", kontrolka: { typ: "select", opcje: ["TL", "TT"] } },
  { etykieta: "DOT", klucz: "dot", sekcja: "techniczne", kontrolka: { typ: "tekst" } },
  { etykieta: "Waga", klucz: "waga", sekcja: "techniczne", kontrolka: { typ: "liczba", step: "0.01" } },
  // Jedno pole, DWA klucze w payloadzie — oryginał trzyma `model` i `bieznik` zsynchronizowane.
  { etykieta: "Bieznik/model", klucz: "model", sekcja: "techniczne", kontrolka: { typ: "scalone", klucze: ["model", "bieznik"] } },
  { etykieta: "Oznaczenie bieznika", klucz: "oznaczenieBieznika", sekcja: "techniczne", kontrolka: { typ: "tekst" } },
  { etykieta: "Sezon", klucz: "sezon", sekcja: "techniczne", kontrolka: { typ: "selectAlboTekst", rodzajSlownika: "sezon" } },
  { etykieta: "Wentyl", klucz: "wentyl", sekcja: "techniczne", kontrolka: { typ: "tekst" } },
  { etykieta: "Bloto + snieg (M+S)", klucz: "ms", sekcja: "techniczne", kontrolka: { typ: "flaga" } },
  { etykieta: "Snieg 3PMSF", klucz: "snow3pmsf", sekcja: "techniczne", kontrolka: { typ: "flaga" } },
  { etykieta: "CFO", klucz: "cfo", sekcja: "techniczne", kontrolka: { typ: "flaga" } },
  { etykieta: "SB", klucz: "sb", sekcja: "techniczne", kontrolka: { typ: "flaga" } },
  { etykieta: "SF", klucz: "sf", sekcja: "techniczne", kontrolka: { typ: "flaga" } },
  { etykieta: "NRO", klucz: "nro", sekcja: "techniczne", kontrolka: { typ: "flaga" } },
  { etykieta: "CHO", klucz: "cho", sekcja: "techniczne", kontrolka: { typ: "flaga" } },
  { etykieta: "Stubble Resistant", klucz: "stubbleResistant", sekcja: "techniczne", kontrolka: { typ: "flaga" } },
  { etykieta: "Opor toczenia", klucz: "labelRolling", sekcja: "techniczne", kontrolka: { typ: "tekst" } },
  { etykieta: "Przyczepnosc", klucz: "labelWet", sekcja: "techniczne", kontrolka: { typ: "tekst" } },
  { etykieta: "Halas", klucz: "labelNoise", sekcja: "techniczne", kontrolka: { typ: "tekst" } },
  { etykieta: "Lod", klucz: "labelIce", sekcja: "techniczne", kontrolka: { typ: "tekst" } },
  { etykieta: "Snieg", klucz: "labelSnow", sekcja: "techniczne", kontrolka: { typ: "tekst" } },
];

/**
 * Klucze, które formularz może realnie wysłać — musi się zgadzać co do jednego
 * z `POLA_EDYTOWALNE_PRODUKTU` (`backend/src/repos/products.ts`).
 *
 * Dwie asymetrie wobec `POLA_EDYCJI`: `dostawca` wypada (jest `disabled`), a pole scalone
 * „Bieznik/model" wnosi DWA klucze. Stąd 42 pola siatki dają 42 klucze payloadu, choć nie
 * są to te same 42 nazwy.
 */
export const KLUCZE_PAYLOADU: readonly string[] = POLA_EDYCJI.flatMap((pole) => {
  if (pole.kontrolka.typ === "scalone") return [...pole.kontrolka.klucze];
  if (pole.kontrolka.typ === "tekst" && pole.kontrolka.disabled) return [];
  return [pole.klucz];
});

/** Wartość wybieralna słownika — ten sam kształt, co w `filtrowanie.ts`. */
export type WartoscSlownika = { rodzaj: string; wartosc: string };

/**
 * Opcje selecta ze słownika atrybutów — port pomocnika `p` (`:23966`).
 *
 * Sortowanie `localeCompare(…, "pl")` jest istotne: bez lokalizacji „Ł" wypada za „Z".
 * ⚠ To INNA reguła niż listy filtrów katalogu (7c), które SUMUJĄ słownik z danymi katalogu.
 * Tutaj źródłem jest wyłącznie słownik — pole edycji ma pokazywać wartości dozwolone,
 * a nie te, które akurat wystąpiły w imporcie.
 */
export function opcjeSlownika(
  wartosci: readonly WartoscSlownika[] | undefined,
  rodzaj: string,
): string[] {
  return (wartosci ?? [])
    .filter((wartosc) => wartosc.rodzaj === rodzaj)
    .map((wartosc) => wartosc.wartosc)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "pl"));
}

/**
 * Parser pola liczbowego — port `:24070-24075`.
 *
 * Pusty string i wartość nieparsowalna dają `null`, nie `NaN`: oryginał jawnie testuje
 * `isNaN` i podstawia `null`, więc do backendu nigdy nie leci `NaN` (który i tak nie
 * przetrwałby `JSON.stringify` — zamieniłby się w `null` po cichu, ale przez inną drogę).
 */
export function parsujLiczbe(tekst: string, calkowita = false): number | null {
  if (tekst === "") return null;
  const liczba = calkowita ? parseInt(tekst, 10) : parseFloat(tekst);
  return Number.isNaN(liczba) ? null : liczba;
}

/** Wartość wybrana w selectcie „pusty" — oryginał używa tego samego sentinela (`:23987`). */
export const PUSTA_OPCJA = "__empty";

/** Flaga → wartość selecta (`:24002`). Cokolwiek poza `true`/`false` jest „-". */
export function flagaNaOpcje(wartosc: unknown): string {
  if (wartosc === true) return "true";
  if (wartosc === false) return "false";
  return PUSTA_OPCJA;
}

/** Opcja selecta → flaga (`:24003`). `"true"` → `true`, `"false"` → `false`, reszta → `null`. */
export function opcjaNaFlage(opcja: string): boolean | null {
  if (opcja === "true") return true;
  if (opcja === "false") return false;
  return null;
}
