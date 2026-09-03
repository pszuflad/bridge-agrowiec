/**
 * Nagłówek analityki — banner o zasięgu historii cen + cztery kafle KPI.
 *
 * ⚠ TU JEST NAJWIĘKSZE ODSTĘPSTWO CAŁEGO BLOKU 10a (O-10a-1, decyzja D3 użytkownika
 * z 2026-09-03). Oryginał (`deminified/frontend-index.js:27924-27960`) ma również cztery
 * kafle, ale liczone z zupełnie innych źródeł:
 *
 *   „Dostawcy"        ← `filters.dostawcy.length`
 *   „EAN wspólne"     ← `ean/comparison`.rows.length   (trasa z bloku 10c)
 *   „Pozycje unikalne"← `ean/unique`.rows.length       (trasa z bloku 10c)
 *   „Snapshoty"       ← `status.snapshots`
 *
 * `GET /api/analytics/kpi` produkcyjny frontend NIE WOŁA ANI RAZU — backend nazywa tę trasę
 * wprost „Backward-compatible aliases used by previous frontend build"
 * (`mirror/backend/analytics_module.cjs:324`). Zgodność liczby kafli (cztery) jest
 * przypadkowa, treść jest inna. Bierzemy `/kpi`, bo daje cztery sensowne liczby bez
 * zależności od nieistniejącego jeszcze bloku 10c.
 *
 * Banner nad kaflami jest za to 1:1 z oryginałem (`:27922`) — łącznie z tym, że znacznik
 * czasu idzie surowo przez `_()`. To jedyny element tego nagłówka, który Ania zna z produkcji.
 *
 * FORMA: cztery liczby to `KPI row` ze stat tiles (skill `dataviz`,
 * `references/choosing-a-form.md` — „a handful of headline numbers"), nie wykres słupkowy.
 */
import { Card, CardContent } from "@/components/ui/card";

import type { Kpi, StatusHistorii } from "./api";
import { formatuj, formatujProcent, formatujZnacznik } from "./formatowanie";

/** Komunikat o zasięgu historii — oba warianty verbatim z `:27922`. */
export function komunikatHistorii(status: StatusHistorii | null | undefined): string {
  if (status?.hasHistory) {
    return `Historia cen: ${status.snapshots} snapshotów od ${formatujZnacznik(status.od)}`;
  }
  return "Historia cen dopiero zacznie się zbierać po wdrożeniu. Widoki czasowe pokazują teraz dane bieżące albo pustą tabelę.";
}

/**
 * Kafel statystyki. Kontrakt ze skilla `dataviz` (`marks-and-anatomy.md`, „Stat tile"):
 * etykieta zdaniowa bez dwukropka, wartość większa i wyróżniona, bez koloru serii w tekście.
 * Klasy zachowane z oryginału (`:27932-27958`).
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

export function NaglowekKpi({
  kpi,
  status,
}: {
  kpi: Kpi | null | undefined;
  status: StatusHistorii | null | undefined;
}) {
  return (
    <Card className="mb-4 border-card-border">
      <CardContent className="space-y-3 p-4">
        <div
          className="rounded border bg-muted/30 p-3 text-xs text-muted-foreground"
          data-testid="banner-historia"
        >
          {komunikatHistorii(status)}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <Kafel etykieta="Produkty" wartosc={formatuj(kpi?.produkty)} testId="kpi-produkty" />
          <Kafel etykieta="Dostawcy" wartosc={formatuj(kpi?.dostawcy)} testId="kpi-dostawcy" />
          <Kafel
            etykieta="Śr. marża"
            wartosc={kpi?.avgMarza == null ? "—" : formatujProcent(kpi.avgMarza)}
            testId="kpi-marza"
          />
          <Kafel
            etykieta="Staging oczekujące"
            wartosc={formatuj(kpi?.stagingPending)}
            testId="kpi-staging"
          />
        </div>
      </CardContent>
    </Card>
  );
}
