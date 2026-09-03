/**
 * Widok `/waga-gabarytowa` — port `nM()` (`deminified/frontend-index.js:26514-26953`).
 *
 * ⚠ LICZY LOKALNIE I NIE WOŁA BACKENDU — świadomie (plan.md D1). `POST /api/waga-gabarytowa/oblicz`
 * istnieje w odbudowie (`rebuild/backend/src/routes/waga-gabarytowa.ts`), ale liczy INNY wzór:
 * wagę paletową z progami i configiem, a nie wolumetryczną z dzielnikiem przewoźnika.
 * Podpięcie widoku pod endpoint odebrałoby Ani wybór przewoźnika, objętość i wagę do wyceny —
 * to nie byłaby deduplikacja, tylko zmiana funkcji. Szczegóły w `waga-gabarytowa/obliczenia.ts`.
 *
 * Cały stan trwały siedzi w IndexedDB przez `magazynKV` — tak jak w oryginale, bez API.
 */
import { Calculator, Info } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { odczytajKV, zapiszKV } from "@/lib/magazynKV";
import { policzWage, type WymiaryTekstem, type WynikWagi } from "./waga-gabarytowa/obliczenia";
import {
  KLUCZ_OSTATNIE_WYMIARY,
  KLUCZ_OSTATNI_WYNIK,
  KLUCZ_PRZEWOZNICY,
  KLUCZ_WYBRANY,
  PRZEWOZNICY_DOMYSLNI,
  WYBRANY_DOMYSLNY,
  type Przewoznik,
} from "./waga-gabarytowa/przewoznicy";
import { TabelaPrzewoznikow } from "./waga-gabarytowa/TabelaPrzewoznikow";

/** Wymiary startowe z oryginału (`:26545`) — paczka 60 × 50 × 50, bez wagi rzeczywistej. */
const WYMIARY_STARTOWE: WymiaryTekstem = {
  dlugosc: "60",
  szerokosc: "50",
  wysokosc: "50",
  wagaRzeczywista: "",
};

/** Kształt zapisu wymiarów w IndexedDB — skrócone nazwy 1:1 z oryginałem (`:26689`). */
type ZapisWymiarow = { dlug: string; szer: string; wys: string; wagaRzecz: string };

export function WagaGabarytowa() {
  const [wymiary, ustawWymiary] = useState<WymiaryTekstem>(WYMIARY_STARTOWE);
  const [przewoznicy, ustawPrzewoznikow] = useState<Przewoznik[]>(PRZEWOZNICY_DOMYSLNI);
  const [wybrany, ustawWybranego] = useState(WYBRANY_DOMYSLNY);
  const [wynik, ustawWynik] = useState<WynikWagi | null>(null);
  const [wczytano, ustawWczytano] = useState(false);
  const { toast } = useToast();

  /**
   * Hydratacja z IndexedDB (`:26547-26560`). Flaga `wczytano` NIE jest kosmetyką: bez niej
   * autozapis niżej wystrzeliłby przy pierwszym renderze i nadpisał zapamiętaną listę
   * przewoźników domyślną, zanim odczyt zdążyłby wrócić.
   */
  useEffect(() => {
    void (async () => {
      const zapisani = await odczytajKV<Przewoznik[]>(KLUCZ_PRZEWOZNICY);
      if (Array.isArray(zapisani) && zapisani.length > 0) ustawPrzewoznikow(zapisani);

      const zapisanyWybor = await odczytajKV<string>(KLUCZ_WYBRANY);
      if (zapisanyWybor) ustawWybranego(zapisanyWybor);

      const zapisaneWymiary = await odczytajKV<ZapisWymiarow>(KLUCZ_OSTATNIE_WYMIARY);
      if (zapisaneWymiary) {
        ustawWymiary({
          dlugosc: zapisaneWymiary.dlug,
          szerokosc: zapisaneWymiary.szer,
          wysokosc: zapisaneWymiary.wys,
          wagaRzeczywista: zapisaneWymiary.wagaRzecz,
        });
      }

      const ostatniWynik = await odczytajKV<WynikWagi>(KLUCZ_OSTATNI_WYNIK);
      if (ostatniWynik) ustawWynik(ostatniWynik);

      ustawWczytano(true);
    })();
  }, []);

  useEffect(() => {
    if (wczytano) void zapiszKV(KLUCZ_PRZEWOZNICY, przewoznicy);
  }, [przewoznicy, wczytano]);

  useEffect(() => {
    if (wczytano) void zapiszKV(KLUCZ_WYBRANY, wybrany);
  }, [wybrany, wczytano]);

  /**
   * Wybór cofa się na pierwszego z listy, gdy zapamiętane id już nie istnieje
   * (`c.find(...) ?? c[0]`, `:26561`) — inaczej usunięcie przewoźnika wywróciłoby kalkulator.
   */
  const przewoznik = useMemo(
    () => przewoznicy.find((p) => p.id === wybrany) ?? przewoznicy[0],
    [przewoznicy, wybrany],
  );

  const pole = (klucz: keyof WymiaryTekstem) => (zdarzenie: { target: { value: string } }) =>
    ustawWymiary((poprzednie) => ({ ...poprzednie, [klucz]: zdarzenie.target.value }));

  const oblicz = async () => {
    if (!przewoznik) return;

    const policzony = policzWage(wymiary, przewoznik);
    if (!policzony) {
      toast({
        title: "Niepoprawne wymiary",
        description: "Wprowadź dodatnie liczby dla długości, szerokości i wysokości.",
        variant: "destructive",
      });
      return;
    }

    ustawWynik(policzony);
    await zapiszKV(KLUCZ_OSTATNIE_WYMIARY, {
      dlug: wymiary.dlugosc,
      szer: wymiary.szerokosc,
      wys: wymiary.wysokosc,
      wagaRzecz: wymiary.wagaRzeczywista,
    } satisfies ZapisWymiarow);
    await zapiszKV(KLUCZ_OSTATNI_WYNIK, policzony);
  };

  return (
    <div>
      <PageHeader
        title="Waga gabarytowa"
        subtitle="Kalkulator + ustawienia przewoźników w jednym miejscu"
      />

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-semibold mb-1 flex items-center gap-2">
            <Calculator className="w-4 h-4" /> Wymiary paczki
          </h3>
          <p className="text-sm text-muted-foreground mb-5">
            Podaj wymiary w centymetrach. Waga rzeczywista jest opcjonalna — gdy ją podasz,
            wyliczamy wagę do wyceny.
          </p>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="dlug">Długość (cm)</Label>
                <Input
                  id="dlug"
                  type="number"
                  inputMode="decimal"
                  value={wymiary.dlugosc}
                  onChange={pole("dlugosc")}
                  className="mt-1"
                  data-testid="input-dlugosc"
                />
              </div>
              <div>
                <Label htmlFor="szer">Szerokość (cm)</Label>
                <Input
                  id="szer"
                  type="number"
                  inputMode="decimal"
                  value={wymiary.szerokosc}
                  onChange={pole("szerokosc")}
                  className="mt-1"
                  data-testid="input-szerokosc"
                />
              </div>
              <div>
                <Label htmlFor="wys">Wysokość (cm)</Label>
                <Input
                  id="wys"
                  type="number"
                  inputMode="decimal"
                  value={wymiary.wysokosc}
                  onChange={pole("wysokosc")}
                  className="mt-1"
                  data-testid="input-wysokosc"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="waga-rzecz">Waga rzeczywista (kg) — opcjonalnie</Label>
              <Input
                id="waga-rzecz"
                type="number"
                inputMode="decimal"
                placeholder="np. 12.5"
                value={wymiary.wagaRzeczywista}
                onChange={pole("wagaRzeczywista")}
                className="mt-1"
                data-testid="input-waga-rzecz"
              />
            </div>

            <div>
              <Label htmlFor="przewoznik">Przewoźnik</Label>
              <select
                id="przewoznik"
                value={wybrany}
                onChange={(zdarzenie) => ustawWybranego(zdarzenie.target.value)}
                className="mt-1 w-full bg-background border border-input rounded-md h-9 px-3 text-sm"
                data-testid="select-przewoznik"
              >
                {przewoznicy.map((pozycja) => (
                  <option key={pozycja.id} value={pozycja.id}>
                    {pozycja.nazwa} — dzielnik {pozycja.dzielnik}
                  </option>
                ))}
              </select>
            </div>

            <Button onClick={() => void oblicz()} className="w-full" data-testid="button-oblicz">
              <Calculator className="w-4 h-4 mr-2" />
              Oblicz wagę gabarytową
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-1">Wynik</h3>
          <p className="text-sm text-muted-foreground mb-5">
            Wzór: (długość × szerokość × wysokość) / dzielnik
          </p>

          {wynik ? (
            <div className="space-y-4">
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Waga gabarytowa ({wynik.przewoznik})
                </div>
                <div className="text-2xl font-semibold mt-1" data-testid="text-wynik-waga">
                  {wynik.wagaGabarytowa.toFixed(2)} kg
                </div>
              </div>

              {wynik.wagaDoWyceny !== null ? (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">
                    Waga do wyceny (większa z dwóch)
                  </div>
                  <div className="text-xl font-semibold mt-1" data-testid="text-waga-do-wyceny">
                    {wynik.wagaDoWyceny.toFixed(2)} kg
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {wynik.wagaDoWyceny === wynik.wagaGabarytowa
                      ? "Gabarytowa > rzeczywista → liczy się gabarytowa"
                      : "Rzeczywista > gabarytowa → liczy się rzeczywista"}
                  </div>
                </div>
              ) : null}

              <div className="border-t pt-4 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Obliczenie</span>
                  <span className="font-mono text-xs">
                    {wynik.dlugosc} × {wynik.szerokosc} × {wynik.wysokosc} ÷ {wynik.dzielnik}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Objętość</span>
                  <span className="font-mono">{wynik.objetoscM3.toFixed(4)} m³</span>
                </div>
                {wynik.wagaRzeczywista !== null ? (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Waga rzeczywista</span>
                    <span className="font-mono">{wynik.wagaRzeczywista.toFixed(2)} kg</span>
                  </div>
                ) : null}
              </div>

              <div className="bg-muted/30 rounded-md p-3 text-xs space-y-1">
                <div className="flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">
                    Wynik został zapisany lokalnie — pokaże się przy następnym wejściu.
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground py-12 text-center">
              Wypełnij wymiary i kliknij „Oblicz wagę gabarytową".
            </div>
          )}
        </Card>
      </div>

      <TabelaPrzewoznikow
        przewoznicy={przewoznicy}
        ustawPrzewoznikow={ustawPrzewoznikow}
        wybrany={wybrany}
        ustawWybranego={ustawWybranego}
        przywrocDomyslne={() => {
          ustawPrzewoznikow(PRZEWOZNICY_DOMYSLNI);
          ustawWybranego(WYBRANY_DOMYSLNY);
        }}
      />
    </div>
  );
}
