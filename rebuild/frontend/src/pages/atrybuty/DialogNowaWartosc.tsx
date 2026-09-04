/**
 * Dialog dodawania wartości — port `rg()` (`deminified/frontend-index.js:26991-27100`).
 *
 * ⚠ NAZWA PRZYCISKU. W bazowym Reakcie brzmi „Dodaj atrybut”, ale injection podmienia węzeł
 * tekstowy na „Dodaj wartość” („mniej mylące”, `pending-injection.js:515-523`) — i to jest
 * napis, który realnie widzi Ania, więc taki portujemy. `data-testid` zostaje z oryginału.
 *
 * ⚠ RODZAJ WPISUJE SIĘ, NIE WYBIERA. Pole ma `datalist` z istniejącymi rodzajami, ale przyjmie
 * dowolny tekst: oryginał liczy z niego slug i JEŚLI takiego rodzaju nie ma, zakłada go w locie
 * (`:27002-27006` → `__atrybutyAddRodzaj`, które POST-uje na `/rodzaje`), a dopiero potem
 * dodaje wartość. Odtworzone: dwa żądania po kolei, nie jedno.
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
import { dodajRodzaj, dodajWartosc, komunikatBledu, slugRodzaju, type Rodzaj } from "./api";

/** Podpowiedź wartości zależna od rodzaju — 1:1 z oryginałem (`:27083`). */
function placeholderWartosci(rodzaj: string): string {
  if (rodzaj === "marka") return "np. Goodyear";
  if (rodzaj === "kategoria") return "np. Quad";
  if (rodzaj === "bieznik") return "np. AGRO";
  return "wartość";
}

export function DialogNowaWartosc({
  rodzaje,
  rodzajPoczatkowy,
}: {
  rodzaje: Rodzaj[];
  /** Rodzaj otwartego panelu wartości — oryginał podstawia go do pola (`:27541`). */
  rodzajPoczatkowy?: string;
}) {
  const klient = useQueryClient();
  const { toast } = useToast();
  const [otwarty, ustawOtwarty] = useState(false);
  const [rodzaj, ustawRodzaj] = useState(rodzajPoczatkowy ?? rodzaje[0]?.value ?? "marka");
  const [wartosc, ustawWartosc] = useState("");

  const zapis = useMutation<void, Error, { rodzaj: string; wartosc: string }>({
    mutationFn: async ({ rodzaj: wpisany, wartosc: tresc }) => {
      const value = slugRodzaju(wpisany);
      if (!value) return;
      if (!rodzaje.some((r) => r.value === value)) {
        /*
         * Błąd zakładania rodzaju POŁYKAMY — i to jest wierne: oryginał wysyła ten POST
         * jako `fetch(...).catch(console.warn)` (`:10250-10259`), więc nieudane utworzenie
         * rodzaju nigdy nie przerywa dodawania wartości ani nie pokazuje się użytkowniczce.
         * Ma to też skutek praktyczny: gdy w wyścigu (druga karta, druga osoba) ktoś założy
         * ten sam rodzaj między odczytem listy a tym zapisem, dostaniemy 409 na RODZAJU —
         * wartość i tak trzeba wtedy dodać, a komunikat o duplikacie ma dotyczyć WARTOŚCI.
         */
        try {
          await dodajRodzaj({ value, label: wpisany });
        } catch {
          /* rodzaj mógł powstać równolegle — próbujemy dodać wartość mimo to */
        }
      }
      // Jedyny błąd, który dochodzi do `onError`, pochodzi więc z dodawania WARTOŚCI.
      await dodajWartosc(value, tresc);
    },
    onSuccess: (_wynik, { rodzaj: wpisany, wartosc: tresc }) => {
      void klient.invalidateQueries({ queryKey: ["/api/atrybuty"] });
      toast({ title: "Atrybut dodany", description: `${wpisany}: ${tresc}` });
      ustawWartosc("");
      ustawOtwarty(false);
    },
    onError: (e, { rodzaj: wpisany, wartosc: tresc }) => {
      const tekst = komunikatBledu(e);
      /*
       * Duplikat rozpoznajemy po ETAPIE, nie po treści: do `onError` trafiają wyłącznie
       * błędy z `dodajWartosc` (błąd rodzaju jest połknięty wyżej), więc „już istnieje”
       * może tu znaczyć tylko duplikat WARTOŚCI — tak jak w oryginale, gdzie `Hb()` oddaje
       * `false` właśnie dla wartości już obecnej w rodzaju (`:9018-9021`, `:27009-27014`).
       */
      const duplikat = /już istnieje/i.test(tekst);
      toast({
        title: duplikat ? "Już istnieje" : "Nie zapisano",
        description: duplikat
          ? `Wartość "${tresc}" jest już w rodzaju ${slugRodzaju(wpisany)}`
          : tekst,
        variant: "destructive",
      });
    },
  });

  function zapisz() {
    const tresc = wartosc.trim();
    if (!tresc) return;
    zapis.mutate({ rodzaj, wartosc: tresc });
  }

  const opisRodzaju = rodzaje.find((r) => r.value === rodzaj)?.opis;

  return (
    <Dialog
      open={otwarty}
      onOpenChange={(stan) => {
        ustawOtwarty(stan);
        // Otwarcie z poziomu panelu wartości podstawia rodzaj tego panelu.
        if (stan && rodzajPoczatkowy) ustawRodzaj(rodzajPoczatkowy);
      }}
    >
      <DialogTrigger asChild>
        <Button data-testid="button-add-attribute">Dodaj wartość</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nowy atrybut</DialogTitle>
          <DialogDescription>
            Dodany atrybut pojawi się we wszystkich miejscach w aplikacji, gdzie wybiera się ten
            rodzaj wartości (warunki narzutów, promocji, filtry katalogu).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="attr-rodzaj">Rodzaj</Label>
            <Input
              id="attr-rodzaj"
              value={rodzaj}
              onChange={(zdarzenie) => ustawRodzaj(zdarzenie.target.value)}
              placeholder="np. marka, kolor, sezon"
              list="attr-rodzaje-list"
              className="mt-1"
              data-testid="input-attr-kind"
            />
            <datalist id="attr-rodzaje-list">
              {rodzaje.map((pozycja) => (
                <option key={pozycja.value} value={pozycja.value} label={pozycja.label} />
              ))}
            </datalist>
            <div className="mt-1 text-xs text-muted-foreground">{opisRodzaju}</div>
          </div>
          <div>
            <Label htmlFor="attr-wartosc">Wartość</Label>
            <Input
              id="attr-wartosc"
              autoFocus
              value={wartosc}
              onChange={(zdarzenie) => ustawWartosc(zdarzenie.target.value)}
              onKeyDown={(zdarzenie) => {
                if (zdarzenie.key === "Enter") zapisz();
              }}
              placeholder={placeholderWartosci(rodzaj)}
              className="mt-1"
              data-testid="input-attr-value"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => ustawOtwarty(false)}>
            Anuluj
          </Button>
          <Button onClick={zapisz} disabled={zapis.isPending} data-testid="button-save-attribute">
            Dodaj
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
