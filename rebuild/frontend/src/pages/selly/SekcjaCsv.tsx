/**
 * Karta „Codzienna synchronizacja CSV" — `selly-injection.js:414-436` (widok),
 * `:568-593` (`loadCsvStatus`) i `:596-614` (`generateCsv`).
 *
 * ⚠ Link „Pobierz / podgląd CSV ↗" to `<a href>` z `target="_blank"` (`:416`), a NIE fetch.
 * Plik leży pod adresem podanym przez API i jest pobierany nawigacją przeglądarki —
 * zamiana na `fetch` + blob zmieniłaby sposób autoryzacji żądania.
 *
 * ⚠ Oryginał pyta o potwierdzenie przed generowaniem (`confirm()`, `:599`) — odtwarzamy
 * to dialogiem, z tym samym tekstem.
 */
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { StatusCsv, WynikGenerowaniaCsv } from "./api";
import { BladSekcji } from "./BladSekcji";
import { Badge } from "@/components/ui/badge";
import {
  formatujDateSynchronizacji,
  formatujLiczbe,
  formatujRozmiar,
  stanPlikuCsv,
} from "./formatowanie";
import { NaglowekKarty } from "./Wskaznik";

/** Tekst pytania 1:1 z `selly-injection.js:599`. */
export const PYTANIE_O_GENEROWANIE =
  "Wygenerować plik CSV teraz? Zastąpi bieżący plik pobierany przez Selly.";

export function SekcjaCsv({
  dane,
  ladowanie,
  blad,
  onOdswiez,
  onGeneruj,
  generowanie,
  wynikGenerowania,
  bladGenerowania,
}: {
  dane: StatusCsv | undefined;
  ladowanie: boolean;
  blad: unknown;
  onOdswiez: () => void;
  onGeneruj: () => void;
  generowanie: boolean;
  wynikGenerowania: WynikGenerowaniaCsv | undefined;
  bladGenerowania: unknown;
}) {
  return (
    <Card data-testid="selly-sekcja-csv">
      <CardContent className="space-y-3 p-4">
        <NaglowekKarty
          stan={stanPlikuCsv(ladowanie, Boolean(blad), dane?.status)}
          tytul="Codzienna synchronizacja CSV"
          akcje={
            dane?.url ? (
              <a
                href={dane.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs underline underline-offset-2"
                data-testid="selly-link-csv"
              >
                Pobierz / podgląd CSV ↗
              </a>
            ) : null
          }
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-xs text-muted-foreground">
            Plik CSV generowany codziennie o 6:00 i pobierany przez Selly. Kryterium OK: plik
            wygenerowany dzisiaj i niepusty.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={onGeneruj}
              disabled={generowanie}
              data-testid="selly-button-generuj-csv"
            >
              {generowanie ? "Generuję..." : "Wygeneruj CSV teraz"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={onOdswiez}
              data-testid="selly-button-odswiez-csv"
            >
              Odśwież
            </Button>
          </div>
        </div>

        {ladowanie && (
          <p className="text-sm text-muted-foreground">Sprawdzam status pliku CSV...</p>
        )}
        {!ladowanie && blad != null && <BladSekcji blad={blad} />}
        {!ladowanie && blad == null && dane && (
          // Zdanie podsumowania nad tabelą — `selly-injection.js:580-582`.
          // Przy błędzie powód z API, a gdy go brak — zapasowy tekst oryginału.
          <p className="text-sm" data-testid="selly-podsumowanie-csv">
            {dane.status === "ok" ? (
              <span className="text-emerald-600">
                ✓ Synchronizacja OK — plik wygenerowany dzisiaj
              </span>
            ) : (
              <span className="text-destructive">
                ✗ Błąd synchronizacji — {dane.powod || "plik nieaktualny lub pusty"}
              </span>
            )}
          </p>
        )}

        {generowanie && (
          <p className="text-sm text-amber-600">
            ⏳ Generuję plik CSV, to może potrwać kilkanaście sekund...
          </p>
        )}
        {!generowanie && bladGenerowania != null && <BladSekcji blad={bladGenerowania} />}
        {!generowanie && bladGenerowania == null && wynikGenerowania?.ok && (
          // `selly-injection.js:612` — trzy liczby w jednej linii, czas zaokrąglony do sekund.
          <p className="text-sm text-emerald-600" data-testid="selly-wynik-generowania">
            ✓ Wygenerowano
            {wynikGenerowania.wiersze != null &&
              ` — ${formatujLiczbe(wynikGenerowania.wiersze)} produktów`}
            {wynikGenerowania.rozmiar_mb != null && ` (${wynikGenerowania.rozmiar_mb} MB)`}
            {wynikGenerowania.czas_ms != null &&
              ` w ${Math.round(wynikGenerowania.czas_ms / 1000)} s`}
          </p>
        )}

        {!ladowanie && blad == null && dane && (
          <table className="w-full text-sm" data-testid="selly-tabela-csv">
            <tbody>
              <tr>
                <td className="py-1 text-muted-foreground">Status</td>
                <td className="py-1">
                  <Badge variant={dane.status === "ok" ? "default" : "destructive"}>
                    {dane.status === "ok" ? "OK" : "BŁĄD"}
                  </Badge>
                </td>
              </tr>
              <tr>
                <td className="py-1 text-muted-foreground">Ostatnia synchronizacja</td>
                <td className="py-1">
                  {formatujDateSynchronizacji(dane.ostatnia_synchronizacja)}
                  {dane.wiek_minut != null && (
                    <span
                      className={
                        dane.wygenerowany_dzisiaj ? "text-emerald-600" : "text-amber-600"
                      }
                    >
                      {" "}
                      ({dane.wiek_minut} min temu)
                    </span>
                  )}
                </td>
              </tr>
              <tr>
                <td className="py-1 text-muted-foreground">Liczba produktów w pliku</td>
                <td className="py-1 text-right tabular-nums">{formatujLiczbe(dane.wiersze)}</td>
              </tr>
              <tr>
                <td className="py-1 text-muted-foreground">Rozmiar pliku</td>
                <td className="py-1 text-right tabular-nums">
                  {formatujRozmiar(dane.rozmiar_mb)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
