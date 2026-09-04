/**
 * Karta „Historia operacji" — `selly-injection.js:475-492` (widok) i `:649-680` (`loadLog`).
 *
 * Siedem kolumn, limit 10 wpisów zaszyty w ścieżce (`/log?limit=10`).
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { WpisLogu } from "./api";
import { BladSekcji } from "./BladSekcji";
import { formatujDateLogu, wariantStatusuOperacji } from "./formatowanie";
import { NaglowekKarty } from "./Wskaznik";

/** `success` → default, `error` → destructive, reszta → secondary (`:667`). */
const WARIANT_ODZNAKI = {
  ok: "default",
  blad: "destructive",
  ladowanie: "secondary",
} as const;

export function SekcjaLog({
  wpisy,
  ladowanie,
  blad,
  onOdswiez,
}: {
  wpisy: WpisLogu[];
  ladowanie: boolean;
  blad: unknown;
  onOdswiez: () => void;
}) {
  return (
    <Card data-testid="selly-sekcja-log">
      <CardContent className="space-y-3 p-4">
        <NaglowekKarty
          stan={ladowanie ? "ladowanie" : blad != null ? "blad" : "ok"}
          tytul="Historia operacji"
          akcje={
            <Button
              size="sm"
              variant="secondary"
              onClick={onOdswiez}
              data-testid="selly-button-odswiez-log"
            >
              Odśwież
            </Button>
          }
        />
        <p className="text-xs text-muted-foreground">
          Ostatnie 10 operacji z tabeli selly_sync_log.
        </p>

        {blad != null ? (
          <BladSekcji blad={blad} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="selly-tabela-log">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="py-2 text-left font-medium">Data</th>
                  <th className="py-2 text-left font-medium">Operacja</th>
                  <th className="py-2 text-left font-medium">Dostawca</th>
                  <th className="py-2 text-right font-medium">OK</th>
                  <th className="py-2 text-right font-medium">Błąd</th>
                  <th className="py-2 text-right font-medium">Skip</th>
                  <th className="py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {ladowanie && (
                  <tr>
                    <td colSpan={7} className="py-3 text-muted-foreground">
                      Ładowanie...
                    </td>
                  </tr>
                )}
                {!ladowanie && wpisy.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-3 text-muted-foreground">
                      Brak wpisów — jeszcze nie było żadnej operacji.
                    </td>
                  </tr>
                )}
                {!ladowanie &&
                  wpisy.map((wpis) => (
                    <tr key={wpis.id} className="border-b border-border/50">
                      <td className="py-2 font-mono text-xs">
                        {formatujDateLogu(wpis.rozpoczeto)}
                      </td>
                      <td className="py-2">{wpis.operacja}</td>
                      <td className="py-2 font-mono">{wpis.dostawca_kod || "—"}</td>
                      <td className="py-2 text-right">
                        <Badge>{wpis.liczba_ok || 0}</Badge>
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {wpis.liczba_blad > 0 ? (
                          <Badge variant="destructive">{wpis.liczba_blad}</Badge>
                        ) : (
                          "0"
                        )}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {wpis.liczba_skip > 0 ? (
                          <Badge variant="secondary">{wpis.liczba_skip}</Badge>
                        ) : (
                          "0"
                        )}
                      </td>
                      <td className="py-2">
                        <Badge variant={WARIANT_ODZNAKI[wariantStatusuOperacji(wpis.status)]}>
                          {wpis.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
