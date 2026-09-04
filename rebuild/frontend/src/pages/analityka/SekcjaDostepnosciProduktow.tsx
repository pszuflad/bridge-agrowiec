/**
 * Karta „4.1 Historia dostępności pozycji" — zakładka „Dostępność"
 * (port `deminified/frontend-index.js:28421-28457`).
 *
 * Sześć kolumn 1:1 z oryginałem, z paskiem postępu w kolumnie „Dostępność" (`O(e.dostepnoscPct)`,
 * `:28451`) i przyciskiem „CSV" w nagłówku (`M("availability-products")`, `:28430`), który
 * dołożył blok 10f razem z trasą `GET /api/analytics/export/{view}`.
 *
 * ⚠ TEN EKSPORT ODDAJE PUSTY PLIK — i tak jest też w produkcji. `export/availability-products`
 * pyta `historia_cen` o kolumnę `nazwa`, której ta tabela nie ma, więc CSV to sam znacznik BOM.
 * Ta sama przyczyna, dla której pusta jest tabela poniżej: `docs/rebuild-backlog.md` #32.
 *
 * ⚠ TA TABELA JEST PUSTA, GDY ISTNIEJE HISTORIA CEN — I TAK JEST TEŻ W PRODUKCJI.
 * Zapytanie gałęzi historycznej pyta `historia_cen` o kolumnę `nazwa`, której ta tabela nie
 * ma, a `safeAll` oryginału połyka błąd i oddaje pustą listę. Dowód z nagrań i pełne
 * uzasadnienie: `rebuild/backend/src/repos/analityka.ts`, nagłówek `bezpiecznieWiersze`.
 * Nie „naprawiamy" tego w UI: pusta tabela z komunikatem „Brak danych" to dokładnie to,
 * co widzi dziś użytkownik produkcji.
 */
import { useMemo } from "react";

import { Card, CardContent } from "@/components/ui/card";

import type { Dostepnosc, WierszDostepnosci } from "./api";
import {
  zastosujFiltry,
  wymiaryNieobslugiwane,
  wymiaryZMapowania,
  type MapowanieWymiarow,
  type WyborFiltrow,
} from "./filtrowanie";
import { NaglowekSekcji } from "./NaglowekSekcji";
import { PrzyciskCsv } from "./eksport";
import { PasekDostepnosci } from "./PasekDostepnosci";
import { TabelaAnalityki, type KolumnaTabeli } from "./TabelaAnalityki";

/**
 * Wiersz niesie tylko dostawcę z sześciu wymiarów filtra — marka, model, rozmiar i oba
 * indeksy nie istnieją w odpowiedzi tej trasy, bo `GROUP BY dostawca, kod` je zwinął.
 */
const MAPOWANIE: MapowanieWymiarow<WierszDostepnosci> = { dostawcy: (w) => w.dostawca };

const KOLUMNY: KolumnaTabeli<WierszDostepnosci>[] = [
  { key: "dostawca", label: "Dostawca", mono: true },
  { key: "kod", label: "Kod", mono: true },
  { key: "ean", label: "EAN", mono: true },
  { key: "nazwa", label: "Nazwa" },
  {
    key: "dostepnoscPct",
    label: "Dostępność",
    render: (w) => <PasekDostepnosci wartosc={w.dostepnoscPct} />,
  },
  { key: "miesiaceBrakow", label: "Miesiące braków" },
];

export function SekcjaDostepnosciProduktow({
  dane,
  wybor,
  ladowanie,
}: {
  dane: Dostepnosc | null | undefined;
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
          tytul="4.1 Historia dostępności pozycji"
          wszystkie={dane?.rows.length ?? 0}
          widoczne={wiersze.length}
          pominiete={wymiaryNieobslugiwane(wybor, wymiaryZMapowania(MAPOWANIE))}
          wyjasnieniePominietych="Ta sekcja grupuje po dostawcy i kodzie, więc nie stosuje filtrów:"
          rzeczownik="pozycji"
          prefiksTestu="dostepnosc-produktow"
          obok={<PrzyciskCsv widok="availability-products" />}
        />
        <TabelaAnalityki
          dane={wiersze}
          kolumny={KOLUMNY}
          tekstPusty={ladowanie ? "Wczytywanie…" : "Brak danych"}
          testId="tabela-dostepnosc-produktow"
        />
      </CardContent>
    </Card>
  );
}
