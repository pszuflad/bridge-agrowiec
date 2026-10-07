/**
 * Karta „Usunięte z Selly" — zbiorcza historia pozycji usuniętych przez Tor 3 (ticket 195, NOWE; oryginał nie usuwał
 * nic z Selly). Jeden wiersz na usuniętą pozycję, najnowsze pierwsze, z paginacją; przycisk „Pobierz CSV" oddaje CAŁĄ
 * historię (nie tylko bieżącą stronę). Źródło: tabela `selly_usuniecia` — bez limitu długości, w odróżnieniu od listy
 * w „Historii operacji", którą backend przycina do 8000 znaków.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LIMIT_USUNIETYCH, type StronaUsunietych, type UsunietaPozycja } from "./api";
import { BladSekcji } from "./BladSekcji";
import { formatujCzasLokalny } from "./szczegoly-logu";
import { NaglowekKarty } from "./Wskaznik";

const ETYKIETY_AKCJI: Record<UsunietaPozycja["akcja"], string> = {
  usunieto_produkt: "Usunięto produkt",
  usunieto_wariant: "Usunięto wariant",
  juz_nie_istnial: "Już nie istniał",
};

export function SekcjaUsuniete({
  strona,
  offset,
  onOffset,
  ladowanie,
  blad,
  onOdswiez,
  onPobierzCsv,
  pobieranieCsv,
  bladCsv,
}: {
  strona: StronaUsunietych | undefined;
  offset: number;
  onOffset: (offset: number) => void;
  ladowanie: boolean;
  blad: unknown;
  onOdswiez: () => void;
  onPobierzCsv: () => void;
  pobieranieCsv: boolean;
  bladCsv: unknown;
}) {
  const wiersze = strona?.items ?? [];
  const razem = strona?.total ?? 0;
  const od = razem === 0 ? 0 : offset + 1;
  const do_ = Math.min(offset + LIMIT_USUNIETYCH, razem);

  return (
    <Card data-testid="selly-sekcja-usuniete">
      <CardContent className="space-y-3 p-4">
        <NaglowekKarty
          stan={ladowanie ? "ladowanie" : blad != null ? "blad" : "ok"}
          tytul="Usunięte z Selly"
          akcje={
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={onOdswiez} data-testid="selly-button-odswiez-usuniete">
                Odśwież
              </Button>
              <Button
                size="sm"
                onClick={onPobierzCsv}
                disabled={pobieranieCsv}
                data-testid="selly-button-pobierz-usuniete-csv"
              >
                {pobieranieCsv ? "Pobieranie..." : "Pobierz CSV"}
              </Button>
            </div>
          }
        />
        <p className="text-xs text-muted-foreground">
          Każdy produkt lub wariant usunięty z Selly zostaje tu zapisany z datą i godziną, kodem, nazwą, EAN-em oraz
          identyfikatorami w Selly. Plik CSV zawiera całą historię, a nie tylko bieżącą stronę.
        </p>

        {bladCsv != null ? <BladSekcji blad={bladCsv} /> : null}

        {blad != null ? (
          <BladSekcji blad={blad} />
        ) : !strona ? (
          <p className="text-sm text-muted-foreground">Ładowanie...</p>
        ) : wiersze.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="selly-usuniete-puste">
            Jeszcze nic nie usunięto z Selly.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="selly-tabela-usuniete">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="py-2 text-left font-medium">Kiedy</th>
                    <th className="py-2 text-left font-medium">Kod</th>
                    <th className="py-2 text-left font-medium">Nazwa</th>
                    <th className="py-2 text-left font-medium">EAN</th>
                    <th className="py-2 text-left font-medium">Dostawca</th>
                    <th className="py-2 text-left font-medium">Akcja</th>
                    <th className="py-2 text-right font-medium">Selly (produkt / wariant)</th>
                  </tr>
                </thead>
                <tbody>
                  {wiersze.map((w) => (
                    <tr key={w.id} className="border-b border-border/50" data-testid="selly-usuniete-wiersz">
                      <td className="py-2 whitespace-nowrap">{formatujCzasLokalny(w.usunieto_at)}</td>
                      <td className="py-2 font-mono">{w.kod}</td>
                      <td className="py-2">{w.nazwa ?? "—"}</td>
                      <td className="py-2 font-mono">{w.ean ?? "—"}</td>
                      <td className="py-2 font-mono">{w.dostawca}</td>
                      <td className="py-2">
                        <Badge variant="secondary">{ETYKIETY_AKCJI[w.akcja]}</Badge>
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums">
                        {w.selly_product_id}
                        {w.selly_variant_id != null ? ` / ${w.selly_variant_id}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span data-testid="selly-usuniete-zakres">
                {od}–{do_} z {razem}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={offset === 0}
                  onClick={() => onOffset(Math.max(0, offset - LIMIT_USUNIETYCH))}
                  data-testid="selly-usuniete-poprzednie"
                >
                  Poprzednie
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={offset + LIMIT_USUNIETYCH >= razem}
                  onClick={() => onOffset(offset + LIMIT_USUNIETYCH)}
                  data-testid="selly-usuniete-nastepne"
                >
                  Następne
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
