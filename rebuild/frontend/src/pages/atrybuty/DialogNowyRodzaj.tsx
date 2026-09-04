/**
 * Dialog „Nowy rodzaj atrybutu” — port `sg()` (`deminified/frontend-index.js:27195-27277`).
 *
 * Teksty, `placeholder`y i `data-testid` 1:1 z oryginałem; Enter w polu nazwy zatwierdza.
 *
 * ⚠ TU ODBUDOWA ZAPISUJE, A ORYGINAŁ NIE — i to nie jest ulepszenie z własnej inicjatywy,
 * tylko konsekwencja tego, że nie portujemy mostka. `sg()` woła `Lb()` (`:9965-9977`), które
 * dopisuje rodzaj wyłącznie do lokalnej tablicy `dt` i cache’u Query. Mostek opatchował
 * zapis WARTOŚCI (`Hb`/`Qb`/`Gb`) i wystawił `__atrybutyAddRodzaj` dla drugiej ścieżki
 * (`rg`, `:27006`), ale `Lb` zostawił nietknięte — więc rodzaj utworzony TYM przyciskiem
 * znika po odświeżeniu strony, a ten sam rodzaj wpisany w „Dodaj wartość” zapisuje się
 * normalnie. Szczegóły i decyzja: `pages/atrybuty/api.ts` (`dodajRodzaj`) oraz backlog.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { dodajRodzaj, komunikatBledu } from "./api";

export function DialogNowyRodzaj() {
  const klient = useQueryClient();
  const { toast } = useToast();
  const [otwarty, ustawOtwarty] = useState(false);
  const [nazwa, ustawNazwa] = useState("");
  const [opis, ustawOpis] = useState("");

  const zapis = useMutation<void, Error, { nazwa: string; opis: string }>({
    mutationFn: ({ nazwa: label, opis: tresc }) => dodajRodzaj({ label, opis: tresc }),
    onSuccess: (_wynik, { nazwa: label }) => {
      void klient.invalidateQueries({ queryKey: ["/api/atrybuty"] });
      toast({ title: "Rodzaj dodany", description: label });
      ustawNazwa("");
      ustawOpis("");
      ustawOtwarty(false);
    },
    // 409 z backendu niesie `Rodzaj '<value>' już istnieje` — pokazujemy komunikat serwera
    // pod nagłówkiem oryginału.
    onError: (e) =>
      toast({ title: "Już istnieje", description: komunikatBledu(e), variant: "destructive" }),
  });

  function zapisz() {
    const label = nazwa.trim();
    if (!label) {
      toast({ title: "Brak nazwy", description: "Wpisz nazwę rodzaju", variant: "destructive" });
      return;
    }
    zapis.mutate({ nazwa: label, opis });
  }

  return (
    <Dialog open={otwarty} onOpenChange={ustawOtwarty}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-add-kind">
          Nowy rodzaj
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nowy rodzaj atrybutu</DialogTitle>
          <DialogDescription>
            Rodzaj to grupa atrybutów — np. „Sezon”, „Opcja zimowa”, „Kraj pochodzenia”.
            Po utworzeniu rodzaju możesz dodawać do niego dowolne wartości.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="rodzaj-nazwa">Nazwa</Label>
            <Input
              id="rodzaj-nazwa"
              autoFocus
              value={nazwa}
              onChange={(zdarzenie) => ustawNazwa(zdarzenie.target.value)}
              onKeyDown={(zdarzenie) => {
                if (zdarzenie.key === "Enter" && nazwa.trim()) zapisz();
              }}
              placeholder="np. Sezon"
              className="mt-1"
              data-testid="input-kind-label"
            />
          </div>
          <div>
            <Label htmlFor="rodzaj-opis">Opis (opcjonalnie)</Label>
            <Input
              id="rodzaj-opis"
              value={opis}
              onChange={(zdarzenie) => ustawOpis(zdarzenie.target.value)}
              placeholder="np. Letnie, Zimowe, Całoroczne"
              className="mt-1"
              data-testid="input-kind-opis"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => ustawOtwarty(false)}>
            Anuluj
          </Button>
          <Button onClick={zapisz} disabled={zapis.isPending} data-testid="button-save-kind">
            Utwórz rodzaj
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
