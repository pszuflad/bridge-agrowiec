/**
 * Konfigurator kolumn stagingu — dane i pamięć wyboru.
 *
 * WCHŁONIĘTY SKRYPT DOM-owy, nie nowa funkcja. W oryginale to nie jest komponent Reacta,
 * tylko blok `/* === STAGING COLUMN VISIBILITY ENHANCER V2 === *\/` doklejony do bundla
 * (`deminified/frontend-index.js:28801-29360`): sam znajdował tabelę po
 * `tr[data-testid^="row-staging-"]`, taggował komórki atrybutem `data-scol`, wstrzykiwał
 * przycisk do paska i ukrywał kolumny wstrzykniętym `<style>`. Wchłaniamy go tak samo, jak
 * sesja 3f-2 wchłonęła `freq-injection.js` do `konfiguracja/Dostawcy.tsx`: lista kolumn,
 * etykiety, klucz pamięci i semantyka skrótów są JEGO, znika warstwa manipulacji DOM-em.
 *
 * ⚠ DEMINIFIKAT JEST TU WIARYGODNY, mimo że jest bundlem z 13.08 (sprzed czterech łatek FE).
 * `STAGING_COLS` i `POS_KEYS` w ŻYWYM bundlu (`main:mirror/frontend/assets/index-PRICEFMT1783512500.js`,
 * ścieżka z `mirror/frontend/index.html`) są z nim bajt w bajt identyczne — żadna z łatek
 * tego enhancera nie tknęła. Sprawdzone przy 14b (`51-FEATURE-staging-filtr-pasek-kolumny`).
 */

/** Jedna pozycja listy kolumn — odpowiednik wpisu `STAGING_COLS` (`fe.js:28808`). */
export type KolumnaStagingu = {
  klucz: string;
  etykieta: string;
  /** `locked` — kolumny bez przełącznika, zawsze widoczne (`checkbox`, `akcje`). */
  zablokowana?: boolean;
  /** `def` — widoczna po pierwszym wejściu. ⚠ `stan`, `cenaZ` i `cenaS` jej NIE MAJĄ. */
  domyslna?: boolean;
  /**
   * `extra` — pozycja sekcji „Dodatkowe (z katalogu)".
   *
   * ⭐ TE PRZEŁĄCZNIKI NIC NIE ROBIĄ i tak ma zostać. `applyCss()` w oryginale zaczyna od
   * `if (c.extra) return` (`fe.js:29133`), więc 49 pozycji tej sekcji zapisuje się do pamięci
   * i na tym się kończy — sam popover mówi to wprost użytkownikowi („Te kolumny nie są jeszcze
   * wyświetlane w tabeli stagingu."). To niedokończona funkcja, która pojechała na produkcję;
   * odtwarzamy ją 1:1 (decyzja D3 przy 14b), nie oceniamy.
   */
  dodatkowa?: boolean;
};

/**
 * Lista kolumn 1:1 z `STAGING_COLS` (`fe.js:28808-29105`) — 61 pozycji w tej samej kolejności.
 *
 * Etykiety przepisane DOSŁOWNIE, łącznie z niekonsekwencjami oryginału: `marza_pct`, `vat`,
 * `status` i `data_aktualizacji` małą literą, `Srednica` i `Dlugosc` bez ogonków,
 * `Bloto+snieg`, `Producent-opony` z myślnikiem. Nie ujednolicać — to jest tekst, który
 * Ania widzi dziś w produkcji.
 */
export const KOLUMNY_STAGINGU: readonly KolumnaStagingu[] = [
  { klucz: "checkbox", etykieta: "☑", zablokowana: true, domyslna: true },
  { klucz: "typ", etykieta: "Typ", domyslna: true },
  { klucz: "kod", etykieta: "Kod", domyslna: true },
  { klucz: "nazwa", etykieta: "Nazwa", domyslna: true },
  { klucz: "dostawca", etykieta: "Dostawca", domyslna: true },
  { klucz: "magazyn", etykieta: "Magazyn", domyslna: true },
  { klucz: "stan", etykieta: "Stan" },
  { klucz: "cenaZ", etykieta: "Cena zakupu" },
  { klucz: "cenaS", etykieta: "Cena sprzedaży" },
  { klucz: "zmiana", etykieta: "Zmiana", domyslna: true },
  { klucz: "powod", etykieta: "Powód", domyslna: true },
  { klucz: "akcje", etykieta: "Akcje", zablokowana: true, domyslna: true },
  { klucz: "ex_marka", etykieta: "Producent-opony", dodatkowa: true },
  { klucz: "ex_marzaPct", etykieta: "marza_pct", dodatkowa: true },
  { klucz: "ex_ean", etykieta: "EAN", dodatkowa: true },
  { klucz: "ex_rozmiar", etykieta: "Rozmiar", dodatkowa: true },
  { klucz: "ex_rozmiarAlternatywny", etykieta: "Rozmiar-alternatywny", dodatkowa: true },
  { klucz: "ex_model", etykieta: "Bieznik/model", dodatkowa: true },
  { klucz: "ex_szerokosc", etykieta: "Szerokość opony", dodatkowa: true },
  { klucz: "ex_profil", etykieta: "Profil", dodatkowa: true },
  { klucz: "ex_srednica", etykieta: "Srednica", dodatkowa: true },
  { klucz: "ex_indeksNosnosci", etykieta: "Indeks-nosnosci", dodatkowa: true },
  { klucz: "ex_indeksPredkosci", etykieta: "Indeks-predkosci", dodatkowa: true },
  { klucz: "ex_indeksy", etykieta: "Indeksy", dodatkowa: true },
  { klucz: "ex_kategoria", etykieta: "Kategoria", dodatkowa: true },
  { klucz: "ex_dot", etykieta: "DOT", dodatkowa: true },
  { klucz: "ex_waga", etykieta: "Waga", dodatkowa: true },
  { klucz: "ex_tlTt", etykieta: "TL/TT", dodatkowa: true },
  { klucz: "ex_pr", etykieta: "Ilość płócien", dodatkowa: true },
  { klucz: "ex_konstrukcja", etykieta: "Konstrukcja opony", dodatkowa: true },
  { klucz: "ex_vfIf", etykieta: "IF/VF", dodatkowa: true },
  { klucz: "ex_oznaczenieBieznika", etykieta: "Oznaczenie-bieznika", dodatkowa: true },
  { klucz: "ex_linkZdjecia", etykieta: "Link-do-zdjecia", dodatkowa: true },
  { klucz: "ex_sezon", etykieta: "Sezon", dodatkowa: true },
  { klucz: "ex_ms", etykieta: "Bloto+snieg", dodatkowa: true },
  { klucz: "ex_snow3pmsf", etykieta: "Snieg-3PMSF", dodatkowa: true },
  { klucz: "ex_wentyl", etykieta: "Wentyl", dodatkowa: true },
  { klucz: "ex_cfo", etykieta: "CFO", dodatkowa: true },
  { klucz: "ex_sf", etykieta: "SF", dodatkowa: true },
  { klucz: "ex_sb", etykieta: "SB", dodatkowa: true },
  { klucz: "ex_nro", etykieta: "NRO", dodatkowa: true },
  { klucz: "ex_cho", etykieta: "CHO", dodatkowa: true },
  { klucz: "ex_hf", etykieta: "HF", dodatkowa: true },
  { klucz: "ex_ls", etykieta: "LS", dodatkowa: true },
  { klucz: "ex_reinforced", etykieta: "Reinforced", dodatkowa: true },
  { klucz: "ex_extraLoad", etykieta: "ExtraLoad", dodatkowa: true },
  { klucz: "ex_cutResistant", etykieta: "CutResistant", dodatkowa: true },
  { klucz: "ex_heatResistant", etykieta: "HeatResistant", dodatkowa: true },
  { klucz: "ex_stubbleResistant", etykieta: "StubbleResistant", dodatkowa: true },
  { klucz: "ex_dostepnosc", etykieta: "Dostepnosc", dodatkowa: true },
  { klucz: "ex_dlugosc", etykieta: "Dlugosc", dodatkowa: true },
  { klucz: "ex_szerokoscPaczki", etykieta: "Szerokosc-paczki", dodatkowa: true },
  { klucz: "ex_wysokosc", etykieta: "Wysokosc", dodatkowa: true },
  { klucz: "ex_labelRolling", etykieta: "Opor-toczenia", dodatkowa: true },
  { klucz: "ex_labelWet", etykieta: "Przyczepnosc", dodatkowa: true },
  { klucz: "ex_labelNoise", etykieta: "Halas", dodatkowa: true },
  { klucz: "ex_labelIce", etykieta: "Lod", dodatkowa: true },
  { klucz: "ex_labelSnow", etykieta: "Snieg", dodatkowa: true },
  { klucz: "ex_vat", etykieta: "vat", dodatkowa: true },
  { klucz: "ex_status", etykieta: "status", dodatkowa: true },
  { klucz: "ex_dataAktualizacji", etykieta: "data_aktualizacji", dodatkowa: true },];

/**
 * Kolejność kolumn RZECZYWIŚCIE renderowanych w tabeli — `POS_KEYS` (`fe.js:29155`).
 *
 * Oryginał mapował kolumny POZYCYJNIE: brał `i`-ty `<th>` i przypisywał mu `POS_KEYS[i]`.
 * Dlatego kolejność w `TabelaStagingu.tsx` musi się zgadzać co do jednej pozycji — przy 14b
 * wróciła tu kolumna `magazyn`, którą odbudowa trzymała za `cenaS` (decyzja D2).
 */
export const KOLEJNOSC_KOLUMN = [
  "checkbox",
  "typ",
  "kod",
  "nazwa",
  "dostawca",
  "magazyn",
  "stan",
  "cenaZ",
  "cenaS",
  "zmiana",
  "powod",
  "akcje",
] as const;

/** Klucz w `localStorage` — 1:1 z oryginałem (`fe.js:29107`), żeby wybór przeżył cutover. */
export const KLUCZ_KOLUMN_STAGINGU = "bridge_staging_cols_v2";

/** Mapa `klucz → widoczna`, w tym kształcie leży w pamięci przeglądarki. */
export type WidocznoscKolumn = Record<string, boolean>;

/** Stan po pierwszym wejściu — `loadPrefs()` bez wpisu w pamięci (`fe.js:29115-29119`). */
export function domyslneKolumny(): WidocznoscKolumn {
  const stan: WidocznoscKolumn = {};
  for (const kolumna of KOLUMNY_STAGINGU) {
    stan[kolumna.klucz] = !!(kolumna.zablokowana || kolumna.domyslna);
  }
  return stan;
}

/**
 * Odczyt wyboru z pamięci — port `loadPrefs()` (`fe.js:29109-29121`).
 *
 * ⚠ ZAPISANY WPIS BIERZEMY W CAŁOŚCI, bez scalania z domyślnymi — dokładnie jak oryginał
 * (`if (raw) return JSON.parse(raw)`). Skutek: klucz dodany do listy w przyszłości będzie
 * dla starego wpisu `undefined`, czyli ukryty, dopóki użytkownik nie kliknie „Domyślne".
 * To zachowanie produkcji, nie przeoczenie — nie „naprawiać" scalaniem.
 *
 * Błędy są POŁYKANE (brak `localStorage`, prywatne okno, uszkodzony JSON) — wtedy wracamy
 * do domyślnych zamiast wywracać widok.
 */
export function wczytajKolumny(): WidocznoscKolumn {
  try {
    const surowe = localStorage.getItem(KLUCZ_KOLUMN_STAGINGU);
    if (surowe) return JSON.parse(surowe) as WidocznoscKolumn;
  } catch {
    // Oryginał: `catch (e) {}` — cisza i domyślne.
  }
  return domyslneKolumny();
}

/** Zapis wyboru — port `savePrefs()` (`fe.js:29123-29129`), też połyka błędy. */
export function zapiszKolumny(stan: WidocznoscKolumn): void {
  try {
    localStorage.setItem(KLUCZ_KOLUMN_STAGINGU, JSON.stringify(stan));
  } catch {
    // Oryginał: `catch (e) {}` — brak miejsca albo zablokowana pamięć nie psuje klikania.
  }
}
