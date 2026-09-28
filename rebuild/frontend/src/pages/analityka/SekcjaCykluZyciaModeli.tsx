/**
 * Karta „4.6 Cykl życia modelu" — zakładka „Marża i rotacja", POD kartą marż z bloku 10a
 * (port `deminified/frontend-index.js:28605-28631`).
 *
 * ⚠ NIE MYLIĆ z `SekcjaCyklZyciaDostawcow.tsx` z bloku 10d — tamta karta („1.2 Cykl życia
 * pozycji dostawcy") czyta `suppliers/lifecycle` i `staging_items`. Dwie różne trasy, podobne
 * nazwy; stąd przyrostek `Modeli` w nazwie pliku, komponentu i typów.
 *
 * Pięć kolumn 1:1 z oryginałem. Oryginał nie daje tej karcie przycisku „CSV" i my też nie —
 * `export/{view}` nie ma widoku `lifecycle-models`.
 *
 * Daty (`pierwszyRaz`, `ostatniRaz`) idą przez `formatuj`, czyli w postaci surowego znacznika
 * ISO — dokładnie tak, jak pokazuje je oryginał (kolumny `mono`).
 */
import { useMemo } from "react";

import { Card, CardContent } from "@/components/ui/card";

import type { CyklZyciaModeli, WierszCykluZyciaModelu } from "./api";
import {
  zastosujFiltry,
  wymiaryNieobslugiwane,
  wymiaryZMapowania,
  type MapowanieWymiarow,
  type WyborFiltrow,
} from "./filtrowanie";
import { NaglowekSekcji } from "./NaglowekSekcji";
import { TabelaAnalityki, type KolumnaTabeli } from "./TabelaAnalityki";

/** Wiersz grupuje po marce i modelu — tylko te dwa wymiary mają tu na czym zadziałać. */
const MAPOWANIE: MapowanieWymiarow<WierszCykluZyciaModelu> = {
  marki: (w) => w.marka,
  modele: (w) => w.model,
};

const KOLUMNY: KolumnaTabeli<WierszCykluZyciaModelu>[] = [
  { key: "marka", label: "Marka" },
  { key: "model", label: "Model" },
  { key: "pierwszyRaz", label: "Pierwszy raz", mono: true },
  { key: "ostatniRaz", label: "Ostatni raz", mono: true },
  { key: "produkty", label: "Produkty", right: true },
];

export function SekcjaCykluZyciaModeli({
  dane,
  wybor,
  ladowanie,
}: {
  dane: CyklZyciaModeli | null | undefined;
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
          tytul="4.6 Cykl życia modelu"
          wszystkie={dane?.rows.length ?? 0}
          widoczne={wiersze.length}
          pominiete={wymiaryNieobslugiwane(wybor, wymiaryZMapowania(MAPOWANIE))}
          wyjasnieniePominietych="Ta sekcja grupuje po marce i modelu, więc nie stosuje filtrów:"
          rzeczownik="modeli"
          prefiksTestu="cykl-zycia"
        />
        <TabelaAnalityki
          dane={wiersze}
          kolumny={KOLUMNY}
          tekstPusty={ladowanie ? "Wczytywanie…" : "Brak danych"}
          testId="tabela-cykl-zycia"
        />
      </CardContent>
    </Card>
  );
}
