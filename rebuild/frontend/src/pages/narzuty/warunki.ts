/**
 * Warunki reguł cenowych — (de)serializacja i etykiety.
 *
 * ⚠ `warunki` jedzie przez API jako STRING ze zserializowanym JSON-em, nie jako tablica
 * (`contract/fixtures/GET_markups.json`: `"warunki": "[]"`). Backend też trzyma to jako TEXT
 * i sam parsuje (`rebuild/backend/src/repos/ceny.ts`). Formularz musi więc serializować
 * przed wysłaniem, a widok — parsować po odczycie.
 */

/** Pojedynczy warunek dopasowania. Oba pola bywają w bazie czymkolwiek — parsujemy defensywnie. */
export type Warunek = {
  typ: string;
  wartosc: string;
};

/**
 * Typy warunku dostępne w formularzu.
 *
 * ⚠ ODSTĘPSTWO ŚWIADOME (plan.md D4): oryginał wystawia w UI SZEŚĆ typów (`X0`,
 * `frontend-index.js:24143-24159`) — dostawca, kategoria, marka, rozmiar, bieżnik, produkt —
 * mimo że silnik rozumie DZIEWIĘĆ (`repos/ceny.ts`, `dopasujWarunek`). Trzy ostatnie
 * (`konstrukcja`, `srednica`, `vfIf`) były z UI nieosiągalne. Dokładamy je, bo backend
 * je obsługuje, a luka wyglądała na przeoczenie, nie na decyzję: `srednica` ma nawet gotowy
 * placeholder w oryginalnym formularzu (`:24318`), choć nie da się jej wybrać.
 *
 * Etykiety sześciu pierwszych — dosłownie z oryginału, razem z dopiskami „(fragment tekstu)",
 * które mówią o dopasowaniu przez zawieranie.
 */
export const TYPY_WARUNKU = [
  { value: "dostawca", label: "Dostawca" },
  { value: "kategoria", label: "Kategoria" },
  { value: "marka", label: "Marka" },
  { value: "rozmiar", label: "Rozmiar (fragment tekstu)" },
  { value: "bieznik", label: "Bieżnik (fragment tekstu)" },
  { value: "produkt", label: "Konkretny produkt (kod)" },
  // Dołożone w 4b — patrz nota wyżej.
  { value: "konstrukcja", label: "Konstrukcja (fragment tekstu)" },
  { value: "srednica", label: "Średnica (dokładna)" },
  { value: "vfIf", label: "VF / IF (fragment tekstu)" },
] as const;

export type TypWarunku = (typeof TYPY_WARUNKU)[number]["value"];

/**
 * Typy, dla których wartość WYBIERA się z listy, a nie wpisuje, mieszkają teraz w `slownik.ts`
 * (`opcjeWarunku`) — razem z regułą, skąd ta lista pochodzi. Dawna stała `TYPY_ZE_SLOWNIKA`
 * wymieniała trzy typy i milcząco zakładała, że wszystkie trzy powstają z danych katalogu;
 * po sesji 7b to nieprawda dla żadnego z nich (marki = słownik ∪ katalog, kategorie = sam
 * słownik, dostawcy = `/api/suppliers`), a doszły jeszcze `konstrukcja` i `vfIf`.
 */

/** Podpowiedzi w polu wartości — 1:1 z oryginałem (`:24318`). */
export function placeholderWartosci(typ: string): string {
  if (typ === "produkt") return "np. 10000085";
  if (typ === "srednica") return "np. 38";
  if (typ === "rozmiar") return "np. 710/70R42";
  if (typ === "bieznik") return "np. AGRO 10";
  return "wartość";
}

/**
 * Parsowanie kolumny `warunki` — port `Ji()`/`$i()` z oryginału.
 *
 * Uszkodzony JSON, `null` i wartość, która nie jest tablicą, dają PUSTĄ LISTĘ. Backend robi
 * dokładnie to samo (`warunkiZKolumny` w `repos/ceny.ts`), i to nie jest przypadek: reguła
 * z zepsutymi warunkami ma degradować się do dopasowania po `typ`/`zakres`, a nie wywracać
 * liczenia cen.
 */
export function odczytajWarunki(surowe: string | null | undefined): Warunek[] {
  if (!surowe) return [];
  try {
    const rozpakowane: unknown = JSON.parse(surowe);
    if (!Array.isArray(rozpakowane)) return [];
    return rozpakowane
      .filter((w): w is Record<string, unknown> => typeof w === "object" && w !== null)
      .map((w) => ({ typ: String(w.typ ?? ""), wartosc: String(w.wartosc ?? "") }));
  } catch {
    return [];
  }
}

/** Serializacja do zapisu. Pusta lista to `"[]"` — tak wygląda reguła globalna w fixture. */
export function zapiszWarunki(warunki: Warunek[]): string {
  return JSON.stringify(warunki);
}

/** Etykieta typu do wyświetlenia; nieznany typ pokazujemy surowo, zamiast go ukrywać. */
export function etykietaTypu(typ: string): string {
  return TYPY_WARUNKU.find((t) => t.value === typ)?.label ?? typ;
}

/**
 * Opis reguły jednym zdaniem — port `:24174`.
 * Separator to DWIE spacje wokół plusa, dokładnie jak w oryginale.
 */
export function opiszWarunki(warunki: Warunek[]): string {
  if (warunki.length === 0) return "Wszystkie produkty (globalny)";
  return warunki.map((w) => `${etykietaTypu(w.typ)}: ${w.wartosc}`).join("  +  ");
}
