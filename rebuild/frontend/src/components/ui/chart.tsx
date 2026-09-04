/**
 * Infrastruktura wykresów analityki — cienka warstwa nad Recharts (blok 10a).
 *
 * ⚠ ORYGINAŁ NIE MA ŻADNYCH WYKRESÓW. Grep po `mirror/frontend/assets/*.js` za `recharts`,
 * `chart.js`, `d3`, `apexcharts`, `echarts` i `nivo` nie daje ani jednego trafienia — cała
 * wizualizacja widoku `/analityka` (`deminified/frontend-index.js:27804-28640`) to tabele
 * i pasek postępu z dwóch `<div>`. Wykresy są więc ŚWIADOMYM ODSTĘPSTWEM (O-10a-3, decyzja
 * użytkownika D1 z 2026-09-03), a nie odtworzeniem. Ten plik jest wspólną podstawą dla
 * bloków 10b–10e, żeby każdy z nich nie wnosił własnej biblioteki i własnej palety.
 *
 * Dlaczego nie `chart.tsx` z shadcn/ui: tamten celuje w Recharts 2.x i wnosi warstwę
 * konfiguracji (`ChartConfig`, wstrzykiwanie zmiennych CSS), której przy jednej palecie
 * z motywu nie potrzebujemy. Bierzemy Recharts 3.x i trzymamy powierzchnię minimalną.
 *
 * ─── PALETA: WYNIK WALIDACJI, NIE WYCZUCIE ────────────────────────────────────────────
 * Tokeny `--chart-1..5` przyszły z surowego arkusza produkcji w I1 i chroni je test-strażnik
 * `test/tokeny.test.ts` — NIE WOLNO ich tu zmieniać. Przepuszczone przez walidator ze skilla
 * `dataviz` (`scripts/validate_palette.js`):
 *
 *   jasny  #d98e26,#3969ac,#33998d,#e87d30,#435670 (tło #f9fafb)
 *     PASS pasmo jasności · PASS rozróżnialność CVD ΔE 11.5 · PASS widzenie normalne ΔE 16.4
 *     FAIL próg chromy: #33998d (0.094) i #435670 (0.049) czytają się szaro
 *     WARN kontrast do tła: #d98e26 (2.61) i #e87d30 (2.76) poniżej 3:1
 *   ciemny #e6a64c,#709ddb,#4dcbbd,#e68c4c,#9cb3c9 (tło #161d27)
 *     PASS rozróżnialność CVD ΔE 12.4 · PASS widzenie normalne ΔE 15.0 · PASS kontrast
 *     FAIL pasmo jasności (wszystkie 5 powyżej) · FAIL próg chromy: #9cb3c9 (0.041)
 *
 * Twarde checki — rozróżnialność przy daltonizmie i przy widzeniu normalnym — przechodzą
 * w obu trybach, więc paleta nadaje się do kodowania serii. Reszta to ostrzeżenia, które
 * skill każe zdjąć ULGĄ, nie zmianą koloru, i ta ulga jest w tym projekcie obowiązkowa:
 *
 *   1. pod każdym wykresem stoi TABELA z tymi samymi liczbami (zdejmuje WARN kontrastu —
 *      „visible labels or a table view"),
 *   2. wartości są wypisane bezpośrednio przy końcach słupków,
 *   3. maksymalnie CZTERY serie na wykres; piąta i dalsze składają się w „Pozostałe",
 *   4. kolejność sięgania po sloty: 1 → 2 → 4 → 3 → 5. Sloty 3 i 5 mają najniższą chromę,
 *      więc idą na końcu, gdy serii jest dużo, a nie na początku.
 *
 * Zasady, których nie wolno złamać (`dataviz`, „Non-negotiables"): nigdy dwie osie Y;
 * kolor przypisany do BYTU, nie do pozycji w rankingu (filtr nie może przemalować
 * ocalałych serii); przy ≥2 seriach legenda zawsze obecna, przy jednej — nigdy.
 */
import type { ReactElement } from "react";
import { ResponsiveContainer } from "recharts";

import { cn } from "@/lib/utils";

/**
 * Sloty kategorialne w kolejności sięgania (patrz punkt 4 wyżej). Zwracamy referencję do
 * zmiennej CSS, a nie wartość — dzięki temu przełączenie motywu jasny/ciemny podmienia
 * kolor bez przerysowywania Reactem.
 */
export const KOLORY_WYKRESU = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-5))",
] as const;

/** Maksymalna liczba serii kategorialnych na jednym wykresie — patrz punkt 3. */
export const MAX_SERII = 4;

/** Kolor pojedynczej serii (wykres jednoserialny nie potrzebuje ani legendy, ani palety). */
export const KOLOR_SERII = KOLORY_WYKRESU[0];

/** Siatka i osie: jeden krok od tła, włos grubości, ciągłe — mają być recesywne. */
export const KOLOR_SIATKI = "hsl(var(--border))";
/** Etykiety osi noszą token tekstu, nigdy koloru serii. */
export const KOLOR_ETYKIET = "hsl(var(--muted-foreground))";

/** Zaokrąglenie końca słupka POZIOMEGO: 4px na końcu z danymi, kwadrat przy linii bazowej. */
export const PROMIEN_SLUPKA: [number, number, number, number] = [0, 4, 4, 0];
/**
 * To samo dla słupka PIONOWEGO — zaokrąglona góra, kwadratowy dół.
 *
 * Osobna stała, bo Recharts liczy `radius` w kolejności [lewy-górny, prawy-górny,
 * prawy-dolny, lewy-dolny] niezależnie od orientacji: użycie poziomego wariantu na wykresie
 * pionowym zaokrągliłoby prawą krawędź słupka zamiast jego końca z danymi.
 */
export const PROMIEN_SLUPKA_PIONOWEGO: [number, number, number, number] = [4, 4, 0, 0];
/** Grubość słupka — kapujemy poniżej 24px, resztę pasma zostawiamy jako powietrze. */
export const GRUBOSC_SLUPKA = 18;

export type KontenerWykresuProps = {
  /** Wysokość w pikselach — `ResponsiveContainer` wymaga rodzica o znanej wysokości. */
  wysokosc: number;
  /**
   * Opis dla czytnika ekranu. Wykres jest grafiką; liczby i tak są w tabeli pod nim,
   * więc tutaj wystarczy zdanie mówiące, co przedstawia.
   */
  opis: string;
  className?: string;
  children: ReactElement;
};

export function KontenerWykresu({ wysokosc, opis, className, children }: KontenerWykresuProps) {
  return (
    <div className={cn("w-full", className)} style={{ height: wysokosc }} role="img" aria-label={opis}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

export type PozycjaTooltipa = {
  nazwa: string;
  wartosc: string;
  kolor?: string;
};

/**
 * Zawartość dymka — wspólny wygląd dla wszystkich wykresów analityki.
 *
 * Recharts woła `content` z własnym, luźno typowanym ładunkiem, więc każdy wykres mapuje
 * go na `PozycjaTooltipa` u siebie (tam wie, co znaczą jego pola) i podaje gotowe napisy.
 * Dzięki temu formatowanie liczb zostaje w jednym miejscu — `pages/analityka/formatowanie.ts`.
 */
export function TrescTooltipa({ tytul, pozycje }: { tytul: string; pozycje: PozycjaTooltipa[] }) {
  return (
    <div className="rounded-md border border-popover-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-medium text-popover-foreground">{tytul}</div>
      {pozycje.map((p) => (
        <div key={p.nazwa} className="flex items-center gap-2 text-muted-foreground">
          {p.kolor && (
            <span
              aria-hidden
              className="inline-block h-2 w-2 shrink-0 rounded-sm"
              style={{ backgroundColor: p.kolor }}
            />
          )}
          <span>{p.nazwa}</span>
          <span className="ml-auto font-mono text-popover-foreground">{p.wartosc}</span>
        </div>
      ))}
    </div>
  );
}
