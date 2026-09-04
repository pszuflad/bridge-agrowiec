/**
 * Potwierdzenie akcji — zamiennik `window.confirm()`.
 *
 * ⚠ ODSTĘPSTWO ŚWIADOME (plan.md 7b, D2): produkcyjny ekran `/atrybuty` pyta o potwierdzenie
 * natywnym `confirm()` (`mirror/frontend/assets/pending-injection.js:929,1004,1044,1069`).
 * Celem Iteracji 7 jest widok NATYWNY w Reakcie, a modalne okno przeglądarki blokujące wątek
 * jest w drzewie React ciałem obcym (nie da się go ostylować ani przetestować przez RTL).
 * **Teksty pytań przenosimy dosłownie** — parytet treści zostaje, zmienia się nośnik.
 */
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function DialogPotwierdzenia({
  otwarty,
  tytul,
  tresc,
  etykietaPotwierdzenia = "Potwierdź",
  wariantPotwierdzenia = "default",
  zajety = false,
  onPotwierdz,
  onZamknij,
  children,
  testId,
}: {
  otwarty: boolean;
  tytul: string;
  /** Treść pytania. Wieloliniowe teksty oryginału zachowują podział — `whitespace-pre-line`. */
  tresc: string;
  etykietaPotwierdzenia?: string;
  wariantPotwierdzenia?: "default" | "destructive";
  zajety?: boolean;
  onPotwierdz: () => void;
  onZamknij: () => void;
  /** Dodatkowa treść nad przyciskami — np. ostrzeżenie o liczbie produktów (D7). */
  children?: ReactNode;
  testId?: string;
}) {
  return (
    <Dialog open={otwarty} onOpenChange={(stan) => !stan && onZamknij()}>
      <DialogContent data-testid={testId}>
        <DialogHeader>
          <DialogTitle>{tytul}</DialogTitle>
          <DialogDescription className="whitespace-pre-line">{tresc}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button variant="outline" onClick={onZamknij} data-testid="button-anuluj">
            Anuluj
          </Button>
          <Button
            variant={wariantPotwierdzenia}
            onClick={onPotwierdz}
            disabled={zajety}
            data-testid="button-potwierdz"
          >
            {etykietaPotwierdzenia}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
