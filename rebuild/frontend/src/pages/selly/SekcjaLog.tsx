/**
 * Karta „Historia operacji" — `selly-injection.js:475-492` (widok) i `:649-680` (`loadLog`).
 *
 * Siedem kolumn jak w oryginale. Ticket 194 (NOWE, decyzja użytkowniczki 2026-10-06): filtr grup (synchronizacja /
 * usuwanie z Selly), więcej niż 10 wpisów („Pokaż więcej"), czas lokalny zamiast surowego UTC i rozwijane szczegóły
 * z przyczynami błędów. Wcześniej okno „ostatnie 10" mieściło dokładnie jedną rundę synchronizacji (10 dostawców).
 */
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { WpisLogu } from "./api";
import { BladSekcji } from "./BladSekcji";
import { wariantStatusuOperacji } from "./formatowanie";
import { SzczegolyWpisuLogu } from "./SzczegolyWpisuLogu";
import { ETYKIETY_FILTRU, formatujCzasLokalny, type FiltrOperacji } from "./szczegoly-logu";
import { NaglowekKarty } from "./Wskaznik";

/** `success` → default, `error` → destructive, reszta → secondary (`:667`). */
const WARIANT_ODZNAKI = {
  sukces: "default",
  blad: "destructive",
  inny: "secondary",
} as const;

const NA_STRONE = 25;

export function SekcjaLog({
  wpisy,
  ladowanie,
  blad,
  onOdswiez,
  filtr,
  onFiltr,
}: {
  wpisy: WpisLogu[];
  ladowanie: boolean;
  blad: unknown;
  onOdswiez: () => void;
  filtr: FiltrOperacji;
  onFiltr: (filtr: FiltrOperacji) => void;
}) {
  const [widoczne, ustawWidoczne] = useState(NA_STRONE);
  const [rozwiniete, ustawRozwiniete] = useState<ReadonlySet<number>>(new Set());

  const przelacz = (id: number) =>
    ustawRozwiniete((poprzednie) => {
      const nowe = new Set(poprzednie);
      if (!nowe.delete(id)) nowe.add(id);
      return nowe;
    });
  const zmienFiltr = (f: FiltrOperacji) => {
    ustawWidoczne(NA_STRONE);
    onFiltr(f);
  };
  const pokazane = wpisy.slice(0, widoczne);

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
          Ostatnie operacje z tabeli selly_sync_log. Godziny w czasie lokalnym (baza zapisuje UTC). Kliknij „Szczegóły”,
          żeby zobaczyć przyczyny błędów albo co dokładnie usunięto.
        </p>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Rodzaj operacji">
          {(Object.keys(ETYKIETY_FILTRU) as FiltrOperacji[]).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filtr === f ? "default" : "outline"}
              aria-pressed={filtr === f}
              onClick={() => zmienFiltr(f)}
              data-testid={`selly-log-filtr-${f}`}
            >
              {ETYKIETY_FILTRU[f]}
            </Button>
          ))}
        </div>

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
                  <th className="py-2 text-right font-medium">
                    <span className="sr-only">Szczegóły</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {ladowanie && (
                  <tr>
                    <td colSpan={8} className="py-3 text-muted-foreground">
                      Ładowanie...
                    </td>
                  </tr>
                )}
                {!ladowanie && wpisy.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-3 text-muted-foreground" data-testid="selly-log-pusty">
                      {filtr === "usuwanie"
                        ? "Brak wpisów usuwania z Selly. Przebieg, który nie ma czego usuwać, nie zostawia wpisu — aktualny stan jest w karcie „Usuwanie z Selly” wyżej."
                        : "Brak wpisów — jeszcze nie było żadnej operacji."}
                    </td>
                  </tr>
                )}
                {!ladowanie &&
                  pokazane.map((wpis) => {
                    const otwarty = rozwiniete.has(wpis.id);
                    return (
                      <FragmentWiersza
                        key={wpis.id}
                        wpis={wpis}
                        otwarty={otwarty}
                        onPrzelacz={() => przelacz(wpis.id)}
                      />
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}

        {!ladowanie && wpisy.length > widoczne ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => ustawWidoczne((n) => n + NA_STRONE)}
            data-testid="selly-log-wiecej"
          >
            Pokaż więcej ({wpisy.length - widoczne} starszych)
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function FragmentWiersza({
  wpis,
  otwarty,
  onPrzelacz,
}: {
  wpis: WpisLogu;
  otwarty: boolean;
  onPrzelacz: () => void;
}) {
  return (
    <>
      <tr className="border-b border-border/50" data-testid={`selly-log-wiersz-${wpis.id}`}>
        <td className="py-2 font-mono text-xs" title={`UTC: ${wpis.rozpoczeto}`}>
          {formatujCzasLokalny(wpis.rozpoczeto)}
        </td>
        <td className="py-2">{wpis.operacja}</td>
        <td className="py-2 font-mono">{wpis.dostawca_kod || "—"}</td>
        <td className="py-2 text-right">
          <Badge>{wpis.liczba_ok || 0}</Badge>
        </td>
        <td className="py-2 text-right tabular-nums">
          {wpis.liczba_blad > 0 ? <Badge variant="destructive">{wpis.liczba_blad}</Badge> : "0"}
        </td>
        <td className="py-2 text-right tabular-nums">
          {wpis.liczba_skip > 0 ? <Badge variant="secondary">{wpis.liczba_skip}</Badge> : "0"}
        </td>
        <td className="py-2">
          <Badge variant={WARIANT_ODZNAKI[wariantStatusuOperacji(wpis.status)]}>{wpis.status}</Badge>
        </td>
        <td className="py-2 text-right">
          <Button
            size="sm"
            variant="ghost"
            aria-expanded={otwarty}
            onClick={onPrzelacz}
            data-testid={`selly-log-szczegoly-${wpis.id}`}
          >
            {otwarty ? "Ukryj" : "Szczegóły"}
          </Button>
        </td>
      </tr>
      {otwarty ? (
        <tr className="border-b border-border/50 bg-muted/30" data-testid={`selly-log-rozwiniecie-${wpis.id}`}>
          <td colSpan={8} className="px-2 py-3 text-xs">
            <SzczegolyWpisuLogu wpis={wpis} />
          </td>
        </tr>
      ) : null}
    </>
  );
}
