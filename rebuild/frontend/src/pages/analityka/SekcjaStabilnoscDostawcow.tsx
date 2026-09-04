/**
 * Sekcja „1.1 Stabilność cennika dostawcy" — pierwsza karta zakładki `dostawcy` (blok 10d).
 *
 * Port karty z `deminified/frontend-index.js:28054-28096`: tytuł i SIEDEM kolumn 1:1
 * z oryginałem, w jego kolejności.
 *
 * ⚠ SIEDEM KOLUMN, PIĘĆ PÓL W ODPOWIEDZI — I TAK JEST W PRODUKCJI. Backend ma dwie gałęzie
 * (`analytics_module.cjs:110-131`) i żadna nie wypełnia kompletu:
 *
 * | kolumna            | `hasHistory: true` | `hasHistory: false` |
 * |--------------------|--------------------|---------------------|
 * | Dostawca           | jest               | jest                |
 * | Produkty           | **„—"**            | jest                |
 * | Punkty historii    | jest               | **„—"**             |
 * | Zmiany · Śr. zm. % · Max % | jest       | `null` → **„—"**    |
 * | Śr. stan           | **„—"**            | jest                |
 *
 * Gałąź zapasowa zwraca do tego `sredniaCena`, dla której w UI NIE MA KOLUMNY — oryginał
 * po prostu jej nie pokazuje.
 *
 * Odtwarzamy to bez adnotacji przy pustych komórkach (decyzja D1, 2026-09-03): oryginał też
 * niczego nie sygnalizuje, a banner o zasięgu historii cen z bloku 10a stoi już na górze
 * strony i tłumaczy, skąd biorą się puste kolumny. To jest ZASTANE ZACHOWANIE, nie bug
 * do naprawienia — jeśli kiedyś ma się zmienić, wymaga osobnej, nazwanej decyzji.
 *
 * ⚠ CZEGO TU CELOWO NIE MA: przycisku „CSV" (`onClick: () => M("suppliers-stability")`,
 * `:28063`). Trasa `GET /api/analytics/export/{view}` należy do bloku 10f i jeszcze nie
 * istnieje — tak samo postąpiło 10a w sekcji marż.
 */
import { useMemo } from "react";

import { Card, CardContent } from "@/components/ui/card";

import type { StabilnoscDostawcow, WierszStabilnosci } from "./api";
import {
  ETYKIETY_WYMIAROW,
  WYMIARY_DOSTAWCOW,
  wymiaryNieobslugiwane,
  zastosujFiltryDostawcow,
  type WyborFiltrow,
} from "./filtrowanie";
import { formatuj } from "./formatowanie";
import { TabelaAnalityki, type KolumnaTabeli } from "./TabelaAnalityki";

/** Siedem kolumn 1:1 z oryginałem (`:28070-28093`), z zachowanym wyrównaniem i monospace. */
const KOLUMNY: KolumnaTabeli<WierszStabilnosci>[] = [
  { key: "dostawca", label: "Dostawca", mono: true },
  { key: "produkty", label: "Produkty", right: true },
  { key: "punkty", label: "Punkty historii", right: true },
  { key: "liczbaZmian", label: "Zmiany", right: true },
  { key: "sredniaZmianaPct", label: "Śr. zmiana %", right: true },
  { key: "maxZmianaPct", label: "Max %", right: true },
  { key: "sredniStan", label: "Śr. stan", right: true },
];

export function SekcjaStabilnoscDostawcow({
  dane,
  wybor,
  ladowanie,
}: {
  dane: StabilnoscDostawcow | null | undefined;
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
          <div className="text-sm font-semibold">1.1 Stabilność cennika dostawcy</div>
          {odfiltrowane > 0 && (
            <div
              className="mt-1 text-xs text-muted-foreground"
              data-testid="stabilnosc-licznik-filtra"
            >
              Filtry ukryły {formatuj(odfiltrowane)} z {formatuj(wszystkie)} dostawców.
            </div>
          )}
          {pominiete.length > 0 && (
            <div className="mt-1 text-xs text-muted-foreground" data-testid="stabilnosc-pominiete">
              Ta sekcja grupuje po dostawcy, więc nie stosuje filtrów:{" "}
              {pominiete.map((w) => ETYKIETY_WYMIAROW[w]).join(", ")}.
            </div>
          )}
        </div>

        <TabelaAnalityki
          dane={wiersze}
          kolumny={KOLUMNY}
          tekstPusty={ladowanie ? "Wczytywanie…" : "Brak danych"}
          testId="tabela-stabilnosc-dostawcow"
        />
      </CardContent>
    </Card>
  );
}
