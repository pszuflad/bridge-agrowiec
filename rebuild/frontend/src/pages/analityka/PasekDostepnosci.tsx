/**
 * Pasek dostępności — port pomocnika `O(e, t = 100)` z widoku `/analityka`
 * (`deminified/frontend-index.js:27919-27936`, funkcja `zM`).
 *
 * ⚠ TO JEDYNA NIETABELARYCZNA WIZUALIZACJA W CAŁYM ORYGINALNYM WIDOKU. Wszystkie pozostałe
 * karty to gołe tabele; tutaj oryginał rysuje pasek postępu w komórce i dokłada obok podpis
 * procentowy monospace.
 *
 * ⚠ DWÓCH KONSUMENTÓW, DWA BLOKI. Oryginał woła `O()` dwa razy: w karcie „1.4 / 1.5 Stan
 * i dostępność dostawcy" (blok 10d, `:28165`) i w karcie „4.1 Historia dostępności pozycji"
 * (blok 10e, `zM+650`). Dlatego komponent stoi tu, obok `TabelaAnalityki`, a nie wewnątrz
 * sekcji 10d — blok 10e ma go zastać gotowym i NIE pisać drugiego
 * (`docs/analityka-bloki-10b-10f.md` §6).
 *
 * Zachowanie odtworzone 1:1, łącznie z zaciśnięciem: `Math.max(0, Math.min(100, Number(e) || 0))`
 * — `null`, `undefined` i wartość nieliczbowa dają pasek o szerokości 0, a podpis „—",
 * bo `D()` (nasze `formatujProcent`) rozstrzyga o nim niezależnie od szerokości paska.
 */
import { formatujProcent } from "./formatowanie";

export function PasekDostepnosci({ wartosc }: { wartosc: number | null | undefined }) {
  const szerokosc = Math.max(0, Math.min(100, Number(wartosc) || 0));

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded bg-muted">
        <div
          className="h-full bg-primary"
          style={{ width: `${szerokosc}%` }}
          data-testid="pasek-dostepnosci-wypelnienie"
        />
      </div>
      <span className="font-mono text-xs">{formatujProcent(wartosc)}</span>
    </div>
  );
}
