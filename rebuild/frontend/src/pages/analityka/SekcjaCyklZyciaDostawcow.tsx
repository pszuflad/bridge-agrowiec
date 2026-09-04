/**
 * Sekcja „1.2 Nowości i wycofania" — druga karta zakładki `dostawcy` (blok 10d).
 *
 * Port karty z `deminified/frontend-index.js:28097-28134`: tytuł i sześć kolumn 1:1
 * z oryginałem.
 *
 * ⚠ TO DZIENNIK STAGINGU, NIE KATALOG. `GET /api/analytics/suppliers/lifecycle` czyta
 * `staging_items` (`analytics_module.cjs:133-141`), czyli decyzje importu — pozycja pojawiła
 * się w cenniku albo z niego zniknęła. Dlatego wiersz o wycofaniu opisuje coś, czego
 * w aktywnym katalogu już nie ma, a kolumna „Powód" bywa pusta dla nowości.
 *
 * ⚠ KOLUMNA „DATA" POKAZUJE SUROWY ZNACZNIK ISO, bez formatowania — oryginał przepuszcza
 * `kiedy` przez ten sam `_()`, co liczby (`mono: 1`, `:28113`), a ten napisów nie tyka.
 * Zachowujemy to, bo taki widok Ania zna z produkcji.
 *
 * ⚠ CZEGO TU CELOWO NIE MA: przycisku „CSV" (`M("suppliers-lifecycle")`, `:28106`) — blok 10f.
 */
import { useMemo } from "react";

import { Card, CardContent } from "@/components/ui/card";

import type { WierszCykluZycia } from "./api";
import {
  ETYKIETY_WYMIAROW,
  WYMIARY_DOSTAWCOW,
  wymiaryNieobslugiwane,
  zastosujFiltryDostawcow,
  type WyborFiltrow,
} from "./filtrowanie";
import { formatuj } from "./formatowanie";
import { TabelaAnalityki, type KolumnaTabeli } from "./TabelaAnalityki";

/** Sześć kolumn 1:1 z oryginałem (`:28113-28132`). Pierwsze cztery monospace. */
const KOLUMNY: KolumnaTabeli<WierszCykluZycia>[] = [
  { key: "kiedy", label: "Data", mono: true },
  { key: "dostawca", label: "Dostawca", mono: true },
  { key: "typ", label: "Typ", mono: true },
  { key: "kod", label: "Kod", mono: true },
  { key: "nazwa", label: "Nazwa" },
  { key: "powod", label: "Powód" },
];

export function SekcjaCyklZyciaDostawcow({
  dane,
  wybor,
  ladowanie,
}: {
  dane: { rows: WierszCykluZycia[] } | null | undefined;
  wybor: WyborFiltrow;
  ladowanie: boolean;
}) {
  const wiersze = useMemo(
    () => zastosujFiltryDostawcow(dane?.rows ?? [], wybor),
    [dane, wybor],
  );

  const pominiete = wymiaryNieobslugiwane(wybor, WYMIARY_DOSTAWCOW);
  const wszystkie = dane?.rows.length ?? 0;
  const odfiltrowane = wszystkie - wiersze.length;

  return (
    <Card className="border-card-border">
      <CardContent className="p-0">
        <div className="border-b px-4 py-3">
          <div className="text-sm font-semibold">1.2 Nowości i wycofania</div>
          {odfiltrowane > 0 && (
            <div
              className="mt-1 text-xs text-muted-foreground"
              data-testid="cykl-zycia-licznik-filtra"
            >
              Filtry ukryły {formatuj(odfiltrowane)} z {formatuj(wszystkie)} pozycji.
            </div>
          )}
          {pominiete.length > 0 && (
            <div className="mt-1 text-xs text-muted-foreground" data-testid="cykl-zycia-pominiete">
              Ta sekcja czyta staging, który nie niesie tych wymiarów:{" "}
              {pominiete.map((w) => ETYKIETY_WYMIAROW[w]).join(", ")}.
            </div>
          )}
        </div>

        <TabelaAnalityki
          dane={wiersze}
          kolumny={KOLUMNY}
          tekstPusty={ladowanie ? "Wczytywanie…" : "Brak danych"}
          testId="tabela-cykl-zycia-dostawcow"
        />
      </CardContent>
    </Card>
  );
}
