/**
 * Podgląd produktu — modal TYLKO DO ODCZYTU.
 *
 * ⚠ ODSTĘPSTWO ŚWIADOME (plan.md D4). Oryginał NIE MA podglądu: klik w wiersz nic nie
 * otwiera, a jedyne okno ze szczegółami to modal EDYCJI uruchamiany z menu „Akcje"
 * (`deminified/frontend-index.js:23780`, komponent `LT`). Mutacje produktów są poza
 * zakresem Iteracji 2, więc pokazujemy te same dane bez możliwości zapisu.
 *
 * Zawartość: wszystkie 59 kolumn katalogu (`KOLUMNY`) sformatowane tym samym
 * `formatujKomorke`, którego używa tabela — żeby podgląd i tabela nigdy się nie rozjechały.
 */
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatujKomorke } from "./formatowanie";
import type { Produkt } from "./filtrowanie";
import { KOLUMNY } from "./kolumny";

export function PodgladProduktu({
  produkt,
  onZamknij,
}: {
  produkt: Produkt | null;
  onZamknij: () => void;
}) {
  return (
    <Dialog open={produkt !== null} onOpenChange={(otwarty) => !otwarty && onZamknij()}>
      <DialogContent
        className="max-w-3xl max-h-[85vh] overflow-y-auto"
        data-testid="dialog-podglad-produktu"
      >
        {produkt && (
          <>
            <DialogHeader>
              <DialogTitle className="pr-8 text-base" data-testid="text-podglad-nazwa">
                {produkt.nazwa}
              </DialogTitle>
              <DialogDescription className="font-mono text-xs">
                {produkt.kod} · {produkt.dostawca} · {produkt.ean ?? "brak EAN"}
              </DialogDescription>
            </DialogHeader>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
              {KOLUMNY.map((kolumna) => (
                <div
                  key={kolumna.key}
                  className="flex justify-between gap-3 border-b border-border/50 py-1"
                >
                  <dt className="text-muted-foreground shrink-0">{kolumna.label}</dt>
                  <dd
                    className="font-mono text-right break-words"
                    data-testid={`podglad-pole-${kolumna.key}`}
                  >
                    {formatujKomorke(produkt, kolumna.key)}
                  </dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
