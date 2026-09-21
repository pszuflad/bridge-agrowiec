/**
 * Kalkulator wagi PALETOWEJ (opony) — karta P9.1 (ticket 76, backlog #28).
 *
 * ⚠ ODSTĘPSTWO ŚWIADOME (zatwierdzone przez Anię, pytanie 9.2): produkcyjny frontend NIE WOŁA
 * `POST /api/waga-gabarytowa/oblicz` — endpoint istnieje, ale nie ma ekranu. Ten kalkulator
 * DOCHODZI obok wolumetrycznego, niczego w nim nie podmienia (backlog #28).
 *
 * To inny wzór niż wolumetryczny: serwer zaokrągla szerokość do półpalety albo palety, dolicza
 * wysokość palety i mnoży przez współczynnik — wszystko z ustawień `waga_gab.*`, bez przewoźnika
 * (`rebuild/backend/src/waga-gabarytowa/formula.ts`). Liczy SERWER; tu jest tylko formularz.
 *
 * Endpoint nie waliduje wejścia (każde daje 200, tekst → `null` w wyniku), więc podstawową
 * walidację robi formularz: trzy pola wypełnione liczbami nieujemnymi. Nic nie jest zapamiętywane
 * w przeglądarce (plan.md D4).
 */
import { useMutation } from "@tanstack/react-query";
import { Info, Layers } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { obliczPaletowo, type WymiaryPaletowe, type WynikPaletowy } from "./api";

type PolaFormularza = Record<keyof WymiaryPaletowe, string>;

const POLA: Array<{ klucz: keyof WymiaryPaletowe; etykieta: string }> = [
  { klucz: "szerokosc", etykieta: "Szerokość (cm)" },
  { klucz: "dlugosc", etykieta: "Długość (cm)" },
  { klucz: "wysokosc", etykieta: "Wysokość (cm)" },
];

/** Liczba nieujemna z pola (przecinek jak w edytorze przewoźników) albo `null`. */
function naWymiar(tekst: string): number | null {
  if (!tekst.trim()) return null;
  const liczba = Number(tekst.replace(",", "."));
  return Number.isFinite(liczba) && liczba >= 0 ? liczba : null;
}

export function KalkulatorPaletowy() {
  const [pola, ustawPola] = useState<PolaFormularza>({ szerokosc: "", dlugosc: "", wysokosc: "" });
  const [wynik, ustawWynik] = useState<WynikPaletowy | null>(null);
  const { toast } = useToast();

  const obliczenie = useMutation<WynikPaletowy, Error, WymiaryPaletowe>({
    mutationFn: obliczPaletowo,
    onSuccess: ustawWynik,
    onError: (e) =>
      toast({ title: "Nie udało się policzyć", description: e.message, variant: "destructive" }),
  });

  const oblicz = () => {
    const szerokosc = naWymiar(pola.szerokosc);
    const dlugosc = naWymiar(pola.dlugosc);
    const wysokosc = naWymiar(pola.wysokosc);
    if (szerokosc === null || dlugosc === null || wysokosc === null) {
      toast({
        title: "Niepoprawne wymiary",
        description: "Podaj liczby nieujemne dla szerokości, długości i wysokości.",
        variant: "destructive",
      });
      return;
    }
    obliczenie.mutate({ szerokosc, dlugosc, wysokosc });
  };

  return (
    <Card className="p-6 mt-6" data-testid="card-kalkulator-paletowy">
      <h3 className="font-semibold mb-1 flex items-center gap-2">
        <Layers className="w-4 h-4" /> Waga paletowa (opony) — inny wzór
      </h3>
      <p className="text-sm text-muted-foreground mb-5">
        W odróżnieniu od kalkulatora wyżej nie używa dzielnika przewoźnika: zaokrągla szerokość do
        półpalety albo palety, dolicza wysokość palety i mnoży objętość przez stały współczynnik z
        ustawień.
      </p>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {POLA.map(({ klucz, etykieta }) => (
              <div key={klucz}>
                <Label htmlFor={`paleta-${klucz}`}>{etykieta}</Label>
                <Input
                  id={`paleta-${klucz}`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={pola[klucz]}
                  onChange={(zdarzenie) =>
                    ustawPola((poprzednie) => ({ ...poprzednie, [klucz]: zdarzenie.target.value }))
                  }
                  className="mt-1"
                  data-testid={`input-paleta-${klucz}`}
                />
              </div>
            ))}
          </div>
          <Button
            onClick={oblicz}
            disabled={obliczenie.isPending}
            className="w-full"
            data-testid="button-oblicz-paletowo"
          >
            <Layers className="w-4 h-4 mr-2" />
            Oblicz wagę paletową
          </Button>
        </div>

        {wynik ? (
          <div className="space-y-4">
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                Waga gabarytowa paletowa
              </div>
              <div className="text-2xl font-semibold mt-1" data-testid="text-wynik-paletowy">
                {wynik.wagaGabarytowa} kg
              </div>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Szerokość do wyliczenia</span>
                <span className="font-mono" data-testid="text-paleta-szerokosc">
                  {wynik.szerokoscEfektywna} cm
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Wysokość z paletą</span>
                <span className="font-mono" data-testid="text-paleta-wysokosc">
                  {wynik.wysokoscZPaleta} cm
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Współczynnik</span>
                <span className="font-mono">{wynik.wspolczynnik}</span>
              </div>
            </div>
            <div className="bg-muted/30 rounded-md p-3 text-xs flex items-start gap-2">
              <Info className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground" data-testid="text-paleta-opis">
                {wynik.opis}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground py-8 text-center">
            Wypełnij wymiary i kliknij „Oblicz wagę paletową".
          </div>
        )}
      </div>
    </Card>
  );
}
