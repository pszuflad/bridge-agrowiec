/**
 * Przycisk „CSV" w nagłówku karty analityki — plik = to, co widać w tabeli karty
 * (karta P10.3, backlog #91 ✅, decyzje użytkownika 2026-09-21).
 *
 * ⚠ ŚWIADOME ODSTĘPSTWO OD ORYGINAŁU. Oryginalne `M()` (`frontend-index.js:27938-27940`) robi
 * nawigację `window.location.href = /api/analytics/export/<view>` bez query stringu, a serwer
 * ma dla każdego widoku WŁASNY SQL, inny niż karta nad przyciskiem. Plik nie znał więc
 * filtrów, w Marży miał wiersze per produkt zamiast grup, a w Rotacji ignorował „Bez ruchu dni".
 * W produkcji to nie bolało, bo produkcja nie ma paska filtrów — pasek to NASZE odstępstwo
 * O-10a-2 i to odbudowa stworzyła lukę „zaznaczam dostawcę, a w pliku są wszyscy".
 *
 * DLATEGO PLIK POWSTAJE W PRZEGLĄDARCE, z dokładnie tych kolumn, które karta podaje
 * `TabelaAnalityki`:
 *  • filtry globalne i lokalne są już zastosowane — przycisk NIE liczy ich drugi raz;
 *  • plik ma WSZYSTKIE wiersze po filtrach — limit 300 dotyczy tylko rysowania tabeli;
 *  • format i reguła wartości: `csv.ts`.
 *
 * ── SKĄD BIERZE SIĘ „WSZYSTKIE WIERSZE" (karta P10.5, backlog #96) ─────────────────────
 *
 * Do P10.5 plik dostawał tę samą tablicę co tabela — a ta przychodzi z trasy dashboardu,
 * która ma `LIMIT` przepisany z produkcji. „Wszystkie wiersze po filtrach" znaczyło więc
 * naprawdę „wszystkie z pierwszego tysiąca". Na kopii produkcji: „2.5 Pozycje unikalne"
 * 5109 pozycji → plik 1000, karty „4.1"/„4.2" 5184 → plik 500.
 *
 * Decyzja Ani 2026-09-23 („chcę pełne pliki") zdejmuje ten sufit WYŁĄCZNIE dla pliku.
 * Karta z sufitem podaje `pobierzPelne` — funkcję, która dociąga tę samą trasę z `?limit=0`
 * i stosuje na pełnym zbiorze TE SAME filtry co tabela. Tabela nadal rysuje 300 wierszy,
 * kafel „Pozycje unikalne" nadal liczy 1000 (port 1:1, karta PR.2).
 *
 * ⚠ POBRANIE JEST LENIWE — leci dopiero z `onClick`, nie przy wejściu na zakładkę
 * (uzasadnienie i mechanika: `pobierzPelneWiersze` w `api.ts`).
 *
 * ⚠ BŁĄD POBRANIA NIE DAJE PLIKU. Kusi, żeby w razie niepowodzenia zapisać tablicę, którą
 * karta już ma w pamięci — ale to jest dokładnie ucięty plik z #96, tyle że niewidocznie.
 * Zamiast tego pokazujemy komunikat i nie pobieramy nic. Wygasła sesja (`on401: "returnNull"`,
 * czyli `null` zamiast wyjątku) liczy się tu jako błąd, nie jako pusty zbiór.
 *
 * Trasa `GET /api/analytics/export/{view}` zostaje w backendzie i kontrakcie bez zmian
 * (P10.1: lista widoków + 404), ale front jej już nie woła.
 *
 * Pusta tabela po filtrach → plik z samym nagłówkiem (przycisk aktywny). Nieaktywny jest
 * podczas wczytywania karty (plik z tej chwili byłby pusty bez powodu) i na czas pobierania
 * pełnego zbioru.
 */
import { LoaderCircle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { pobierzPlik } from "@/pages/katalog/eksport";

import { zbudujCsvTabeli, type KolumnaCsv } from "./csv";

/**
 * Dziesięć kart z przyciskiem — nazwy `{view}` oryginału (`frontend-index.js:28065`, `:28109`,
 * `:28147`, `:28190`, `:28233`, `:28310`, `:28432`, `:28470`, `:28531`, `:28573`).
 * Dziś służą jako nazwa pliku (`<view>.csv`, jak w `Content-Disposition` serwera) i jako
 * `data-testid`; zamknięta unia pilnuje, żeby karta nie dostała nazwy spoza listy.
 */
export type WidokEksportu =
  | "suppliers-stability"
  | "suppliers-lifecycle"
  | "suppliers-stock"
  | "ean-comparison"
  | "unique"
  | "prices-last"
  | "availability-products"
  | "sell-through"
  | "margins"
  | "rotation-inactive";

export type PrzyciskCsvProps<T> = {
  widok: WidokEksportu;
  /** Wiersze tabeli karty PO filtrach, PRZED `slice(0, 300)` — ta sama tablica co `dane` tabeli. */
  wiersze: readonly T[];
  /** Te same kolumny, którymi karta rysuje tabelę. */
  kolumny: readonly KolumnaCsv<T>[];
  /** Dane karty jeszcze się wczytują — przycisk nieaktywny. */
  wczytywanie?: boolean;
  /**
   * Pełny zbiór do pliku, z sufitem zdjętym i filtrami karty już zastosowanymi (P10.5).
   *
   * Podają go tylko karty, których trasa ma `LIMIT`. Karta bez sufitu
   * (`suppliers-stability`, `suppliers-stock` — trasy bez `LIMIT`-u) prop pomija i plik
   * powstaje z tablicy, którą karta ma już w pamięci, jak przed P10.5.
   *
   * `null` znaczy BŁĄD (np. wygasła sesja), nie „zero wierszy" — wtedy nie ma pliku.
   */
  pobierzPelne?: () => Promise<readonly T[] | null>;
};

/**
 * Markup 1:1 z oryginałem: `<Button variant="outline" size="sm">CSV</Button>` w nagłówku
 * karty, po prawej stronie tytułu. Spinner na czas pobierania pełnego zbioru jest nasz —
 * oryginał nie miał czego pobierać, bo robił nawigację.
 */
export function PrzyciskCsv<T extends Record<string, unknown>>({
  widok,
  wiersze,
  kolumny,
  wczytywanie = false,
  pobierzPelne,
}: PrzyciskCsvProps<T>) {
  const { toast } = useToast();
  const [pobieranie, ustawPobieranie] = useState(false);

  const zapisz = (doZapisu: readonly T[]) =>
    pobierzPlik(`${widok}.csv`, zbudujCsvTabeli(doZapisu, kolumny));

  const obsluzKlikniecie = async () => {
    if (!pobierzPelne) {
      zapisz(wiersze);
      return;
    }

    ustawPobieranie(true);
    try {
      const pelne = await pobierzPelne();
      if (pelne === null) {
        toast({
          title: "Nie udało się pobrać pełnych danych do pliku",
          description: "Sesja mogła wygasnąć. Odśwież stronę i spróbuj ponownie.",
          variant: "destructive",
        });
        return;
      }
      zapisz(pelne);
    } catch (blad) {
      toast({
        title: "Nie udało się pobrać pełnych danych do pliku",
        description: blad instanceof Error ? blad.message : String(blad),
        variant: "destructive",
      });
    } finally {
      ustawPobieranie(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      data-testid={`csv-${widok}`}
      disabled={wczytywanie || pobieranie}
      onClick={() => void obsluzKlikniecie()}
    >
      {pobieranie && <LoaderCircle className="w-4 h-4 mr-2 animate-spin" />}
      CSV
    </Button>
  );
}
