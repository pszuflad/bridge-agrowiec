/**
 * Nagłówek analityki — banner o zasięgu historii cen + cztery kafle KPI. Oba 1:1 z oryginałem
 * (`deminified/frontend-index.js:27980-28030`, `zM()`; żywy bundel
 * `index-PRICEFMT1783512500.js` jest w tym fragmencie identyczny).
 *
 * Kafle liczy KLIENT z tras, które widok i tak pobiera — nagłówek nie ma własnego zapytania:
 *
 *   „Dostawcy"         ← `filters.dostawcy.length`
 *   „EAN wspólne"      ← `ean/comparison`.rows.length
 *   „Pozycje unikalne" ← `ean/unique`.rows.length
 *   „Snapshoty"        ← `status.snapshots`
 *
 * Do ticketu 97 (karta PR.2, 2026-09-22) kafle brały się z `GET /api/analytics/kpi`
 * („Produkty / Dostawcy / Śr. marża / Staging oczekujące") — odstępstwo O-10a-1 z bloku 10a,
 * bo wtedy nie było jeszcze tras EAN. O-10a-1 jest ZAMKNIĘTE. Trasa `/kpi` zostaje
 * w backendzie i kontrakcie, ale UI jej nie woła — tak jak produkcyjny frontend.
 *
 * Kafle liczą CAŁOŚĆ i nie reagują na pasek filtrów (O-10a-2): oryginał filtrów nie ma,
 * a cztery trasy wołane są bez parametrów.
 *
 * ⚠ `ean/comparison` i `ean/unique` mają w backendzie `LIMIT 1000`, jak oryginał — kafle EAN
 * pokażą najwyżej 1000, nawet gdy EAN-ów jest więcej. To zachowanie produkcji, nie błąd.
 *
 * Banner znacznik czasu przepuszcza surowo przez `_()` (`:27922`), też 1:1.
 */
import { Card, CardContent } from "@/components/ui/card";

import type { Filtry, StatusHistorii, WierszPorownaniaEan, WierszUnikalnegoEan } from "./api";
import { formatujZnacznik } from "./formatowanie";

/** Komunikat o zasięgu historii — oba warianty verbatim z `:27922`. */
export function komunikatHistorii(status: StatusHistorii | null | undefined): string {
  if (status?.hasHistory) {
    return `Historia cen: ${status.snapshots} snapshotów od ${formatujZnacznik(status.od)}`;
  }
  return "Historia cen dopiero zacznie się zbierać po wdrożeniu. Widoki czasowe pokazują teraz dane bieżące albo pustą tabelę.";
}

export type DaneKafli = {
  filtry: Filtry | null | undefined;
  status: StatusHistorii | null | undefined;
  porownanieEan: { rows?: WierszPorownaniaEan[] } | null | undefined;
  unikalneEan: { rows?: WierszUnikalnegoEan[] } | null | undefined;
};

/**
 * Wartości czterech kafli — semantyka pustych stanów 1:1 z oryginałem, który NIE jest tu
 * symetryczny. Oryginał destrukturyzuje z domyślnymi `data: f = {}`, `v = { rows: [] }`,
 * `b = { rows: [] }`, `p = {}`, więc gdy danych jeszcze nie ma (`undefined` — ładowanie,
 * błąd):
 *   • „Dostawcy" → „—" (`f.dostawcy` nie istnieje),
 *   • „EAN wspólne" / „Pozycje unikalne" → „0" (domyślne `rows: []`),
 *   • „Snapshoty" → „0" (`p.snapshots || 0` nigdy nie daje „—").
 * Nie ujednolicać — decyzja użytkownika z 2026-09-22 (ticket 97, D3).
 *
 * `null` (wygasła sesja, `on401: "returnNull"`) w oryginale wysypuje widok na `null.rows`.
 * Tu traktujemy go jak odpowiedź bez pola: „—" dla trzech pierwszych, „0" dla snapshotów (D4).
 *
 * Liczby idą SUROWO (`String`), bez separatora tysięcy — oryginał wstawia `.length` wprost.
 */
export function wartosciKafli({ filtry, status, porownanieEan, unikalneEan }: DaneKafli) {
  const dlugosc = (tablica: unknown[] | undefined) => (tablica ? String(tablica.length) : "—");
  return {
    dostawcy: dlugosc(filtry?.dostawcy),
    eanWspolne: dlugosc(porownanieEan === undefined ? [] : porownanieEan?.rows),
    pozycjeUnikalne: dlugosc(unikalneEan === undefined ? [] : unikalneEan?.rows),
    snapshoty: String(status?.snapshots || 0),
  };
}

/**
 * Kafel statystyki. Klasy z oryginału (`:27990-28025`): karta `border rounded p-3`,
 * etykieta `text-muted-foreground text-xs`, wartość `text-xl font-mono font-semibold`.
 */
function Kafel({ etykieta, wartosc, testId }: { etykieta: string; wartosc: string; testId: string }) {
  return (
    <div className="rounded border p-3">
      <div className="text-xs text-muted-foreground">{etykieta}</div>
      <div className="font-mono text-xl font-semibold" data-testid={testId}>
        {wartosc}
      </div>
    </div>
  );
}

export function NaglowekKpi(dane: DaneKafli) {
  const kafle = wartosciKafli(dane);
  return (
    <Card className="mb-4 border-card-border">
      <CardContent className="space-y-3 p-4">
        <div
          className="rounded border bg-muted/30 p-3 text-xs text-muted-foreground"
          data-testid="banner-historia"
        >
          {komunikatHistorii(dane.status)}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <Kafel etykieta="Dostawcy" wartosc={kafle.dostawcy} testId="kpi-dostawcy" />
          <Kafel etykieta="EAN wspólne" wartosc={kafle.eanWspolne} testId="kpi-ean-wspolne" />
          <Kafel
            etykieta="Pozycje unikalne"
            wartosc={kafle.pozycjeUnikalne}
            testId="kpi-pozycje-unikalne"
          />
          <Kafel etykieta="Snapshoty" wartosc={kafle.snapshoty} testId="kpi-snapshoty" />
        </div>
      </CardContent>
    </Card>
  );
}
