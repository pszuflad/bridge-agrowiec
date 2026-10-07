/**
 * Karta „Usuwanie z Selly" — stan Toru 3 (ticket 194, NOWE; oryginał nie usuwał nic z Selly).
 *
 * Po co: przebieg bez sierot nie zostawia wpisu w „Historii operacji", więc „nic do usunięcia" i „Tor 3 nie
 * działa" wyglądały tak samo. Ta karta zawsze mówi, w jakim stanie jest usuwanie, kiedy ostatnio sprawdzało
 * i ile produktów czeka.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { StatusUsuwania } from "./api";
import { BladSekcji } from "./BladSekcji";
import { formatujCzasLokalny } from "./szczegoly-logu";
import { NaglowekKarty } from "./Wskaznik";

type Wynik = NonNullable<StatusUsuwania["ostatni_przebieg"]>["wynik"];

const ETYKIETY_WYNIKU: Record<Wynik, { tekst: string; wariant: "default" | "secondary" | "destructive" }> = {
  brak_sierot: { tekst: "Działa — nie ma czego usuwać", wariant: "default" },
  usunieto: { tekst: "Działa — usunięto produkty", wariant: "default" },
  pominieto: { tekst: "Sieroty pominięte (kontrola tożsamości)", wariant: "secondary" },
  wstrzymano: { tekst: "Wstrzymane bezpiecznikiem", wariant: "secondary" },
  limit_dobowy: { tekst: "Wyczerpany limit dobowy", wariant: "secondary" },
  proba_nieokreslona: { tekst: "Próba uprawnień niejednoznaczna", wariant: "secondary" },
  brak_uprawnien: { tekst: "Brak uprawnień do usuwania w Selly", wariant: "destructive" },
  wylaczone: { tekst: "Wyłączone", wariant: "secondary" },
  blad: { tekst: "Błąd przebiegu", wariant: "destructive" },
};

const OPISY_PROBY = {
  jest: "jest (API Selly pozwala usuwać)",
  brak: "brak (API Selly odmawia usuwania)",
  nieokreslony: "niejednoznaczna",
} as const;

export function SekcjaUsuwanie({
  status,
  ladowanie,
  blad,
  onOdswiez,
}: {
  status: StatusUsuwania | undefined;
  ladowanie: boolean;
  blad: unknown;
  onOdswiez: () => void;
}) {
  const przebieg = status?.ostatni_przebieg ?? null;
  const etykieta = status && !status.wlaczone ? ETYKIETY_WYNIKU.wylaczone : przebieg ? ETYKIETY_WYNIKU[przebieg.wynik] : null;

  return (
    <Card data-testid="selly-sekcja-usuwanie">
      <CardContent className="space-y-3 p-4">
        <NaglowekKarty
          stan={ladowanie ? "ladowanie" : blad != null ? "blad" : "ok"}
          tytul="Usuwanie z Selly"
          akcje={
            <Button size="sm" variant="secondary" onClick={onOdswiez} data-testid="selly-button-odswiez-usuwanie">
              Odśwież
            </Button>
          }
        />
        <p className="text-xs text-muted-foreground">
          Co 15 minut (po synchronizacji o :10, :25, :40 i :55) Bridge usuwa z Selly produkty, których nie ma już w
          Bridge. Przebieg bez nic do zrobienia nie zostawia wpisu w historii — stan widać tutaj.
        </p>

        {blad != null ? (
          <BladSekcji blad={blad} />
        ) : !status ? (
          <p className="text-sm text-muted-foreground">Ładowanie...</p>
        ) : (
          <div className="space-y-2 text-sm" data-testid="selly-usuwanie-tresc">
            <div className="flex flex-wrap items-center gap-2">
              {etykieta ? (
                <Badge variant={etykieta.wariant} data-testid="selly-usuwanie-wynik">
                  {etykieta.tekst}
                </Badge>
              ) : (
                <Badge variant="secondary" data-testid="selly-usuwanie-wynik">
                  Czeka na pierwszy przebieg
                </Badge>
              )}
              {przebieg && status.wlaczone ? (
                <span className="text-muted-foreground" data-testid="selly-usuwanie-kiedy">
                  ostatni przebieg: {formatujCzasLokalny(przebieg.kiedy)}
                </span>
              ) : null}
            </div>

            {!status.wlaczone ? (
              <ul className="list-disc pl-5 text-muted-foreground" data-testid="selly-usuwanie-powody">
                {status.powody_wylaczenia.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            ) : przebieg ? (
              <p className="text-muted-foreground" data-testid="selly-usuwanie-opis">
                {przebieg.opis}
              </p>
            ) : (
              <p className="text-muted-foreground" data-testid="selly-usuwanie-opis">
                Pierwszy przebieg po starcie serwera ruszy przy najbliższej synchronizacji (do 15 minut).
              </p>
            )}

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-muted-foreground">Produkty do usunięcia teraz</dt>
              <dd data-testid="selly-usuwanie-sieroty" className="tabular-nums">
                {status.sierot_teraz}
              </dd>
              <dt className="text-muted-foreground">Usunięto w ostatniej dobie</dt>
              <dd data-testid="selly-usuwanie-doba" className="tabular-nums">
                {status.usuniec_24h} z limitu {status.limit_dobowy}
              </dd>
              <dt className="text-muted-foreground">Ostatnie usunięcie</dt>
              <dd data-testid="selly-usuwanie-ostatnie">
                {status.ostatnie_usuniecie ? (
                  <>
                    <span className="font-mono">{status.ostatnie_usuniecie.kod ?? "—"}</span>
                    {status.ostatnie_usuniecie.nazwa ? ` — ${status.ostatnie_usuniecie.nazwa}` : ""}
                    <span className="text-muted-foreground"> ({formatujCzasLokalny(status.ostatnie_usuniecie.kiedy)})</span>
                  </>
                ) : (
                  "jeszcze nic nie usunięto"
                )}
              </dd>
              <dt className="text-muted-foreground">Prawo usuwania w Selly</dt>
              <dd data-testid="selly-usuwanie-proba">
                {status.proba_uprawnien ? OPISY_PROBY[status.proba_uprawnien] : "jeszcze niesprawdzone"}
              </dd>
            </dl>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
