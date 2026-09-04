/**
 * Pasek dostępności — port pomocnika `O(e, t = 100)` z widoku `/analityka`
 * (`deminified/frontend-index.js:27919-27935`).
 *
 * W oryginale to funkcja zadeklarowana WEWNĄTRZ komponentu widoku, wołana z kolumny
 * „Dostępność" w kilku kartach naraz — w karcie „4.1 Historia dostępności pozycji"
 * (blok 10e) i w kartach dostawców „1.4/1.5" (blok 10d). Wyciągamy ją do osobnego
 * komponentu, żeby oba bloki miały jedno źródło, a nie dwie kopie tej samej pętli.
 *
 * ⚠ DO BLOKU 10d: to jest TEN komponent, nie pisz drugiego. Inwentarz w `README.md` obok.
 *
 * Zachowanie 1:1 z oryginałem, łącznie z zaciskiem: wartość spoza [0, 100] jest przycinana
 * do przedziału, a `null`/`undefined`/tekst dają zero szerokości. Etykieta obok paska idzie
 * przez `formatujProcent`, więc brak wartości pokazuje „—", a nie „0%" — tak jak `D(e)`
 * w oryginale (`:27917`).
 */
import { formatujProcent } from "./formatowanie";

export function PasekDostepnosci({ wartosc }: { wartosc: number | null | undefined }) {
  const procent = Math.max(0, Math.min(100, Number(wartosc) || 0));

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded bg-muted">
        <div
          className="h-full bg-primary"
          style={{ width: `${procent}%` }}
          data-testid="pasek-dostepnosci-wypelnienie"
        />
      </div>
      <span className="font-mono text-xs">{formatujProcent(wartosc)}</span>
    </div>
  );
}
