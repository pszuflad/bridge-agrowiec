/**
 * Zakładka „Wgrywanie ręczne" — odtworzenie `JT({suppliers})`
 * (`deminified/frontend-index.js:26147-26200`).
 *
 * Dwie karty, dokładnie jak oryginał:
 *  1. wgrywanie zbiorcze z auto-detekcją — przycisk `button-multi-upload` otwierający
 *     `DialogWgrywania` w trybie `multi` (`:26155-26166`),
 *  2. „Wgrywanie pojedyncze (z wymuszonym dostawcą)" — siatka kafli `upload-tile-{kod}`,
 *     każdy otwiera TEN SAM dialog z wymuszonym dostawcą (`:26169-26200`).
 *
 * Sam wybór plików, detekcja, lista i import siedzą w `DialogWgrywania.tsx`. Przeglądarka
 * niczego nie przepisuje — wysyłane są ORYGINALNE pliki przez `FormData`, backend parsuje od zera.
 *
 * ⚠ ODSTĘPSTWO ŚWIADOME (14a/D4): sekcja „Ostatni import" pod kaflami nie ma odpowiednika
 * w oryginale. Oryginał pokazuje podgląd pozycji w dialogu PRZED wysłaniem, budując go
 * z parsowania pliku w przeglądarce (`oP()`, `:18815`). Odbudowa nie parsuje w przeglądarce
 * (decyzja 3f-1, uzasadnienie w `detekcja.ts`), więc jedynym źródłem podglądu jest pole
 * `podglad` z ODPOWIEDZI backendu — dostępne dopiero po imporcie. Dialog zachowuje się przy tym
 * 1:1 (po sukcesie zamyka się i czyści listę), a wynik ląduje tutaj.
 */
import { useQuery } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DialogWgrywania, type Dostawca, type WynikPliku } from "./DialogWgrywania";

export function Wgrywanie() {
  const { data: dostawcy = [] } = useQuery<Dostawca[]>({ queryKey: ["/api/dostawcy"] });
  const [wyniki, ustawWyniki] = useState<WynikPliku[]>([]);

  return (
    <div className="space-y-4" data-testid="zakladka-wgrywanie">
      {/* Karta 1 — `:26150-26167`. ⚠ Tytuł sekcji NIE ma słowa „dostawcy"; ono jest dopiero
          w tytule dialogu („Wgraj wiele plików — auto-detekcja dostawcy"). Oba stringi
          przepisane z bundla 1:1. */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div>
            <h2 className="text-sm font-medium">Wgraj wiele plików — auto-detekcja</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Bridge sam rozpozna dostawcę po nazwie pliku i nagłówkach, sparsuje rozmiar opony
              i pola techniczne. Wgrywaj dowolną liczbę plików naraz. Pozycje trafiają do stagingu
              — po zatwierdzeniu pojawiają się w katalogu.
            </p>
          </div>

          <div className="flex gap-2">
            <DialogWgrywania
              multi
              dostawcy={dostawcy}
              onZaimportowano={ustawWyniki}
              trigger={
                <Button data-testid="button-multi-upload">
                  <Upload className="w-4 h-4 mr-2" />
                  Wgraj pliki
                </Button>
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Karta 2 — `:26169-26200`. Oryginał renderuje WSZYSTKICH dostawców, bez filtrowania
          i bez sortowania, i nie ma gałęzi dla pustej listy (decyzja 14a/D5 — zostawiamy 1:1;
          próba wgrania do dostawcy wyłączonego z importu kończy się błędem z backendu). */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div>
            <h2 className="text-sm font-medium">Wgrywanie pojedyncze (z wymuszonym dostawcą)</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Użyj gdy auto-detekcja się myli — wybierz dostawcę ręcznie i wgraj jego plik CSV.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {dostawcy.map((d) => (
              <div
                key={d.kod}
                className="border border-border rounded-md p-3 bg-card flex flex-col gap-2"
                data-testid={`upload-tile-${d.kod}`}
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-mono font-semibold">{d.kod}</span>
                  <span className="text-sm truncate">{d.nazwa}</span>
                </div>
                <div className="text-xs text-muted-foreground font-mono truncate">{d.email}</div>
                <DialogWgrywania
                  dostawcaKod={d.kod}
                  dostawcy={dostawcy}
                  onZaimportowano={ustawWyniki}
                  trigger={
                    <Button variant="outline" size="sm" className="flex-1">
                      <Upload className="w-3.5 h-3.5 mr-1.5" />
                      Wgraj plik
                    </Button>
                  }
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {wyniki.length > 0 && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <h2 className="text-sm font-medium">Ostatni import</h2>
            <div className="space-y-3">
              {wyniki.map((w, i) => (
                <WynikPlikuKarta key={`${w.nazwaPliku}-${i}`} pozycja={w} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function WynikPlikuKarta({ pozycja }: { pozycja: WynikPliku }) {
  const { nazwaPliku, wynik } = pozycja;

  return (
    <div
      className="border border-border rounded-md p-3 bg-card space-y-2 text-sm"
      data-testid="wynik-uploadu"
    >
      <p className="font-mono text-sm font-medium">{nazwaPliku}</p>
      <p className="text-foreground">
        Wczytano {wynik.liczbaProduktow} pozycji · do stagingu: {wynik.doStagingu} · nowe:{" "}
        {wynik.nowe} · zmienione: {wynik.zmienione} · wycofane: {wynik.wycofane} ·
        auto-zatwierdzone: {wynik.autoZatwierdzone}
      </p>
      {wynik.podglad?.length > 0 && (
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="text-muted-foreground text-left">
                <th className="pr-3 font-medium">Kod</th>
                <th className="pr-3 font-medium">Nazwa</th>
                <th className="pr-3 font-medium">Rozmiar</th>
                <th className="pr-3 font-medium">Cena zakupu</th>
                <th className="font-medium">Stan</th>
              </tr>
            </thead>
            <tbody>
              {wynik.podglad.map((r, i) => (
                <tr key={`${r.kod ?? ""}-${i}`}>
                  <td className="pr-3 font-mono">{r.kod ?? "—"}</td>
                  <td className="pr-3">{r.nazwa ?? "—"}</td>
                  <td className="pr-3">{r.rozmiar ?? "—"}</td>
                  <td className="pr-3">{r.cenaZakupu ?? "—"}</td>
                  <td>{r.stan ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
