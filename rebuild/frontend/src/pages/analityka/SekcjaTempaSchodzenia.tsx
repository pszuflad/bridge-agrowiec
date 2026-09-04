/**
 * Karta „4.2 Tempo schodzenia z magazynu" — zakładka „Dostępność"
 * (port `deminified/frontend-index.js:28459-28487`).
 *
 * Cztery kolumny 1:1 z oryginałem. Bez przycisku „CSV" (`M("sell-through")`, `:28468`) —
 * trasa eksportu należy do bloku 10f.
 *
 * ⚠ TA TABELA JEST PUSTA ZAWSZE, I TAK JEST TEŻ W PRODUKCJI. Bez historii cen backend
 * oryginału nie ma gałęzi zapasowej i zwraca pustą listę (`analytics_module.cjs:174`),
 * a z historią zapytanie wywraca się na `MAX(nazwa)` z `historia_cen` — kolumny, której ta
 * tabela nie ma — i `safeAll` połyka błąd. Uzasadnienie z dowodem: nagłówek
 * `bezpiecznieWiersze` w `rebuild/backend/src/repos/analityka.ts`.
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
