/**
 * Siatka kafli rodzajów — port `renderKafle()`
 * (`mirror/frontend/assets/pending-injection.js:640-718`).
 *
 * Kafel niesie etykietę, opis, licznik wartości TEGO rodzaju i tag `wbudowany`/`własny`
 * (`core`). Nad siatką pasek stanu, pod nią sekcja „Sieroty w DB”.
 *
 * ⚠ Kafla „Wszystkie atrybuty” tu NIE MA i to jest zgodne z produkcją: istnieje on wyłącznie
 * w bazowym widoku React (`deminified/frontend-index.js:27550`), który injection chowa
 * (`hideOriginalContent()`, `:472-491`) — Ania go nie widzi (plan.md D3).
 */
import { Button } from "@/components/ui/button";
import type { Rodzaj, Wartosc } from "./api";

export function KafleRodzajow({
  rodzaje,
  wartosci,
  blad,
  odswiezanie,
  onWybierz,
  onOdswiez,
}: {
  rodzaje: Rodzaj[];
  wartosci: Wartosc[];
  blad: string | null;
  odswiezanie: boolean;
  onWybierz: (rodzaj: string) => void;
  onOdswiez: () => void;
}) {
  const liczby = new Map<string, number>();
  for (const w of wartosci) liczby.set(w.rodzaj, (liczby.get(w.rodzaj) ?? 0) + 1);

  /**
   * „Sieroty” — rodzaje, które mają wartości w bazie, ale nie ma ich na liście rodzajów.
   * Produkcja realnie je miewa: seed sieje wartości dla rodzajów, których nikt nie założył.
   */
  const znane = new Set(rodzaje.map((r) => r.value));
  const sieroty = [...liczby.keys()].filter((r) => !znane.has(r));

  return (
    <>
      {blad ? (
        <div
          className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 mb-4 text-sm"
          data-testid="pasek-blad-atrybuty"
        >
          <span className="font-semibold text-destructive">⚠ Błąd ładowania danych: {blad}</span>
          <span className="text-destructive">
            Lista może być niepełna lub pusta mimo danych w bazie.
          </span>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={onOdswiez}
            disabled={odswiezanie}
            data-testid="button-odswiez-atrybuty"
          >
            Spróbuj ponownie
          </Button>
        </div>
      ) : (
        <div
          className="flex flex-wrap items-center gap-4 rounded-md border border-border bg-muted/30 px-4 py-2.5 mb-4 text-xs text-muted-foreground"
          data-testid="pasek-stanu-atrybuty"
        >
          <span className="font-medium text-primary">● Zsynchronizowane z DB</span>
          <span>
            {rodzaje.length} rodzajów, {wartosci.length} wartości
          </span>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={onOdswiez}
            disabled={odswiezanie}
            data-testid="button-odswiez-atrybuty"
          >
            {odswiezanie ? "Ładowanie..." : "Odśwież"}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {rodzaje.map((rodzaj) => (
          <button
            key={rodzaj.value}
            type="button"
            onClick={() => onWybierz(rodzaj.value)}
            className="flex flex-col items-start gap-1 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/40"
            data-testid={`kafel-rodzaj-${rodzaj.value}`}
          >
            <div className="font-semibold text-sm">{rodzaj.label}</div>
            <div className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
              {rodzaj.opis ?? ""}
            </div>
            <div className="mt-2 flex w-full items-end justify-between">
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-xl font-semibold tabular-nums">
                  {liczby.get(rodzaj.value) ?? 0}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  wartości
                </span>
              </div>
              <span className="rounded border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                {rodzaj.core ? "wbudowany" : "własny"}
              </span>
            </div>
          </button>
        ))}
      </div>

      {sieroty.length > 0 && (
        <div
          className="mt-6 rounded-lg border border-border bg-muted/20 p-4"
          data-testid="sekcja-sieroty"
        >
          <div className="mb-2 text-xs font-semibold">
            Sieroty w DB (rodzaj nie istnieje w liście)
          </div>
          <div className="flex flex-wrap gap-2">
            {sieroty.map((rodzaj) => (
              <span
                key={rodzaj}
                className="rounded bg-muted px-2.5 py-1 text-xs text-muted-foreground"
              >
                {rodzaj} — {liczby.get(rodzaj) ?? 0}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
