/**
 * Pytanie o jedną wartość tekstową — zamiennik `window.prompt()`.
 *
 * ⚠ ODSTĘPSTWO ŚWIADOME (plan.md 7b, D2) — patrz `DialogPotwierdzenia.tsx`. Oryginał pyta
 * o nową wartość i o powód odrzucenia natywnym `prompt()` (`pending-injection.js:853,1067,1074`).
 * Etykiety i wartości początkowe przeniesione dosłownie.
 *
 * Zachowanie `prompt()` odtworzone tam, gdzie ma znaczenie dla przepływu: **anulowanie
 * i pusta wartość nie wywołują akcji**. W oryginale wynika to z `if (!nowa || nowa === item.wartosc) return;`
 * — dlatego `wymagana` (domyślnie `true`) blokuje zatwierdzenie pustego pola, a powód
 * odrzucenia, który w oryginale MOŻE być pusty (`prompt(...) || ""`), przekazuje `wymagana={false}`.
 */
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DialogTekstu({
  otwarty,
  tytul,
  etykieta,
  opis,
  wartoscPoczatkowa = "",
  etykietaZapisu = "Zapisz",
  wymagana = true,
  zajety = false,
  onZatwierdz,
  onZamknij,
  children,
  testId,
}: {
  otwarty: boolean;
  tytul: string;
  /** Tekst nad polem — w oryginale jest to treść pytania z `prompt()`. */
  etykieta: string;
  opis?: string | undefined;
  wartoscPoczatkowa?: string;
  etykietaZapisu?: string;
  wymagana?: boolean;
  zajety?: boolean;
  onZatwierdz: (wartosc: string) => void;
  onZamknij: () => void;
  /** Dodatkowa treść pod polem — np. ostrzeżenie o liczbie produktów (plan.md 7b, D7). */
  children?: ReactNode;
  testId?: string;
}) {
  const [wartosc, ustawWartosc] = useState(wartoscPoczatkowa);

  // Dialog żyje w drzewie także zamknięty, więc bez tego druga edycja pokazywałaby
  // wartość z poprzedniej — `prompt()` dostaje świeżą wartość początkową za każdym razem.
  useEffect(() => {
    if (otwarty) ustawWartosc(wartoscPoczatkowa);
  }, [otwarty, wartoscPoczatkowa]);

  const pusta = wartosc.trim() === "";

  function zatwierdz(zdarzenie: FormEvent) {
    zdarzenie.preventDefault();
    if (wymagana && pusta) return;
    onZatwierdz(wartosc);
  }

  return (
    <Dialog open={otwarty} onOpenChange={(stan) => !stan && onZamknij()}>
      <DialogContent data-testid={testId}>
        <form onSubmit={zatwierdz}>
          <DialogHeader>
            <DialogTitle>{tytul}</DialogTitle>
            {opis && <DialogDescription className="whitespace-pre-line">{opis}</DialogDescription>}
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label htmlFor="dialog-tekstu-pole">{etykieta}</Label>
            <Input
              id="dialog-tekstu-pole"
              value={wartosc}
              onChange={(zdarzenie) => ustawWartosc(zdarzenie.target.value)}
              autoFocus
              data-testid="input-dialog-tekstu"
            />
            {children}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onZamknij} data-testid="button-anuluj">
              Anuluj
            </Button>
            <Button
              type="submit"
              disabled={zajety || (wymagana && pusta)}
              data-testid="button-zapisz"
            >
              {etykietaZapisu}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
