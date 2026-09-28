/**
 * Karta „4.4 Sezonowy wzorzec cen" — trzecia karta zakładki „Dostępność"
 * (port `deminified/frontend-index.js:28489-28513`).
 *
 * Cztery kolumny 1:1 z oryginałem. Oryginał nie daje tej karcie przycisku „CSV" — my też nie.
 *
 * ⚠ WYKRES JEST ODSTĘPSTWEM (O-10e-1, decyzja użytkownika D3 z 2026-09-03), kontynuacją
 * O-10a-3: oryginał nie ma ani jednego wykresu. Wybór formy wynika z zadania, nie z gustu
 * (skill `dataviz`, `references/choosing-a-form.md`): „zmiana w czasie" → LINIA.
 *
 * ⚠ DLACZEGO JEDNA SERIA, A NIE LINIA NA MARKĘ. Odpowiedź grupuje po miesiącu ORAZ marce,
 * więc marek bywa kilkadziesiąt (fixture: 172 wiersze). Reguła z `components/ui/chart.tsx`
 * mówi: maksymalnie cztery serie, a kolor należy do BYTU, nie do rankingu — linia „top 4
 * marki" przemalowywałaby ocalałe serie przy każdej zmianie filtra. Zamiast tego wykres
 * odpowiada na jedno pytanie („jak średnia cena zmienia się w cyklu roku"), a pełny podział
 * na marki pokazuje tabela pod nim. Jedna seria → BEZ legendy, tytuł już nazywa, co rysujemy.
 *
 * ⚠ MIESIĄC JEST BEZ ROKU. Backend wycina sam numer miesiąca (`substr(zarejestrowano_at, 6, 2)`),
 * więc sierpień 2025 i sierpień 2026 to jeden punkt — o to właśnie chodzi we „wzorcu
 * sezonowym". Oś pokazuje surowe numery, tak jak surowe pokazuje je tabela oryginału.
 */
import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent } from "@/components/ui/card";
import {
  KOLOR_ETYKIET,
  KOLOR_SERII,
  KOLOR_SIATKI,
  KontenerWykresu,
  TrescTooltipa,
} from "@/components/ui/chart";

import type { Sezonowosc, WierszSezonowosci } from "./api";
import {
  zastosujFiltry,
  wymiaryNieobslugiwane,
  wymiaryZMapowania,
  type MapowanieWymiarow,
  type WyborFiltrow,
} from "./filtrowanie";
import { formatuj } from "./formatowanie";
import { NaglowekSekcji } from "./NaglowekSekcji";
import { TabelaAnalityki, type KolumnaTabeli } from "./TabelaAnalityki";

/** Wiersz niesie tylko markę — miesiąc nie jest wymiarem filtra katalogu. */
const MAPOWANIE: MapowanieWymiarow<WierszSezonowosci> = { marki: (w) => w.marka };

const KOLUMNY: KolumnaTabeli<WierszSezonowosci>[] = [
  { key: "miesiac", label: "Miesiąc", mono: true },
  { key: "marka", label: "Marka" },
  { key: "sredniaCena", label: "Śr. cena", right: true },
  { key: "dostepnoscPct", label: "Dostępność", right: true },
];

/** Linia potrzebuje co najmniej dwóch punktów — przy jednym miesiącu rysujemy samą tabelę. */
const MINIMUM_PUNKTOW = 2;

type PunktWykresu = { miesiac: string; sredniaCena: number; marek: number };

/**
 * Zwija wiersze „miesiąc × marka" do jednego punktu na miesiąc.
 *
 * Średnia jest NIEWAŻONA — po jednej wartości na markę, tak jak w tabeli. Ważenie liczbą
 * produktów byłoby inną miarą niż ta, którą pokazuje tabela pod wykresem, a wykres i tabela
 * muszą mówić o tych samych liczbach.
 */
export function punktyMiesieczne(wiersze: WierszSezonowosci[]): PunktWykresu[] {
  const wgMiesiaca = new Map<string, number[]>();
  for (const wiersz of wiersze) {
    if (wiersz.sredniaCena === null) continue;
    const zebrane = wgMiesiaca.get(wiersz.miesiac) ?? [];
    zebrane.push(wiersz.sredniaCena);
    wgMiesiaca.set(wiersz.miesiac, zebrane);
  }

  return [...wgMiesiaca.entries()]
    .map(([miesiac, ceny]) => ({
      miesiac,
      sredniaCena: Math.round((ceny.reduce((a, b) => a + b, 0) / ceny.length) * 100) / 100,
      marek: ceny.length,
    }))
    .sort((a, b) => a.miesiac.localeCompare(b.miesiac));
}

export function SekcjaSezonowosci({
  dane,
  wybor,
  ladowanie,
}: {
  dane: Sezonowosc | null | undefined;
  wybor: WyborFiltrow;
  ladowanie: boolean;
}) {
  const wiersze = useMemo(
    () => zastosujFiltry(dane?.rows ?? [], wybor, MAPOWANIE),
    [dane, wybor],
  );

  const punkty = useMemo(() => punktyMiesieczne(wiersze), [wiersze]);

  return (
    <Card className="border-card-border">
      <CardContent className="p-0">
        <NaglowekSekcji
          tytul="4.4 Sezonowy wzorzec cen"
          wszystkie={dane?.rows.length ?? 0}
          widoczne={wiersze.length}
          pominiete={wymiaryNieobslugiwane(wybor, wymiaryZMapowania(MAPOWANIE))}
          wyjasnieniePominietych="Ta sekcja grupuje po miesiącu i marce, więc nie stosuje filtrów:"
          rzeczownik="wierszy"
          prefiksTestu="sezonowosc"
        />

        {punkty.length >= MINIMUM_PUNKTOW && (
          <div className="border-b px-4 py-4" data-testid="wykres-sezonowosc">
            <div className="mb-2 text-xs text-muted-foreground">
              Średnia cena zakupu wg miesiąca (wszystkie marki razem)
            </div>
            <KontenerWykresu
              wysokosc={260}
              opis={`Wykres liniowy: średnia cena zakupu w ${punkty.length} miesiącach. Te same liczby, w podziale na marki, są w tabeli poniżej.`}
            >
              <LineChart data={punkty} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid vertical={false} stroke={KOLOR_SIATKI} strokeWidth={1} />
                <XAxis
                  dataKey="miesiac"
                  tick={{ fill: KOLOR_ETYKIET, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: KOLOR_SIATKI }}
                />
                <YAxis
                  tick={{ fill: KOLOR_ETYKIET, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={72}
                />
                <Tooltip
                  cursor={{ stroke: KOLOR_SIATKI, strokeWidth: 1 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const punkt = payload[0]?.payload as PunktWykresu | undefined;
                    if (!punkt) return null;
                    return (
                      <TrescTooltipa
                        tytul={`Miesiąc ${punkt.miesiac}`}
                        pozycje={[
                          {
                            nazwa: "Śr. cena",
                            wartosc: formatuj(punkt.sredniaCena),
                            kolor: KOLOR_SERII,
                          },
                          { nazwa: "Marek w średniej", wartosc: formatuj(punkt.marek) },
                        ]}
                      />
                    );
                  }}
                />
                {/* Jedna seria: bez legendy, marker 8 px (r=4), linia 2 px — spec `dataviz`. */}
                <Line
                  type="monotone"
                  dataKey="sredniaCena"
                  stroke={KOLOR_SERII}
                  strokeWidth={2}
                  dot={{ r: 4, fill: KOLOR_SERII, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </KontenerWykresu>
          </div>
        )}

        <TabelaAnalityki
          dane={wiersze}
          kolumny={KOLUMNY}
          tekstPusty={ladowanie ? "Wczytywanie…" : "Brak danych"}
          testId="tabela-sezonowosc"
        />
      </CardContent>
    </Card>
  );
}
