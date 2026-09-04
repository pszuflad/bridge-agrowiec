/**
 * Zakładka „Ceny w czasie" — blok 10b.
 *
 * Port trzech kart z `deminified/frontend-index.js:28295-28416`, w kolejności oryginału:
 * „3.1 Zmiany cen z ostatnich importów", „3.2 / 3.3 Historia ceny wybranej opony",
 * „3.6 Inflacja cennika". Tytuły kart, etykiety kolumn, wyrównania i krój monospace
 * przepisane 1:1; wzorcem układu jest `SekcjaMarze.tsx` z bloku 10a.
 *
 * ─── CZEGO TU CELOWO NIE MA ───────────────────────────────────────────────────────────
 *
 *  • KART DLA `top-zmiany` I `market/group-prices`. Backend dowozi obie trasy (są
 *    w kontrakcie i mają fixtures), UI ich nie tyka — decyzje D1 i D2 użytkownika
 *    z 2026-09-03. Powód jest ten sam w obu przypadkach: oryginał ich nie renderuje.
 *    `top-zmiany` ma ZERO wywołań w całym bundlu produkcji, a `market/group-prices` jest
 *    wołana przy każdym wejściu z `group=marka` na sztywno (`:27856`), po czym jej wynik
 *    nie jest użyty ani razu — martwy fetch, i nawet selektora grupy nie ma w UI.
 *    Dorobienie im karty byłoby budowaniem nowej funkcjonalności, nie odbudową.
 *
 *  • RENDEROWANIA `stats` (`{min, max, avg}`) z `prices/product-history`. Backend je zwraca,
 *    bo tak wygląda odpowiedź produkcji, ale oryginalny widok ich nie pokazuje — dokładnie
 *    jak `margins.low`/`high` w 10a (decyzja D4).
 *
 * Przycisk „CSV" przy karcie „3.1" (`M("prices-last")`, `:28310`) dołożył blok 10f.
 *
 * ─── ŚWIADOME ODSTĘPSTWA ──────────────────────────────────────────────────────────────
 *
 *  • O-10b-1 — debounce 300 ms na polach EAN/Kod (`useOpoznionaWartosc.ts`).
 *  • O-10b-2 — wykres liniowy nad tabelą inflacji; oryginał nie ma żadnych wykresów
 *    (rozszerzenie O-10a-3, infrastruktura z `components/ui/chart.tsx`).
 */
import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent } from "@/components/ui/card";
import {
  KOLORY_WYKRESU,
  KOLOR_ETYKIET,
  KOLOR_SERII,
  KOLOR_SIATKI,
  KontenerWykresu,
  MAX_SERII,
  TrescTooltipa,
} from "@/components/ui/chart";
import { Input } from "@/components/ui/input";

import {
  useHistoriaCenyProduktu,
  useInflacjaCen,
  useZmianyCenOstatniegoImportu,
  type WierszHistoriiCeny,
  type WierszInflacji,
  type WierszZmianyCeny,
} from "./api";
import {
  ETYKIETY_WYMIAROW,
  WYMIARY_CEN,
  wymiaryNieobslugiwane,
  zastosujFiltryDostawcow,
  type WyborFiltrow,
} from "./filtrowanie";
import { formatuj } from "./formatowanie";
import { TabelaAnalityki, type KolumnaTabeli } from "./TabelaAnalityki";
import { useOpoznionaWartosc } from "./useOpoznionaWartosc";
import { PrzyciskCsv } from "./eksport";

/** Kolumny karty „3.1" — 1:1 z `:28315-28340`. */
const KOLUMNY_OSTATNI_IMPORT: KolumnaTabeli<WierszZmianyCeny>[] = [
  { key: "utworzono", label: "Data", mono: true },
  { key: "dostawca", label: "Dostawca", mono: true },
  { key: "kod", label: "Kod", mono: true },
  { key: "nazwa", label: "Nazwa" },
  { key: "cenaStara", label: "Było", right: true },
  { key: "cenaNowa", label: "Jest", right: true },
  { key: "zmianaPct", label: "Zmiana %", right: true },
];

/**
 * Kolumny karty „3.2 / 3.3" — 1:1 z `:28362-28385`.
 *
 * ⚠ BRAK KOLUMNY „EAN", MIMO ŻE SQL JĄ ZWRACA. Oryginał wybiera sześć kolumn i EAN-a wśród
 * nich nie ma, choć `prices/product-history` oddaje go w każdym wierszu (`:257`). To nie
 * jest przeoczenie portu — pole zostaje w typie i w odpowiedzi, po prostu nie ma go w tabeli.
 */
const KOLUMNY_HISTORII: KolumnaTabeli<WierszHistoriiCeny>[] = [
  { key: "data", label: "Data", mono: true },
  { key: "dostawca", label: "Dostawca", mono: true },
  { key: "kod", label: "Kod", mono: true },
  { key: "cenaZakupu", label: "Cena zakupu", right: true },
  { key: "cenaSprzedazy", label: "Cena sprzedaży", right: true },
  { key: "stan", label: "Stan", right: true },
];

/** Kolumny karty „3.6" — 1:1 z `:28396-28412`. */
const KOLUMNY_INFLACJI: KolumnaTabeli<WierszInflacji>[] = [
  { key: "miesiac", label: "Miesiąc", mono: true },
  { key: "dostawca", label: "Dostawca", mono: true },
  { key: "sredniaCena", label: "Śr. cena", right: true },
  { key: "inflacjaPct", label: "Zmiana %", right: true },
];

type PunktMiesiaca = { miesiac: string } & Record<string, number | string>;

/**
 * Ile różnych miesięcy musi być w danych, żeby wykres liniowy miał sens.
 *
 * Poniżej tego progu nie ma szeregu czasowego, tylko porównanie kilku wielkości w jednym
 * punkcie — a linia przez jeden punkt to anty-wzorzec, nie wykres (skill `dataviz`,
 * `references/choosing-a-form.md`: „forma z zadania, nie z upodobania"). Wtedy karta
 * pokazuje samą tabelę, tak jak wygląda cały oryginał.
 */
const MIN_MIESIECY_NA_WYKRESIE = 2;

/**
 * Którzy dostawcy trafiają na wykres — liczeni z danych **NIEFILTROWANYCH**.
 *
 * ⚠ TO NIE JEST DETAL IMPLEMENTACYJNY, TYLKO REGUŁA Z `dataviz`: kolor należy do BYTU,
 * nie do pozycji w rankingu. Gdyby zestaw serii liczył się z wierszy PO filtrze, odznaczenie
 * jednego dostawcy przesunęłoby pozostałych o slot i przemalowało linie, które nie zniknęły.
 * Licząc go raz, z całej odpowiedzi, mamy stałe przypisanie: filtr może serię ukryć,
 * ale nigdy jej nie przefarbuje.
 *
 * Kryterium to liczba punktów historii (najdłuższy szereg rysuje się najsensowniej),
 * remisy rozstrzyga alfabet, żeby wynik nie zależał od kolejności wierszy w odpowiedzi.
 * Górny limit to `MAX_SERII` — piąta linia i dalsze zostają w tabeli pod wykresem.
 */
function dostawcyNaWykres(wszystkie: WierszInflacji[]): string[] {
  const punkty = new Map<string, number>();
  for (const w of wszystkie) {
    if (w.sredniaCena === null) continue;
    punkty.set(w.dostawca, (punkty.get(w.dostawca) ?? 0) + 1);
  }

  return [...punkty.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pl"))
    .slice(0, MAX_SERII)
    .map(([dostawca]) => dostawca);
}

/**
 * Slot palety dla serii o danej pozycji w stałym zestawie `serie`.
 *
 * Kolejność sięgania po sloty (1 → 2 → 4 → 3 → 5) siedzi już w `KOLORY_WYKRESU`, więc tu
 * wystarczy indeks. Gałąź zapasowa jest dla typu, nie dla logiki: `serieWidoczne` jest
 * zawsze podzbiorem `serie`, a długość `serie` ogranicza `MAX_SERII`.
 */
function kolorSerii(pozycja: number): string {
  return KOLORY_WYKRESU[pozycja] ?? KOLOR_SERII;
}

/** Wiersze `{dostawca, miesiac, …}` → punkty `{miesiac, [dostawca]: cena}`, rosnąco po miesiącu. */
function punktyWykresu(wiersze: WierszInflacji[], serie: string[]): PunktMiesiaca[] {
  const miesiace = new Map<string, PunktMiesiaca>();

  for (const w of wiersze) {
    if (w.sredniaCena === null || !serie.includes(w.dostawca)) continue;
    const punkt = miesiace.get(w.miesiac) ?? { miesiac: w.miesiac };
    punkt[w.dostawca] = w.sredniaCena;
    miesiace.set(w.miesiac, punkt);
  }

  // Backend sortuje `miesiac DESC` (najnowsze pierwsze) — oś czasu potrzebuje odwrotnie.
  return [...miesiace.values()].sort((a, b) => a.miesiac.localeCompare(b.miesiac));
}

function KartaCen({
  tytul,
  children,
  notka,
  obok,
}: {
  tytul: string;
  children: React.ReactNode;
  notka?: React.ReactNode;
  /** Akcje po prawej stronie tytułu — blok 10f wstawia tu przycisk „CSV". */
  obok?: React.ReactNode;
}) {
  return (
    <Card className="border-card-border">
      <CardContent className="p-0">
        <div className="border-b px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">{tytul}</div>
            {obok}
          </div>
          {notka}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

/** Notka o filtrach, których dana karta nie ma jak zastosować — wzorzec z `SekcjaMarze`. */
function NotkaFiltrow({
  odfiltrowane,
  wszystkie,
  pominiete,
  testId,
}: {
  odfiltrowane: number;
  wszystkie: number;
  pominiete: string[];
  testId: string;
}) {
  if (odfiltrowane <= 0 && pominiete.length === 0) return null;

  return (
    <>
      {odfiltrowane > 0 && (
        <div className="mt-1 text-xs text-muted-foreground" data-testid={`${testId}-licznik`}>
          Filtry ukryły {formatuj(odfiltrowane)} z {formatuj(wszystkie)} wierszy.
        </div>
      )}
      {pominiete.length > 0 && (
        <div className="mt-1 text-xs text-muted-foreground" data-testid={`${testId}-pominiete`}>
          Ta karta zna tylko dostawcę, więc nie stosuje filtrów: {pominiete.join(", ")}.
        </div>
      )}
    </>
  );
}

export function SekcjaCeny({ wybor }: { wybor: WyborFiltrow }) {
  const { data: ostatniImport, isPending: ostatniImportWczytywany } =
    useZmianyCenOstatniegoImportu();
  const { data: inflacja, isPending: inflacjaWczytywana } = useInflacjaCen();

  // Pola karty „3.2 / 3.3". Stan jest natychmiastowy (pole musi reagować na klawisz),
  // do zapytania idzie wartość opóźniona — O-10b-1.
  const [ean, ustawEan] = useState("");
  const [kod, ustawKod] = useState("");
  const eanZapytania = useOpoznionaWartosc(ean);
  const kodZapytania = useOpoznionaWartosc(kod);
  const { data: historia } = useHistoriaCenyProduktu(eanZapytania, kodZapytania);

  const nazwyPominietych = useMemo(
    () => wymiaryNieobslugiwane(wybor, WYMIARY_CEN).map((w) => ETYKIETY_WYMIAROW[w]),
    [wybor],
  );

  const wierszeImportu = useMemo(
    () => zastosujFiltryDostawcow(ostatniImport?.rows ?? [], wybor),
    [ostatniImport, wybor],
  );
  const wierszeInflacji = useMemo(
    () => zastosujFiltryDostawcow(inflacja?.rows ?? [], wybor),
    [inflacja, wybor],
  );

  // Zestaw serii liczony z odpowiedzi SUROWEJ — patrz nota przy `dostawcyNaWykres`.
  const serie = useMemo(() => dostawcyNaWykres(inflacja?.rows ?? []), [inflacja]);
  const punkty = useMemo(() => punktyWykresu(wierszeInflacji, serie), [wierszeInflacji, serie]);
  const serieWidoczne = useMemo(
    () => serie.filter((d) => punkty.some((p) => p[d] !== undefined)),
    [serie, punkty],
  );
  const pominietoSerie = serie.length < new Set((inflacja?.rows ?? []).map((w) => w.dostawca)).size;

  return (
    <div className="space-y-4">
      <KartaCen
        tytul="3.1 Zmiany cen z ostatnich importów"
        obok={<PrzyciskCsv widok="prices-last" />}
        notka={
          <NotkaFiltrow
            odfiltrowane={(ostatniImport?.rows.length ?? 0) - wierszeImportu.length}
            wszystkie={ostatniImport?.rows.length ?? 0}
            pominiete={nazwyPominietych}
            testId="ceny-ostatni-import"
          />
        }
      >
        <TabelaAnalityki
          dane={wierszeImportu}
          kolumny={KOLUMNY_OSTATNI_IMPORT}
          tekstPusty={ostatniImportWczytywany ? "Wczytywanie…" : "Brak danych"}
          testId="tabela-ceny-ostatni-import"
        />
      </KartaCen>

      {/*
        Jedyna karta z realnymi kontrolkami wejścia w całym oryginalnym widoku. Zapytanie
        leci dopiero, gdy KTÓREŚ z pól jest niepuste (`n || a ? … : …`, `:27871`) — przed
        wpisaniem czegokolwiek tabela stoi pusta i tak ma być.
      */}
      <Card className="border-card-border">
        <CardContent className="space-y-3 p-4">
          <div className="text-sm font-semibold">3.2 / 3.3 Historia ceny wybranej opony</div>
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="EAN"
              value={ean}
              onChange={(e) => ustawEan(e.target.value)}
              className="max-w-xs"
              aria-label="EAN"
              data-testid="input-historia-ean"
            />
            <Input
              placeholder="Kod produktu"
              value={kod}
              onChange={(e) => ustawKod(e.target.value)}
              className="max-w-xs"
              aria-label="Kod produktu"
              data-testid="input-historia-kod"
            />
            {/* Tekst z oryginału (`:28356`) — renderowany ZAWSZE, nie warunkowo. */}
            <div className="self-center text-xs text-muted-foreground">
              Wykres/tabela zapełnią się po zebraniu historii cen.
            </div>
          </div>
          <TabelaAnalityki
            dane={historia?.rows ?? []}
            kolumny={KOLUMNY_HISTORII}
            testId="tabela-ceny-historia"
          />
        </CardContent>
      </Card>

      <KartaCen
        tytul="3.6 Inflacja cennika"
        notka={
          <NotkaFiltrow
            odfiltrowane={(inflacja?.rows.length ?? 0) - wierszeInflacji.length}
            wszystkie={inflacja?.rows.length ?? 0}
            pominiete={nazwyPominietych}
            testId="ceny-inflacja"
          />
        }
      >
        {/*
          FORMA (skill `dataviz`, `references/choosing-a-form.md`): zmiana w czasie → LINIA.
          Rysujemy ŚREDNIĄ CENĘ, a nie `inflacjaPct` — te dwie miary mają różną skalę,
          a dwóch osi Y nie wolno użyć nigdy. Procent zostaje w tabeli pod wykresem,
          która i tak jest obowiązkowa (zdejmuje ostrzeżenie walidatora o kontraście
          `--chart-1` do tła). Legenda jest, bo serii bywa kilka; przy jednej znika,
          zgodnie z regułą „tytuł już nazywa, co jest rysowane".
        */}
        {punkty.length >= MIN_MIESIECY_NA_WYKRESIE && serieWidoczne.length > 0 && (
          <div className="border-b px-4 py-4">
            <div className="mb-2 text-xs text-muted-foreground" data-testid="ceny-wykres-podpis">
              Średnia cena zakupu w miesiącu — {serieWidoczne.length}{" "}
              {serieWidoczne.length === 1 ? "dostawca" : "dostawców"} o najdłuższej historii
              {pominietoSerie ? "; pozostali są w tabeli poniżej" : ""}.
            </div>
            <KontenerWykresu
              wysokosc={280}
              opis={`Wykres liniowy: średnia cena zakupu w kolejnych miesiącach dla ${serieWidoczne.length} dostawców. Te same liczby są w tabeli poniżej.`}
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
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <TrescTooltipa
                        tytul={String(label)}
                        pozycje={payload.map((p) =>
                          typeof p.color === "string"
                            ? { nazwa: String(p.name), wartosc: formatuj(p.value), kolor: p.color }
                            : { nazwa: String(p.name), wartosc: formatuj(p.value) },
                        )}
                      />
                    );
                  }}
                />
                {serieWidoczne.length > 1 && (
                  <Legend
                    wrapperStyle={{ fontSize: 11, color: KOLOR_ETYKIET }}
                    iconType="plainline"
                  />
                )}
                {serieWidoczne.map((dostawca) => (
                  <Line
                    key={dostawca}
                    type="monotone"
                    dataKey={dostawca}
                    name={dostawca}
                    // Slot koloru bierze się z pozycji w `serie` (zestaw stały, liczony
                    // z danych niefiltrowanych), a nie z pozycji w `serieWidoczne`.
                    stroke={kolorSerii(serie.indexOf(dostawca))}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </KontenerWykresu>
          </div>
        )}

        {punkty.length === 0 && serie.length > 0 && wierszeInflacji.length > 0 && (
          <div className="border-b px-4 py-3 text-xs text-muted-foreground" data-testid="ceny-wykres-brak">
            Wykres pokazuje dostawców o najdłuższej historii cen — wybrani filtrem nie są wśród
            nich. Ich dane są w tabeli poniżej.
          </div>
        )}

        <TabelaAnalityki
          dane={wierszeInflacji}
          kolumny={KOLUMNY_INFLACJI}
          tekstPusty={inflacjaWczytywana ? "Wczytywanie…" : "Brak danych"}
          testId="tabela-ceny-inflacja"
        />
      </KartaCen>
    </div>
  );
}
