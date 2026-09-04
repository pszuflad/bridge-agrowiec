/**
 * Sekcja „1.4 / 1.5 Stan i dostępność dostawcy" — trzecia karta zakładki `dostawcy` (blok 10d).
 *
 * Port karty z `deminified/frontend-index.js:28135-28172`: tytuł i pięć kolumn 1:1
 * z oryginałem, z paskiem postępu w kolumnie „Dostępność" (`render: e => O(e.dostepnoscPct)`,
 * `:28165`). Wykres nad tabelą jest odstępstwem (O-10d-1, decyzja D2) — oryginał nie ma
 * ani jednego wykresu; kontynuujemy tu wzorzec z sekcji marż bloku 10a.
 *
 * ⚠ CZEGO TU CELOWO NIE MA: przycisku „CSV" (`M("suppliers-stock")`, `:28144`) — blok 10f.
 */
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent } from "@/components/ui/card";
import {
  GRUBOSC_SLUPKA,
  KOLOR_ETYKIET,
  KOLOR_SERII,
  KOLOR_SIATKI,
  KontenerWykresu,
  PROMIEN_SLUPKA,
  TrescTooltipa,
} from "@/components/ui/chart";

import type { WierszStanuDostawcy } from "./api";
import {
  ETYKIETY_WYMIAROW,
  WYMIARY_DOSTAWCOW,
  wymiaryNieobslugiwane,
  zastosujFiltryDostawcow,
  type WyborFiltrow,
} from "./filtrowanie";
import { formatuj, formatujProcent } from "./formatowanie";
import { PasekDostepnosci } from "./PasekDostepnosci";
import { TabelaAnalityki, type KolumnaTabeli } from "./TabelaAnalityki";

/**
 * Górna granica liczby słupków. `GROUP BY dostawca` zwija katalog do jednego wiersza na
 * dostawcę, a dostawców jest kilkanaście — w praktyce ten limit się nie włącza. Jest tu na
 * wypadek bazy z nietypowo długą listą dostawców, żeby wykres nie zamienił się w grzebień;
 * od kompletu jest tabela pod nim.
 */
const DOSTAWCOW_NA_WYKRESIE = 20;

/** Skala osi dostępności — procent, więc zawsze pełne 0–100, niezależnie od danych. */
const SKALA_PROCENTOWA: [number, number] = [0, 100];

/** Pięć kolumn 1:1 z oryginałem (`:28150-28168`). Ostatnia rysuje pasek, nie liczbę. */
const KOLUMNY: KolumnaTabeli<WierszStanuDostawcy>[] = [
  { key: "dostawca", label: "Dostawca", mono: true },
  { key: "produkty", label: "Produkty", right: true },
  { key: "sredniStan", label: "Śr. stan", right: true },
  { key: "dostepne", label: "Dostępne", right: true },
  {
    key: "dostepnoscPct",
    label: "Dostępność",
    render: (w) => <PasekDostepnosci wartosc={w.dostepnoscPct} />,
  },
];

type PunktWykresu = { dostawca: string; dostepnoscPct: number; produkty: number; dostepne: number };

export function SekcjaStanDostawcow({
  dane,
  wybor,
  ladowanie,
}: {
  dane: { rows: WierszStanuDostawcy[] } | null | undefined;
  wybor: WyborFiltrow;
  ladowanie: boolean;
}) {
  const wiersze = useMemo(
    () => zastosujFiltryDostawcow(dane?.rows ?? [], wybor),
    [dane, wybor],
  );

  /**
   * Kolejność słupków jest kolejnością ODPOWIEDZI, nie decyzją widoku: backend sortuje
   * `dostepnoscPct DESC, produkty DESC` (`analytics_module.cjs:152`), więc dostawcy o pełnej
   * dostępności stoją na górze, a przy remisie wyżej jest ten z większym katalogiem.
   *
   * Dostawcy bez policzonej dostępności (`null` — katalog bez ani jednego produktu z ceną
   * i stanem) odpadają: słupek o nieznanej długości nie ma jak się narysować. W tabeli taki
   * wiersz dalej widać, z paskiem o szerokości zero i podpisem „—".
   */
  const punkty = useMemo<PunktWykresu[]>(
    () =>
      wiersze
        .filter((w): w is WierszStanuDostawcy & { dostepnoscPct: number } => w.dostepnoscPct !== null)
        .slice(0, DOSTAWCOW_NA_WYKRESIE)
        .map((w) => ({
          dostawca: w.dostawca,
          dostepnoscPct: w.dostepnoscPct,
          produkty: w.produkty,
          dostepne: w.dostepne,
        })),
    [wiersze],
  );

  const pominiete = wymiaryNieobslugiwane(wybor, WYMIARY_DOSTAWCOW);
  const wszystkie = dane?.rows.length ?? 0;
  const odfiltrowane = wszystkie - wiersze.length;

  return (
    <Card className="border-card-border">
      <CardContent className="p-0">
        <div className="border-b px-4 py-3">
          <div className="text-sm font-semibold">1.4 / 1.5 Stan i dostępność dostawcy</div>
          {odfiltrowane > 0 && (
            <div className="mt-1 text-xs text-muted-foreground" data-testid="stan-licznik-filtra">
              Filtry ukryły {formatuj(odfiltrowane)} z {formatuj(wszystkie)} dostawców.
            </div>
          )}
          {pominiete.length > 0 && (
            <div className="mt-1 text-xs text-muted-foreground" data-testid="stan-pominiete">
              Ta sekcja grupuje po dostawcy, więc nie stosuje filtrów:{" "}
              {pominiete.map((w) => ETYKIETY_WYMIAROW[w]).join(", ")}.
            </div>
          )}
        </div>

        {/*
          FORMA (skill `dataviz`, `references/choosing-a-form.md`): porównanie jednej wielkości
          w wielu kategoriach → słupek POZIOMY. Jedna seria, więc legendy nie ma (tytuł nazywa,
          co rysujemy) i kolor jest jeden — slot 1 palety, której nie wolno ruszać
          (`test/tokeny.test.ts`). Jedna oś, w pełnej skali 0–100, bo to procent: bez tego
          różnica 98% vs 100% urosłaby wizualnie do przepaści. Wartości siedzą przy końcach
          słupków, a pod wykresem stoi tabela z tymi samymi liczbami — to razem zdejmuje
          ostrzeżenie walidatora o kontraście `--chart-1` do tła (2.61 < 3:1).
        */}
        {punkty.length > 0 && (
          <div className="border-b px-4 py-4">
            <div className="mb-2 text-xs text-muted-foreground">
              Dostępność katalogu per dostawca
            </div>
            <KontenerWykresu
              wysokosc={Math.max(160, punkty.length * 26 + 40)}
              opis={`Wykres słupkowy: udział pozycji dostępnych w katalogu ${punkty.length} dostawców. Te same liczby są w tabeli poniżej.`}
            >
              <BarChart
                data={punkty}
                layout="vertical"
                margin={{ top: 0, right: 56, bottom: 0, left: 8 }}
                barCategoryGap={2}
              >
                <CartesianGrid horizontal={false} stroke={KOLOR_SIATKI} strokeWidth={1} />
                <XAxis
                  type="number"
                  domain={SKALA_PROCENTOWA}
                  tick={{ fill: KOLOR_ETYKIET, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: KOLOR_SIATKI }}
                  unit="%"
                />
                <YAxis
                  type="category"
                  dataKey="dostawca"
                  width={80}
                  tick={{ fill: KOLOR_ETYKIET, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: KOLOR_SIATKI, fillOpacity: 0.25 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const punkt = payload[0]?.payload as PunktWykresu | undefined;
                    if (!punkt) return null;
                    return (
                      <TrescTooltipa
                        tytul={punkt.dostawca}
                        pozycje={[
                          {
                            nazwa: "Dostępność",
                            wartosc: formatujProcent(punkt.dostepnoscPct),
                            kolor: KOLOR_SERII,
                          },
                          { nazwa: "Dostępne", wartosc: formatuj(punkt.dostepne) },
                          { nazwa: "Produkty", wartosc: formatuj(punkt.produkty) },
                        ]}
                      />
                    );
                  }}
                />
                <Bar
                  dataKey="dostepnoscPct"
                  fill={KOLOR_SERII}
                  barSize={GRUBOSC_SLUPKA}
                  radius={PROMIEN_SLUPKA}
                  isAnimationActive={false}
                >
                  {/* Etykieta na końcu słupka, poza nim — nigdy nie przycinamy tekstu. */}
                  <LabelList
                    dataKey="dostepnoscPct"
                    position="right"
                    fill={KOLOR_ETYKIET}
                    fontSize={11}
                    formatter={(v: unknown) => formatujProcent(v)}
                  />
                </Bar>
              </BarChart>
            </KontenerWykresu>
          </div>
        )}

        <TabelaAnalityki
          dane={wiersze}
          kolumny={KOLUMNY}
          tekstPusty={ladowanie ? "Wczytywanie…" : "Brak danych"}
          testId="tabela-stan-dostawcow"
        />
      </CardContent>
    </Card>
  );
}
