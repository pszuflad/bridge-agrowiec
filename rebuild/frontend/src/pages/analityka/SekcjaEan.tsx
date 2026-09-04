/**
 * Zakładka „EAN i ceny" — trzy karty bloku 10c.
 *
 * Port `TabsContent value="ean"` z widoku `/analityka`
 * (`deminified/frontend-index.js:28175-28294`). 1:1 z oryginałem są: liczba i kolejność kart,
 * ich tytuły (łącznie z numeracją „2.1-2.4", „2.5", „2.6"), komplet kolumn każdej tabeli,
 * ich etykiety PL, wyrównanie do prawej przy liczbach i krój monospace przy EAN-ie i kodzie
 * dostawcy, a także układ karty „2.6": JEDNA karta, DWIE niezależne tabele w gridzie
 * dwukolumnowym (`:28258-28262`).
 *
 * ─── CZEGO TU CELOWO NIE MA ───────────────────────────────────────────────────────────
 * Przycisków „CSV" przy kartach „2.1-2.4" (`onClick: () => M("ean-comparison")`, `:28190`)
 * i „2.5" (`M("unique")`, `:28234`). Trasa `GET /api/analytics/export/{view}` należy do bloku
 * **10f** i jeszcze nie istnieje — przycisk wiodący donikąd byłby gorszy niż jego brak.
 * Ta sama decyzja co w `SekcjaMarze.tsx` (10a); 10f dokłada wszystkie naraz.
 *
 * ─── ŚWIADOME ODSTĘPSTWA (decyzje użytkownika D2 i D4, 2026-09-03) ────────────────────
 *  • O-10c-1 — dwa wykresy w karcie „2.6" plus liczba nagłówkowa „% EAN-ów u ≥2 dostawców".
 *    Oryginał nie ma ANI JEDNEGO wykresu; furtkę otworzyło 10a (O-10a-3) i ono postawiło
 *    infrastrukturę (`components/ui/chart.tsx`). Karty „2.1-2.4" i „2.5" zostają bez wykresu
 *    świadomie: to listy do przeglądania i wyszukiwania, a nie porównania wielkości — forma
 *    ma wynikać z zadania danych, nie z tego, że biblioteka jest pod ręką (skill `dataviz`,
 *    `references/choosing-a-form.md`).
 *  • O-10c-2 — notka o wymiarach filtra, których dana karta nie stosuje. Oryginał nie ma
 *    globalnych filtrów w ogóle (te są odstępstwem O-10a-2 z 10a), więc i tego problemu.
 */
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent } from "@/components/ui/card";
import {
  GRUBOSC_SLUPKA,
  KOLOR_ETYKIET,
  KOLOR_SERII,
  KOLOR_SIATKI,
  KontenerWykresu,
  PROMIEN_SLUPKA,
  PROMIEN_SLUPKA_PIONOWEGO,
  TrescTooltipa,
} from "@/components/ui/chart";

import type {
  WierszPokryciaEan,
  WierszPorownaniaEan,
  WierszRankinguEan,
  WierszUnikalnegoEan,
} from "./api";
import {
  ETYKIETY_WYMIAROW,
  WYMIARY_EAN_POKRYCIE,
  WYMIARY_EAN_PORWNANIE,
  WYMIARY_EAN_RANKING,
  WYMIARY_EAN_UNIKALNE,
  wymiaryNieobslugiwane,
  zastosujFiltryDostawcow,
  type WymiarFiltra,
  type WyborFiltrow,
} from "./filtrowanie";
import { formatuj, formatujProcent, zaokraglij } from "./formatowanie";
import { TabelaAnalityki, type KolumnaTabeli } from "./TabelaAnalityki";

/**
 * Ilu dostawców trafia na wykres rankingu. W produkcji jest ich kilkanaście, więc limit
 * praktycznie nigdy nie tnie — jest po to, żeby przyszły katalog z setką dostawców nie
 * zamienił wykresu w grzebień. Reszta i tak jest w tabeli obok.
 */
const DOSTAWCOW_NA_WYKRESIE = 15;

/** Siedem kolumn karty „2.1-2.4" (`:28195-28218`). */
const KOLUMNY_PORWNANIA: KolumnaTabeli<WierszPorownaniaEan>[] = [
  { key: "ean", label: "EAN", mono: true },
  { key: "nazwa", label: "Nazwa" },
  { key: "dostawcy", label: "Dostawcy", right: true },
  { key: "cenaMin", label: "Min", right: true },
  { key: "cenaMax", label: "Max", right: true },
  { key: "spreadZl", label: "Spread zł", right: true },
  { key: "spreadPct", label: "Spread %", right: true },
];

/** Pięć kolumn karty „2.5" (`:28236-28252`). */
const KOLUMNY_UNIKALNYCH: KolumnaTabeli<WierszUnikalnegoEan>[] = [
  { key: "ean", label: "EAN", mono: true },
  { key: "nazwa", label: "Nazwa" },
  { key: "dostawca", label: "Dostawca", mono: true },
  { key: "cenaZakupu", label: "Cena", right: true },
  { key: "stan", label: "Stan", right: true },
];

/** Lewa tabela karty „2.6" (`:28261-28269`). */
const KOLUMNY_POKRYCIA: KolumnaTabeli<WierszPokryciaEan>[] = [
  { key: "liczbaDostawcow", label: "Liczba dostawców", right: true },
  { key: "liczbaEAN", label: "EAN", right: true },
];

/** Prawa tabela karty „2.6" (`:28270-28284`). */
const KOLUMNY_RANKINGU: KolumnaTabeli<WierszRankinguEan>[] = [
  { key: "dostawca", label: "Dostawca", mono: true },
  { key: "wspolnePozycje", label: "Wspólne", right: true },
  { key: "najtanszy", label: "Najtańszy", right: true },
  { key: "najtanszyPct", label: "Najtańszy %", right: true },
];

/** Notka o wymiarach filtra, na które dana karta nie ma jak odpowiedzieć (O-10c-2). */
function NotkaPominietych({
  wybor,
  obslugiwane,
  powod,
  testId,
}: {
  wybor: WyborFiltrow;
  obslugiwane: WymiarFiltra[];
  powod: string;
  testId: string;
}) {
  const pominiete = wymiaryNieobslugiwane(wybor, obslugiwane);
  if (pominiete.length === 0) return null;

  return (
    <div className="mt-1 text-xs text-muted-foreground" data-testid={testId}>
      {powod} {pominiete.map((w) => ETYKIETY_WYMIAROW[w]).join(", ")}.
    </div>
  );
}

/** Wspólny nagłówek karty — w oryginale to `px-4 py-3 border-b` z tytułem `font-semibold text-sm`. */
function NaglowekKarty({ tytul, children }: { tytul: string; children?: React.ReactNode }) {
  return (
    <div className="border-b px-4 py-3">
      <div className="text-sm font-semibold">{tytul}</div>
      {children}
    </div>
  );
}

/**
 * Wynik jednego zapytania razem z jego WŁASNYM stanem ładowania.
 *
 * ⚠ Cztery zapytania tej zakładki lecą niezależnie, więc jeden wspólny `ladowanie` kłamałby:
 * tabela, która ma już dane, pokazywałaby „Wczytywanie…", albo — gorzej — tabela wciąż
 * czekająca na odpowiedź pokazywałaby „Brak danych". `SekcjaMarze` (10a) ma jedno zapytanie
 * i tam pojedyncza flaga wystarcza; tutaj każda karta odpowiada za siebie.
 */
type Zapytanie<T> = { dane: { rows: T[] } | null | undefined; ladowanie: boolean };

type PunktPokrycia = { podpis: string; liczbaDostawcow: number; liczbaEAN: number };
type PunktRankingu = { dostawca: string; najtanszyPct: number; wspolnePozycje: number; najtanszy: number };

/** Tekst pustej tabeli — rozstrzyga stan JEJ zapytania, nie zakładki jako całości. */
function tekstPusty(ladowanie: boolean): string {
  return ladowanie ? "Wczytywanie…" : "Brak danych";
}

export function SekcjaEan({
  porownanie,
  unikalne,
  pokrycie,
  ranking,
  wybor,
}: {
  porownanie: Zapytanie<WierszPorownaniaEan>;
  unikalne: Zapytanie<WierszUnikalnegoEan>;
  pokrycie: Zapytanie<WierszPokryciaEan>;
  ranking: Zapytanie<WierszRankinguEan>;
  wybor: WyborFiltrow;
}) {
  const wierszePorownania = porownanie.dane?.rows ?? [];
  // Stabilna referencja — `?? []` tworzyłby nową pustą tablicę przy każdym renderze
  // i unieważniał oba `useMemo` niżej.
  const wierszePokrycia = useMemo(() => pokrycie.dane?.rows ?? [], [pokrycie.dane]);

  // Dwie karty niosą kolumnę `dostawca` i tylko one realnie filtrują (patrz `filtrowanie.ts`).
  const wierszeUnikalne = useMemo(
    () => zastosujFiltryDostawcow(unikalne.dane?.rows ?? [], wybor),
    [unikalne.dane, wybor],
  );
  const wierszeRankingu = useMemo(
    () => zastosujFiltryDostawcow(ranking.dane?.rows ?? [], wybor),
    [ranking.dane, wybor],
  );

  /**
   * Jedna liczba nagłówkowa zamiast wykresu — „kilka liczb nagłówkowych → kafle, nie wykres"
   * (`dataviz`, `references/choosing-a-form.md`). Udział EAN-ów, które w ogóle da się
   * porównać między dostawcami, to sedno tej karty; histogram obok mówi, jak ten udział
   * rozkłada się na 2, 3, 4… dostawców.
   */
  const udzialWspolnych = useMemo(() => {
    const wszystkie = wierszePokrycia.reduce((suma, w) => suma + w.liczbaEAN, 0);
    if (wszystkie === 0) return null;
    const wspolne = wierszePokrycia
      .filter((w) => w.liczbaDostawcow >= 2)
      .reduce((suma, w) => suma + w.liczbaEAN, 0);
    return { wszystkie, wspolne, procent: zaokraglij((wspolne / wszystkie) * 100) };
  }, [wierszePokrycia]);

  const punktyPokrycia = useMemo<PunktPokrycia[]>(
    () =>
      wierszePokrycia.map((w) => ({
        podpis: String(w.liczbaDostawcow),
        liczbaDostawcow: w.liczbaDostawcow,
        liczbaEAN: w.liczbaEAN,
      })),
    [wierszePokrycia],
  );

  /**
   * Ranking przychodzi z backendu posortowany `najtanszyPct DESC` (`analytics_module.cjs:232`)
   * i tego porządku nie zmieniamy — jest częścią odpowiedzi, nie decyzją widoku.
   */
  const punktyRankingu = useMemo<PunktRankingu[]>(
    () =>
      wierszeRankingu.slice(0, DOSTAWCOW_NA_WYKRESIE).map((w) => ({
        dostawca: w.dostawca,
        najtanszyPct: w.najtanszyPct,
        wspolnePozycje: w.wspolnePozycje,
        najtanszy: w.najtanszy,
      })),
    [wierszeRankingu],
  );

  /**
   * Histogram pokrycia liczy się po CAŁYM katalogu, a ranking obok niego filtr dostawcy
   * honoruje — dwie tabele w jednej karcie reagują więc różnie na to samo zaznaczenie.
   * To nie jest błąd: wiersz pokrycia (`{liczbaDostawcow, liczbaEAN}`) nie niesie nazwy
   * dostawcy i nie da się jej odtworzyć. Mówimy o tym wprost zamiast zostawiać użytkownika
   * z wrażeniem, że filtr się zaciął.
   */
  const pokrycieIgnorujeDostawce = wymiaryNieobslugiwane(wybor, WYMIARY_EAN_POKRYCIE).includes(
    "dostawcy",
  );

  const unikalneWszystkie = unikalne.dane?.rows.length ?? 0;
  const unikalneOdfiltrowane = unikalneWszystkie - wierszeUnikalne.length;

  return (
    <div className="space-y-4">
      {/* ── Karta „2.1-2.4" (`:28180-28220`) ─────────────────────────────────────────── */}
      <Card className="border-card-border">
        <CardContent className="p-0">
          <NaglowekKarty tytul="2.1-2.4 Porównanie cen po EAN">
            <NotkaPominietych
              wybor={wybor}
              obslugiwane={WYMIARY_EAN_PORWNANIE}
              powod="Ta karta grupuje po EAN-ie i nie niesie kolumn katalogu, więc nie stosuje filtrów:"
              testId="ean-porownanie-pominiete"
            />
          </NaglowekKarty>
          <TabelaAnalityki
            dane={wierszePorownania}
            kolumny={KOLUMNY_PORWNANIA}
            tekstPusty={tekstPusty(porownanie.ladowanie)}
            testId="tabela-ean-porownanie"
          />
        </CardContent>
      </Card>

      {/* ── Karta „2.5" (`:28221-28255`) ─────────────────────────────────────────────── */}
      <Card className="border-card-border">
        <CardContent className="p-0">
          <NaglowekKarty tytul="2.5 Pozycje unikalne">
            {unikalneOdfiltrowane > 0 && (
              <div className="mt-1 text-xs text-muted-foreground" data-testid="ean-unikalne-licznik-filtra">
                Filtry ukryły {formatuj(unikalneOdfiltrowane)} z {formatuj(unikalneWszystkie)} pozycji.
              </div>
            )}
            <NotkaPominietych
              wybor={wybor}
              obslugiwane={WYMIARY_EAN_UNIKALNE}
              powod="Wiersz niesie tylko dostawcę, więc ta karta nie stosuje filtrów:"
              testId="ean-unikalne-pominiete"
            />
          </NaglowekKarty>
          <TabelaAnalityki
            dane={wierszeUnikalne}
            kolumny={KOLUMNY_UNIKALNYCH}
            tekstPusty={tekstPusty(unikalne.ladowanie)}
            testId="tabela-ean-unikalne"
          />
        </CardContent>
      </Card>

      {/* ── Karta „2.6" — JEDNA karta, DWIE tabele w gridzie (`:28256-28288`) ────────── */}
      <Card className="border-card-border">
        <CardContent className="p-0">
          <NaglowekKarty tytul="2.6 Pokrycie wspólne i ranking dostawcy">
            <NotkaPominietych
              wybor={wybor}
              obslugiwane={WYMIARY_EAN_RANKING}
              powod="Ranking niesie tylko dostawcę, a histogram pokrycia same liczby, więc ta karta nie stosuje filtrów:"
              testId="ean-pokrycie-pominiete"
            />
          </NaglowekKarty>

          <div className="grid gap-4 p-4 md:grid-cols-2">
            {/* ── Pokrycie: liczba nagłówkowa + histogram + tabela ───────────────────── */}
            <div>
              {pokrycieIgnorujeDostawce && (
                <div
                  className="mb-3 text-xs text-muted-foreground"
                  data-testid="ean-pokrycie-ignoruje-dostawce"
                >
                  Histogram pokrycia liczy się po wszystkich dostawcach — filtr dostawcy go nie
                  zawęża, bo wiersz nie niesie ich nazw.
                </div>
              )}

              {udzialWspolnych && (
                <div className="mb-3" data-testid="ean-udzial-wspolnych">
                  <div className="text-xs text-muted-foreground">EAN-y u co najmniej dwóch dostawców</div>
                  <div className="font-mono text-2xl font-semibold">
                    {formatujProcent(udzialWspolnych.procent)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatuj(udzialWspolnych.wspolne)} z {formatuj(udzialWspolnych.wszystkie)} EAN-ów
                  </div>
                </div>
              )}

              {/*
                FORMA: rozkład liczby po uporządkowanych kubełkach (1, 2, 3… dostawców)
                → histogram, czyli słupek PIONOWY. Jedna seria, więc bez legendy — tytuł
                nad wykresem nazywa, co jest rysowane. Wartości wypisane nad słupkami:
                to razem z tabelą pod spodem zdejmuje ostrzeżenie walidatora o kontraście
                `--chart-1` do tła (2.61 < 3:1).
              */}
              {punktyPokrycia.length > 0 && (
                <div className="mb-3">
                  <div className="mb-2 text-xs text-muted-foreground">
                    Rozkład: ile EAN-ów mają grupy o danej liczbie dostawców
                  </div>
                  <KontenerWykresu
                    wysokosc={200}
                    opis={`Histogram: liczba EAN-ów w podziale na liczbę dostawców, ${punktyPokrycia.length} słupków. Te same liczby są w tabeli poniżej.`}
                  >
                    <BarChart data={punktyPokrycia} margin={{ top: 20, right: 8, bottom: 0, left: 8 }}>
                      <CartesianGrid vertical={false} stroke={KOLOR_SIATKI} strokeWidth={1} />
                      <XAxis
                        dataKey="podpis"
                        tick={{ fill: KOLOR_ETYKIET, fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: KOLOR_SIATKI }}
                      />
                      <YAxis
                        tick={{ fill: KOLOR_ETYKIET, fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        width={48}
                      />
                      <Tooltip
                        cursor={{ fill: KOLOR_SIATKI, fillOpacity: 0.25 }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const punkt = payload[0]?.payload as PunktPokrycia | undefined;
                          if (!punkt) return null;
                          return (
                            <TrescTooltipa
                              tytul={`${formatuj(punkt.liczbaDostawcow)} dostawc${punkt.liczbaDostawcow === 1 ? "a" : "ów"}`}
                              pozycje={[
                                {
                                  nazwa: "EAN-y",
                                  wartosc: formatuj(punkt.liczbaEAN),
                                  kolor: KOLOR_SERII,
                                },
                              ]}
                            />
                          );
                        }}
                      />
                      <Bar
                        dataKey="liczbaEAN"
                        fill={KOLOR_SERII}
                        barSize={GRUBOSC_SLUPKA}
                        radius={PROMIEN_SLUPKA_PIONOWEGO}
                        isAnimationActive={false}
                      >
                        <LabelList
                          dataKey="liczbaEAN"
                          position="top"
                          fill={KOLOR_ETYKIET}
                          fontSize={11}
                          formatter={(v: unknown) => formatuj(v)}
                        />
                      </Bar>
                    </BarChart>
                  </KontenerWykresu>
                </div>
              )}

              <TabelaAnalityki
                dane={wierszePokrycia}
                kolumny={KOLUMNY_POKRYCIA}
                tekstPusty={tekstPusty(pokrycie.ladowanie)}
                testId="tabela-ean-pokrycie"
              />
            </div>

            {/* ── Ranking: słupek poziomy + tabela ───────────────────────────────────── */}
            <div>
              {/*
                FORMA: porównanie wielkości między nazwanymi bytami → słupek POZIOMY,
                bo etykietą jest nazwa dostawcy, a nie punkt na skali. Kolor należy do
                serii, nie do pozycji w rankingu — filtr po dostawcy nie przemalowuje
                ocalałych słupków.
              */}
              {punktyRankingu.length > 0 && (
                <div className="mb-3">
                  <div className="mb-2 text-xs text-muted-foreground">
                    Jak często dostawca ma najniższą cenę
                  </div>
                  <KontenerWykresu
                    wysokosc={Math.max(160, punktyRankingu.length * 26 + 40)}
                    opis={`Wykres słupkowy: udział pozycji, w których dostawca jest najtańszy, dla ${punktyRankingu.length} dostawców. Te same liczby są w tabeli poniżej.`}
                  >
                    <BarChart
                      data={punktyRankingu}
                      layout="vertical"
                      margin={{ top: 0, right: 56, bottom: 0, left: 8 }}
                      barCategoryGap={2}
                    >
                      <CartesianGrid horizontal={false} stroke={KOLOR_SIATKI} strokeWidth={1} />
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        tick={{ fill: KOLOR_ETYKIET, fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: KOLOR_SIATKI }}
                        unit="%"
                      />
                      <YAxis
                        type="category"
                        dataKey="dostawca"
                        width={72}
                        tick={{ fill: KOLOR_ETYKIET, fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: KOLOR_SIATKI, fillOpacity: 0.25 }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const punkt = payload[0]?.payload as PunktRankingu | undefined;
                          if (!punkt) return null;
                          return (
                            <TrescTooltipa
                              tytul={punkt.dostawca}
                              pozycje={[
                                {
                                  nazwa: "Najtańszy %",
                                  wartosc: formatujProcent(punkt.najtanszyPct),
                                  kolor: KOLOR_SERII,
                                },
                                { nazwa: "Najtańszy", wartosc: formatuj(punkt.najtanszy) },
                                { nazwa: "Wspólne", wartosc: formatuj(punkt.wspolnePozycje) },
                              ]}
                            />
                          );
                        }}
                      />
                      <Bar
                        dataKey="najtanszyPct"
                        fill={KOLOR_SERII}
                        barSize={GRUBOSC_SLUPKA}
                        radius={PROMIEN_SLUPKA}
                        isAnimationActive={false}
                      >
                        <LabelList
                          dataKey="najtanszyPct"
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
                dane={wierszeRankingu}
                kolumny={KOLUMNY_RANKINGU}
                tekstPusty={tekstPusty(ranking.ladowanie)}
                testId="tabela-ean-ranking"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
