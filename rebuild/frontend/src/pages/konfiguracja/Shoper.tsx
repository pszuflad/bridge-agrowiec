/**
 * Zakładka „Shoper" — port karty `GK()` (`deminified/frontend-index.js:26208-26277`).
 *
 * Port 1:1: tytuł, podtytuł, textarea mapowania kolumn (13 wierszy), pole separatora,
 * licznik „N kolumn" liczący linie zawierające `:`, przyciski „Zapisz konfigurację"
 * (dwa `POST /api/config`) i „Przywróć domyślne" (reset WYŁĄCZNIE lokalny — nic nie wysyła),
 * stopka o eksporcie per dostawca oraz `data-testid` `input-shoper-kolumny`
 * i `input-shoper-separator`.
 *
 * ⚠ Kluczy `shoper.kolumny` i `shoper.separator` NIE MA w `contract/fixtures/GET_config.json`
 * — nikt ich w produkcji nie zapisał, więc karta zawsze startuje od wartości domyślnych.
 * To nie jest brak w kontrakcie, tylko stan bazy w chwili nagrywania.
 *
 * ⚠ Sam eksport CSV, który te klucze czyta, należy do Iteracji 8. Do tego czasu zakładka
 * je zapisuje, a nikt ich nie odczytuje — tak samo jak w produkcji przed dowiezieniem
 * eksportu per dostawca.
 *
 * ⚠ PODZIAŁ NA DWA KOMPONENTY JEST KONIECZNY — pełne uzasadnienie w nagłówku `Ai.tsx`.
 * W skrócie: `useState` bierze wartość początkową tylko przy pierwszym renderze, więc
 * formularz musi się montować dopiero z gotowym configem, inaczej pierwsze wejście
 * w zakładkę zamraża pola na domyślnych i „Zapisz" nadpisuje zapisane mapowanie.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KLUCZ_KONFIGURACJI, zapiszKlucze, type Konfiguracja } from "./config";

/** Domyślne mapowanie 1:1 ze stałej w oryginale (`:26211`). */
const MAPOWANIE_DOMYSLNE = [
  "kod:kod_produktu",
  "nazwa:Nazwa produktu",
  "marka:Producent",
  "kategoria:Kategoria",
  "stan:stan",
  "cenaZakupu:cena_zakupu",
  "cenaSprzedazy:cena_sprzedazy",
  "marzaPct:marza_pct",
  "vat:vat",
  "ean:EAN",
  "status:status",
  "rozmiar:rozmiar",
].join("\n");

const SEPARATOR_DOMYSLNY = ";";

export function Shoper() {
  const { data: konfiguracja } = useQuery<Konfiguracja>({ queryKey: KLUCZ_KONFIGURACJI });

  // `null` to wygasła sesja (`zapytanieZwracajaceNullNa401`, `lib/queryClient.ts`).
  if (!konfiguracja) {
    return (
      <Card className="border-card-border">
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground">Wczytywanie…</p>
        </CardContent>
      </Card>
    );
  }
  return <FormularzShopera konfiguracja={konfiguracja} />;
}

function FormularzShopera({ konfiguracja }: { konfiguracja: Konfiguracja }) {
  const klient = useQueryClient();

  // Brak klucza w configu = produkcja nigdy go nie zapisała → wartość domyślna karty.
  const [kolumny, ustawKolumny] = useState(konfiguracja["shoper.kolumny"] ?? MAPOWANIE_DOMYSLNE);
  const [separator, ustawSeparator] = useState(
    konfiguracja["shoper.separator"] ?? SEPARATOR_DOMYSLNY,
  );
  const [komunikat, ustawKomunikat] = useState<{ tresc: string; blad: boolean } | null>(null);

  /** Licznik z oryginału (`:26217`): liczy linie zawierające dwukropek, nie wszystkie. */
  const liczbaKolumn = kolumny.split("\n").filter((linia) => linia.includes(":")).length;

  const zapis = useMutation<void, Error, void>({
    mutationFn: () =>
      zapiszKlucze([
        ["shoper.kolumny", kolumny],
        ["shoper.separator", separator],
      ]),
    onSuccess: () => {
      ustawKomunikat({ tresc: "Zapisano konfigurację Shopera", blad: false });
      void klient.invalidateQueries({ queryKey: KLUCZ_KONFIGURACJI });
    },
    onError: (e) => ustawKomunikat({ tresc: `Błąd zapisu: ${e.message}`, blad: true }),
  });

  return (
    <Card className="border-card-border">
      <CardContent className="p-5">
        <div className="mb-4">
          <h3 className="text-sm font-medium">Eksport CSV do Shoper</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Mapowanie kolumn: klucz_wewnetrzny:Naglowek_CSV (jedna linia = jedna kolumna)
          </p>
        </div>

        <div className="space-y-4 max-w-2xl">
          <div>
            <Label htmlFor="shoper-kolumny">Mapowanie kolumn</Label>
            <textarea
              id="shoper-kolumny"
              value={kolumny}
              onChange={(e) => ustawKolumny(e.target.value)}
              className="font-mono text-xs mt-1 w-full border border-input rounded-md p-2 bg-background resize-y"
              rows={13}
              data-testid="input-shoper-kolumny"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {liczbaKolumn} kolumn. Klucze: kod, nazwa, marka, kategoria, stan, cenaZakupu,
              cenaSprzedazy, marzaPct, vat, ean, status, rozmiar
            </p>
          </div>

          <div className="max-w-xs">
            <Label htmlFor="shoper-separator">Separator</Label>
            <Input
              id="shoper-separator"
              value={separator}
              onChange={(e) => ustawSeparator(e.target.value)}
              className="font-mono mt-1 max-w-[80px]"
              data-testid="input-shoper-separator"
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => {
                ustawKomunikat(null);
                zapis.mutate();
              }}
              disabled={zapis.isPending}
              data-testid="button-save-shoper"
            >
              {zapis.isPending ? "Zapisywanie…" : "Zapisz konfigurację"}
            </Button>
            {/* Reset WYŁĄCZNIE lokalny — oryginał też nic tu nie wysyła (`:26268-26271`). */}
            <Button
              variant="outline"
              onClick={() => {
                ustawKolumny(MAPOWANIE_DOMYSLNE);
                ustawSeparator(SEPARATOR_DOMYSLNY);
                ustawKomunikat(null);
              }}
              data-testid="button-restore-shoper"
            >
              Przywróć domyślne
            </Button>
          </div>

          {komunikat ? (
            <p
              className={`text-[11px] ${komunikat.blad ? "text-destructive" : "text-muted-foreground"}`}
              data-testid="komunikat-shoper"
            >
              {komunikat.tresc}
            </p>
          ) : null}

          <div className="text-xs text-muted-foreground border-t pt-3">
            Eksport per dostawca: w Katalogu wybierz dostawcę i kliknij Pobierz CSV. Format
            Shoper gdy nie wybrano kolumn ręcznie.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
