/**
 * Karta „Mapowanie dostawców" — `selly-injection.js:438-455` (widok) i `:616-647` (`loadStatus`).
 *
 * ⚠ TO NIE JEST SEKCJA TYLKO-DO-ODCZYTU. Tabela ma piątą, bezetykietową kolumnę
 * z przyciskiem „Sync" per wiersz (`:640-645`), który w oryginale wpisuje dostawcę
 * do selecta i NATYCHMIAST odpala `doSync(false)` — czyli PEŁNY, niedry-runowy zapis
 * do cudzego sklepu Selly, jednym kliknięciem, bez pytania.
 *
 * Decyzją D3 planu ten przycisk przechodzi u nas przez ten sam dialog potwierdzenia,
 * co „Wyślij do Selly" — jedyne odstępstwo w tym pliku.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { WierszStatusuDostawcy } from "./api";
import { BladSekcji } from "./BladSekcji";
import { NaglowekKarty } from "./Wskaznik";

export function SekcjaMapowanie({
  wiersze,
  ladowanie,
  blad,
  onOdswiez,
  onSync,
  syncTrwa,
}: {
  wiersze: WierszStatusuDostawcy[];
  ladowanie: boolean;
  blad: unknown;
  onOdswiez: () => void;
  onSync: (dostawca: string) => void;
  syncTrwa: boolean;
}) {
  return (
    <Card data-testid="selly-sekcja-mapowanie">
      <CardContent className="space-y-3 p-4">
        <NaglowekKarty
          stan={ladowanie ? "ladowanie" : blad != null ? "blad" : "ok"}
          tytul="Mapowanie dostawców"
          akcje={
            <Button
              size="sm"
              variant="secondary"
              onClick={onOdswiez}
              data-testid="selly-button-odswiez-status"
            >
              Odśwież
            </Button>
          }
        />
        <p className="text-xs text-muted-foreground">
          Licznik „W Selly" oparty o tabelę selly_products (uzupełnia się przez sync z Bridge).
        </p>

        {blad != null ? (
          <BladSekcji blad={blad} />
        ) : (
          <table className="w-full text-sm" data-testid="selly-tabela-status">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="py-2 text-left font-medium">Dostawca</th>
                <th className="py-2 text-right font-medium">W Bridge</th>
                <th className="py-2 text-right font-medium">W Selly</th>
                <th className="py-2 text-right font-medium">Błędy</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {ladowanie && (
                <tr>
                  <td colSpan={5} className="py-3 text-muted-foreground">
                    Ładowanie...
                  </td>
                </tr>
              )}
              {!ladowanie && wiersze.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-3 text-muted-foreground">
                    Brak danych.
                  </td>
                </tr>
              )}
              {!ladowanie &&
                wiersze.map((wiersz) => (
                  <tr key={wiersz.dostawca} className="border-b border-border/50">
                    <td className="py-2 font-mono font-semibold">{wiersz.dostawca}</td>
                    <td className="py-2 text-right tabular-nums">{wiersz.w_bridge}</td>
                    <td className="py-2 text-right tabular-nums">{wiersz.w_selly}</td>
                    <td className="py-2 text-right tabular-nums">
                      {wiersz.z_bledami > 0 ? (
                        <Badge variant="destructive">{wiersz.z_bledami}</Badge>
                      ) : (
                        "0"
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={syncTrwa}
                        onClick={() => onSync(wiersz.dostawca)}
                        data-testid={`selly-button-sync-${wiersz.dostawca}`}
                      >
                        Sync
                      </Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
