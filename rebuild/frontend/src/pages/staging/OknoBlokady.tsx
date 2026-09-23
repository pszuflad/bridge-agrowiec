/**
 * Okno „Nie zapisano zmian" — port `notice()` ze `staging-policy-injection.js` @ `88fa31c`
 * (`:39-42`).
 *
 * ⭐ TREŚĆ POCHODZI Z SERWERA I NIE WOLNO JEJ PRZEPISYWAĆ W UI. Backend ma sześć blokad
 * akceptacji (`import/polityka/blokady.ts`, port `staging_policy.cjs:188-200`) i każda mówi,
 * co konkretnie zrobić — „Odśwież cennik przed akceptacją.", „Najpierw rozstrzygnij dopasowanie
 * opony przyciskiem „Rozstrzygnij”.", „Błędny EAN: popraw numer w edycji zgłoszenia przed
 * akceptacją." itd. Okno jest dla nich wyłącznie nośnikiem.
 *
 * ⚠ AKCEPTACJA JEST ATOMOWA PER POZYCJA, NIE PER ŻĄDANIE (`staging-mutacje.ts`, port
 * `deminified/backend-index.cjs:48544`): pierwsza zablokowana pozycja przerywa całe żądanie,
 * a pozycje zatwierdzone wcześniej ZOSTAJĄ zatwierdzone. Dlatego tytuł mówi „Nie zapisano
 * zmian" o tym, co się nie udało, a lista i tak wymaga odświeżenia.
 */
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function OknoBlokady({
  komunikat,
  zamknij,
}: {
  /** `null` = okno zamknięte. Niepusty tekst to komunikat prosto z ciała odpowiedzi 409. */
  komunikat: string | null;
  zamknij: () => void;
}) {
  return (
    <Dialog open={komunikat != null} onOpenChange={(otwarty) => !otwarty && zamknij()}>
      <DialogContent data-testid="dialog-blokada-akceptacji">
        <DialogHeader>
          <DialogTitle>Nie zapisano zmian</DialogTitle>
          <DialogDescription className="break-words text-foreground" data-testid="tresc-blokady">
            {komunikat}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={zamknij} data-testid="button-zamknij-blokade">
            Zamknij
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
