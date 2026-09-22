/**
 * Karta „4.2 Tempo schodzenia z magazynu" — zakładka „Dostępność"
 * (port `deminified/frontend-index.js:28459-28487`).
 *
 * Cztery kolumny 1:1 z oryginałem; przycisk „CSV" (`M("sell-through")`, `:28468`) dołożył
 * blok 10f.
 * Od P10.3 plik powstaje w przeglądarce z wierszy i kolumn tej tabeli po filtrach (`eksport.tsx`).
 *
 * ⚠ W PRODUKCJI TA TABELA I JEJ EKSPORT SĄ PUSTE ZAWSZE — W ODBUDOWIE OD P10.1 TYLKO BEZ
 * HISTORII CEN. Bez historii oryginał nie ma gałęzi zapasowej (`analytics_module.cjs:174`)
 * i tak zostaje. Z historią oryginał wywraca się na `MAX(nazwa)` z `historia_cen` i `safeAll`
 * połyka błąd; backend odbudowy to naprawia (świadome odstępstwo, `docs/rebuild-backlog.md`
 * #32 i #33, 2026-09-21, ticket 90): nazwa z katalogu albo `null` (kreska z `formatuj()`),
 * a duplikaty migawek zwinięte przed liczeniem spadków.
 */
import { useMemo } from "react";

import { Card, CardContent } from "@/components/ui/card";

import type { TempoSchodzenia, WierszTempaSchodzenia } from "./api";
import {
  zastosujFiltry,
  wymiaryNieobslugiwane,
  wymiaryZMapowania,
  type MapowanieWymiarow,
  type WyborFiltrow,
} from "./filtrowanie";
import { NaglowekSekcji } from "./NaglowekSekcji";
import { PrzyciskCsv } from "./eksport";
import { TabelaAnalityki, type KolumnaTabeli } from "./TabelaAnalityki";

const MAPOWANIE: MapowanieWymiarow<WierszTempaSchodzenia> = { dostawcy: (w) => w.dostawca };

const KOLUMNY: KolumnaTabeli<WierszTempaSchodzenia>[] = [
  { key: "dostawca", label: "Dostawca", mono: true },
  { key: "kod", label: "Kod", mono: true },
  { key: "nazwa", label: "Nazwa" },
  { key: "zeszloSztuk", label: "Zeszło sztuk", right: true },
];

export function SekcjaTempaSchodzenia({
  dane,
  wybor,
  ladowanie,
}: {
  dane: TempoSchodzenia | null | undefined;
  wybor: WyborFiltrow;
  ladowanie: boolean;
}) {
  const wiersze = useMemo(
    () => zastosujFiltry(dane?.rows ?? [], wybor, MAPOWANIE),
    [dane, wybor],
  );

  return (
    <Card className="border-card-border">
      <CardContent className="p-0">
        <NaglowekSekcji
          tytul="4.2 Tempo schodzenia z magazynu"
          wszystkie={dane?.rows.length ?? 0}
          widoczne={wiersze.length}
          pominiete={wymiaryNieobslugiwane(wybor, wymiaryZMapowania(MAPOWANIE))}
          wyjasnieniePominietych="Ta sekcja grupuje po dostawcy i kodzie, więc nie stosuje filtrów:"
          rzeczownik="pozycji"
          prefiksTestu="tempo-schodzenia"
          obok={<PrzyciskCsv
              widok="sell-through"
              wiersze={wiersze}
              kolumny={KOLUMNY}
              wczytywanie={ladowanie}
            />}
        />
        <TabelaAnalityki
          dane={wiersze}
          kolumny={KOLUMNY}
          tekstPusty={ladowanie ? "Wczytywanie…" : "Brak danych"}
          testId="tabela-tempo-schodzenia"
        />
      </CardContent>
    </Card>
  );
}
