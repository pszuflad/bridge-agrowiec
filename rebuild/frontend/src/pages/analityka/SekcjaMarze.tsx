/**
 * Sekcja „Marża per dostawca/kategoria/marka" — DASHBOARD-WZORZEC bloku 10a.
 *
 * Port karty z zakładki „Marża i rotacja" (`deminified/frontend-index.js:28516-28560`):
 * nagłówek karty i siedem kolumn tabeli są 1:1 z oryginałem. Wykres nad tabelą jest
 * odstępstwem (O-10a-3) — oryginał nie ma żadnych wykresów.
 *
 * ⚠ CZEGO TU CELOWO NIE MA: przycisku „CSV". W oryginale karta ma go
 * (`onClick: () => M("margins")` → `GET /api/analytics/export/margins`, `:28524`), ale trasa
 * eksportu należy do bloku 10f i jeszcze nie istnieje — przycisk wiodący donikąd byłby gorszy
 * niż jego brak. Dokłada go 10f razem z `analytics/export/{view}`.
 *
 * ⚠ CZEGO NIE RENDERUJEMY, CHOĆ PRZYCHODZI: `low` i `high` z odpowiedzi. Produkcyjny frontend
 * też ich nie pokazuje — pobiera i ignoruje. Odtwarzamy to zachowanie.
 *
 * ─── WZORZEC DLA 10b–10e ──────────────────────────────────────────────────────────────
 * Ten plik jest szablonem: hook z `api.ts` → `useMemo` z filtrami (albo parametr w `queryKey`,
 * gdy oryginalna trasa go ma) → wykres → `TabelaAnalityki`. Pełny opis: `README.md` obok.
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

import type { GrupaMarzy, Marze } from "./api";
import {
  ETYKIETY_WYMIAROW,
  WYMIARY_MARZ,
  wymiaryNieobslugiwane,
  zastosujFiltryMarz,
  type WyborFiltrow,
} from "./filtrowanie";
import { formatuj, formatujProcent } from "./formatowanie";
import { TabelaAnalityki, type KolumnaTabeli } from "./TabelaAnalityki";

/**
 * Ile grup trafia na wykres. Wykres odpowiada na pytanie „gdzie marża jest najniższa",
 * a nie „jak wygląda całość" — od całości jest tabela pod nim. Piętnaście słupków mieści
 * się bez zderzania etykiet; więcej zamieniłoby wykres w nieczytelny grzebień.
 */
const GRUP_NA_WYKRESIE = 15;

/** Siedem kolumn 1:1 z oryginałem (`:28526-28558`), z zachowanym wyrównaniem i monospace. */
const KOLUMNY: KolumnaTabeli<GrupaMarzy>[] = [
  { key: "dostawca", label: "Dostawca", mono: true },
  { key: "kategoria", label: "Kategoria" },
  { key: "marka", label: "Marka" },
  { key: "produkty", label: "Produkty", right: true },
  { key: "avgMarza", label: "Śr. marża", right: true },
  { key: "minMarza", label: "Min", right: true },
  { key: "maxMarza", label: "Max", right: true },
];

/** Podpis grupy na osi kategorii — trzy wymiary grupowania sklejone w jedną etykietę. */
function podpisGrupy(w: GrupaMarzy): string {
  return `${w.dostawca} · ${w.kategoria} · ${w.marka}`;
}

type PunktWykresu = { podpis: string; avgMarza: number; produkty: number };

export function SekcjaMarze({
  dane,
  wybor,
  ladowanie,
}: {
  dane: Marze | null | undefined;
  wybor: WyborFiltrow;
  ladowanie: boolean;
}) {
  const wiersze = useMemo(
    () => zastosujFiltryMarz(dane?.rows ?? [], wybor),
    [dane, wybor],
  );

  /**
   * Wykres bierze pierwsze `GRUP_NA_WYKRESIE` wierszy, bo backend sortuje `avgMarza ASC`
   * (`analytics_module.cjs:293`) — czyli najgorsze marże są już na górze. Nie sortujemy
   * ponownie: porządek jest częścią odpowiedzi, a nie decyzją widoku.
   *
   * Grupy bez policzonej średniej (`avgMarza: null`) odpadają — słupek o nieznanej długości
   * nie ma jak się narysować, a w tabeli taki wiersz dalej widać jako „—".
   */
  const punkty = useMemo<PunktWykresu[]>(
    () =>
      wiersze
        .filter((w): w is GrupaMarzy & { avgMarza: number } => w.avgMarza !== null)
        .slice(0, GRUP_NA_WYKRESIE)
        .map((w) => ({ podpis: podpisGrupy(w), avgMarza: w.avgMarza, produkty: w.produkty })),
    [wiersze],
  );

  const pominiete = wymiaryNieobslugiwane(wybor, WYMIARY_MARZ);
  const wszystkie = dane?.rows.length ?? 0;
  const odfiltrowane = wszystkie - wiersze.length;

  return (
    <Card className="border-card-border">
      <CardContent className="p-0">
        <div className="border-b px-4 py-3">
          <div className="text-sm font-semibold">Marża per dostawca/kategoria/marka</div>
          {odfiltrowane > 0 && (
            <div className="mt-1 text-xs text-muted-foreground" data-testid="marze-licznik-filtra">
              Filtry ukryły {formatuj(odfiltrowane)} z {formatuj(wszystkie)} grup.
            </div>
          )}
          {pominiete.length > 0 && (
            <div className="mt-1 text-xs text-muted-foreground" data-testid="marze-pominiete">
              Ta sekcja grupuje po dostawcy, kategorii i marce, więc nie stosuje filtrów:{" "}
              {pominiete.map((w) => ETYKIETY_WYMIAROW[w]).join(", ")}.
            </div>
          )}
        </div>

        {/*
          FORMA (skill `dataviz`, `references/choosing-a-form.md`): porównanie wielkości
          w wielu kategoriach o długich nazwach → słupek POZIOMY. Jedna seria, więc
          legendy nie ma (tytuł nazywa, co jest rysowane), a kolor jest jeden.
          Wartości siedzą przy końcach słupków — to razem z tabelą poniżej zdejmuje
          ostrzeżenie walidatora o kontraście `--chart-1` do tła (2.61 < 3:1).
        */}
        {punkty.length > 0 && (
          <div className="border-b px-4 py-4">
            <div className="mb-2 text-xs text-muted-foreground">
              {GRUP_NA_WYKRESIE} grup o najniższej średniej marży
            </div>
            <KontenerWykresu
              wysokosc={Math.max(160, punkty.length * 26 + 40)}
              opis={`Wykres słupkowy: ${punkty.length} grup o najniższej średniej marży. Te same liczby są w tabeli poniżej.`}
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
                  tick={{ fill: KOLOR_ETYKIET, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: KOLOR_SIATKI }}
                  unit="%"
                />
                <YAxis
                  type="category"
                  dataKey="podpis"
                  width={220}
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
                        tytul={punkt.podpis}
                        pozycje={[
                          {
                            nazwa: "Śr. marża",
                            wartosc: formatujProcent(punkt.avgMarza),
                            kolor: KOLOR_SERII,
                          },
                          { nazwa: "Produkty", wartosc: formatuj(punkt.produkty) },
                        ]}
                      />
                    );
                  }}
                />
                <Bar
                  dataKey="avgMarza"
                  fill={KOLOR_SERII}
                  barSize={GRUBOSC_SLUPKA}
                  radius={PROMIEN_SLUPKA}
                  isAnimationActive={false}
                >
                  {/* Etykieta na końcu słupka, poza nim — nigdy nie przycinamy tekstu. */}
                  <LabelList
                    dataKey="avgMarza"
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
          testId="tabela-marze"
        />
      </CardContent>
    </Card>
  );
}
