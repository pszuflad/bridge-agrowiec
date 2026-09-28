/**
 * Logika widoku „Dziennik" — surowy audyt z `GET /api/audit-log`.
 *
 * ⚠ DRUGA DEFINICJA `parsujSzczegoly` W REPO, ŚWIADOMA (plan.md D4, decyzja użytkownika).
 * Oryginałem jest `rebuild/backend/src/historia/mapowanie.ts:87` (port `try/catch` z
 * `backend-index.cjs:48338-48342`). Nie da się jej stąd zaimportować: `rebuild/` nie ma
 * wspólnego pakietu, a `backend/` i `frontend/` to dwa rozłączne projekty — w całym froncie
 * nie ma ANI JEDNEGO importu kodu z backendu. Idziemy więc ustalonym wzorcem projektu
 * (`waga-gabarytowa/obliczenia.ts` obok `backend/waga-gabarytowa/formula.ts`,
 * `alerty/api.ts` obok `repos/alerts.ts`): kopia z kotwicą do źródła plus test pilnujący
 * tych samych wejść. Zmieniając jedną, zmień drugą.
 */
import type { WpisAudytu } from "./admin";

/**
 * `szczegoly_json` → obiekt. Port `try { JSON.parse } catch {}` z `:48338-48342`.
 *
 * TRZY WEJŚCIA, KTÓRE NAPRAWDĘ WYSTĘPUJĄ W BAZIE, i każde musi dać `{}`, nie wyjątek:
 *  1. `null` — pisze go m.in. `POST /api/dostawcy/{kod}/synchronizuj-teraz` (`:48240`,
 *     audyt wołany bez czwartego argumentu) oraz `POST /api/products/clear` (`:48332`);
 *  2. tekst, który nie jest poprawnym JSON-em — `JSON.parse` rzuca, oryginał to łyka;
 *  3. poprawny JSON, który nie jest obiektem (`"5"`, `"null"`, tablica) — dostęp do pola
 *     dałby `undefined`, więc sprowadzamy do `{}`.
 *
 * ⚠ To jest widok SUROWEGO audytu, bez filtra akcji, więc parser dotyka KAŻDEGO wiersza —
 * także tych, których `/historia` nigdy nie pokazuje.
 */
export function parsujSzczegoly(szczegolyJson: string | null): Record<string, unknown> {
  if (!szczegolyJson) return {};
  try {
    const wynik: unknown = JSON.parse(szczegolyJson);
    if (typeof wynik !== "object" || wynik === null || Array.isArray(wynik)) return {};
    return wynik as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Jednolinijkowe streszczenie szczegółów do kolumny tabeli.
 *
 * Pełny `szczegoly_json` importu ma kilkanaście pól i tablicę odrzuconych pozycji — wklejony
 * do komórki rozwaliłby układ. Pokazujemy więc `klucz=wartość` dla pól SKALARNYCH, a tablice
 * i obiekty zwijamy do samej nazwy z licznikiem, żeby było widać, że coś tam jest.
 */
export function streszczSzczegoly(szczegolyJson: string | null): string {
  const szczegoly = parsujSzczegoly(szczegolyJson);
  const czesci: string[] = [];

  for (const [klucz, wartosc] of Object.entries(szczegoly)) {
    if (Array.isArray(wartosc)) {
      if (wartosc.length > 0) czesci.push(`${klucz}: ${wartosc.length}`);
      continue;
    }
    if (typeof wartosc === "object" && wartosc !== null) {
      czesci.push(`${klucz}: {…}`);
      continue;
    }
    czesci.push(`${klucz}: ${String(wartosc)}`);
  }

  return czesci.join(" · ");
}

export type FiltryDziennika = {
  /** `"all"` albo konkretna akcja. */
  akcja: string;
  /** `"all"` albo konkretny typ encji. */
  encjaTyp: string;
  /** Fragment szukany w akcji, encji, użytkowniku i szczegółach; puste = bez filtra. */
  szukaj: string;
};

export const FILTRY_POCZATKOWE: FiltryDziennika = { akcja: "all", encjaTyp: "all", szukaj: "" };

/** Wartość używana w `<Select>` dla wierszy, które mają `null` w danej kolumnie. */
export const BRAK_WARTOSCI = "(brak)";

/**
 * Wartości filtra zbierane Z DANYCH, nie z listy zaszytej w kodzie.
 *
 * Zbiór akcji rośnie z każdą iteracją (I11 dołożyła `edycja_konfiguracji` i `edycja_spedycji`,
 * ta sesja — `zmiana_hasla`, `edit_supplier_config`, `czyszczenie_katalogu`,
 * `maintenance_usun_nieopony`), a każda zaszyta lista rozjechałaby się z bazą przy następnej.
 * `null` staje się jawnym `(brak)`, żeby dało się odfiltrować wiersze bez encji.
 */
export function wartosciFiltrow(wpisy: WpisAudytu[]): { akcje: string[]; encje: string[] } {
  const akcje = new Set<string>();
  const encje = new Set<string>();

  for (const wpis of wpisy) {
    akcje.add(wpis.akcja);
    encje.add(wpis.encjaTyp ?? BRAK_WARTOSCI);
  }

  return {
    akcje: [...akcje].sort((a, b) => a.localeCompare(b, "pl")),
    encje: [...encje].sort((a, b) => a.localeCompare(b, "pl")),
  };
}

/**
 * Filtrowanie po stronie klienta — trasa oddaje najwyżej 500 wierszy i nie przyjmuje
 * parametrów (`U.listAudit(500)`), więc nie ma czego delegować na serwer.
 */
export function filtrujWpisy(wpisy: WpisAudytu[], filtry: FiltryDziennika): WpisAudytu[] {
  const szukane = filtry.szukaj.trim().toLowerCase();

  return wpisy.filter((wpis) => {
    if (filtry.akcja !== "all" && wpis.akcja !== filtry.akcja) return false;
    if (filtry.encjaTyp !== "all" && (wpis.encjaTyp ?? BRAK_WARTOSCI) !== filtry.encjaTyp) {
      return false;
    }
    if (!szukane) return true;

    // Szukamy także w szczegółach — tam siedzą nazwy plików, adresy i klucze konfiguracji.
    const stog = [wpis.akcja, wpis.encjaTyp, wpis.encjaId, wpis.uzytkownikImie, wpis.szczegolyJson]
      .filter((x): x is string => typeof x === "string")
      .join(" ")
      .toLowerCase();
    return stog.includes(szukane);
  });
}
