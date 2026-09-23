/**
 * Karta „4.1 Historia dostępności pozycji" — zakładka „Dostępność"
 * (port `deminified/frontend-index.js:28421-28457`).
 *
 * Sześć kolumn 1:1 z oryginałem, z paskiem postępu w kolumnie „Dostępność" (`O(e.dostepnoscPct)`,
 * `:28451`) i przyciskiem „CSV" w nagłówku (`M("availability-products")`, `:28430`), który
 * dołożył blok 10f razem z trasą `GET /api/analytics/export/{view}`.
 * Od P10.3 plik powstaje w przeglądarce z wierszy i kolumn tej tabeli po filtrach (`eksport.tsx`).
 *
 * ⚠ W PRODUKCJI TA TABELA I JEJ EKSPORT SĄ PUSTE, GDY ISTNIEJE HISTORIA CEN — W ODBUDOWIE
 * OD P10.1 JUŻ NIE. Oryginał pyta `historia_cen` o kolumnę `nazwa`, której ta tabela nie ma,
 * a `safeAll` połyka błąd („Brak danych", CSV = sam BOM). Backend odbudowy to naprawia
 * (świadome odstępstwo, `docs/rebuild-backlog.md` #32, 2026-09-21, ticket 90): nazwa idzie
 * z katalogu, a dla pozycji usuniętej z katalogu przychodzi `null` — `formatuj()` rysuje
 * wtedy kreskę, więc widok nie wymagał zmiany.
 */
import { useMemo } from "react";

import { Card, CardContent } from "@/components/ui/card";

import { pobierzPelneWiersze, type Dostepnosc, type WierszDostepnosci } from "./api";
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
          obok={<PrzyciskCsv
              widok="availability-products"
              wiersze={wiersze}
              kolumny={KOLUMNY}
              wczytywanie={ladowanie}
              pobierzPelne={() =>
                pobierzPelneWiersze<Dostepnosc, WierszDostepnosci>(
                  "/api/analytics/availability/products",
                  (pelne) => zastosujFiltry(pelne.rows, wybor, MAPOWANIE),
                )
              }
            />}
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
