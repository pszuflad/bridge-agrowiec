/**
 * Globalny pasek filtrów analityki — sześć wyszukiwalnych kontrolek wielokrotnego wyboru.
 *
 * ⚠ ODSTĘPSTWO ŚWIADOME (O-10a-2, decyzja D1/D2 użytkownika z 2026-09-03). Oryginał
 * (`deminified/frontend-index.js:27804-28640`) POBIERA `/api/analytics/filters`, ale
 * renderuje z niego wyłącznie `f.dostawcy.length` w kaflu KPI (`:27946`) — pozostałych
 * pięciu list nie wyświetla nigdzie. Paska filtrów w tym widoku po prostu nie ma.
 *
 * Filtry są WSPÓLNE dla wszystkich zakładek: stan mieszka w `Analityka.tsx` i schodzi
 * do sekcji przez propsy. Sekcja stosuje z nich tyle, ile potrafi (jej wiersze nie muszą
 * nieść wszystkich sześciu wymiarów) i mówi wprost, które zignorowała — patrz
 * `filtrowanie.ts`, `wymiaryNieobslugiwane`.
 *
 * Wyszukiwarka nie jest ozdobą: `modele` i `rozmiary` przychodzą po 1000 pozycji,
 * `indeksyNosnosci` po 300 (limity SQL z `analytics_module.cjs:98-107`, do których
 * produkcja realnie dobija).
 */
import { Button } from "@/components/ui/button";
import { WyborZWyszukiwarka } from "@/components/WyborZWyszukiwarka";

import type { Filtry } from "./api";
import {
  czyPusty,
  pustyWybor,
  WYMIARY_FILTRA,
  type WymiarFiltra,
  type WyborFiltrow,
} from "./filtrowanie";

/** Teksty kontrolek — po jednym komplecie na wymiar, żeby liczba mnoga się zgadzała. */
const TEKSTY: Record<
  WymiarFiltra,
  { etykieta: string; pusty: string; szukaj: string; licznik: (n: number) => string }
> = {
  dostawcy: {
    etykieta: "Dostawcy",
    pusty: "Wszyscy dostawcy",
    szukaj: "Szukaj dostawcy…",
    licznik: (n) => `${n} dostawców`,
  },
  marki: {
    etykieta: "Marki",
    pusty: "Wszystkie marki",
    szukaj: "Szukaj marki…",
    licznik: (n) => `${n} marek`,
  },
  modele: {
    etykieta: "Modele",
    pusty: "Wszystkie modele",
    szukaj: "Szukaj modelu…",
    licznik: (n) => `${n} modeli`,
  },
  rozmiary: {
    etykieta: "Rozmiary",
    pusty: "Wszystkie rozmiary",
    szukaj: "Szukaj rozmiaru…",
    licznik: (n) => `${n} rozmiarów`,
  },
  indeksyNosnosci: {
    etykieta: "Indeksy nośności",
    pusty: "Wszystkie indeksy nośności",
    szukaj: "Szukaj indeksu…",
    licznik: (n) => `${n} indeksów nośności`,
  },
  indeksyPredkosci: {
    etykieta: "Indeksy prędkości",
    pusty: "Wszystkie indeksy prędkości",
    szukaj: "Szukaj indeksu…",
    licznik: (n) => `${n} indeksów prędkości`,
  },
};

export function FiltryGlobalne({
  filtry,
  wybor,
  onZmiana,
}: {
  filtry: Filtry | null | undefined;
  wybor: WyborFiltrow;
  onZmiana: (nowy: WyborFiltrow) => void;
}) {
  const ustawWymiar = (wymiar: WymiarFiltra, wartosci: Set<string>): void => {
    onZmiana({ ...wybor, [wymiar]: wartosci });
  };

  return (
    <div className="mb-4" data-testid="filtry-globalne">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Filtry globalne — obowiązują we wszystkich zakładkach
        </span>
        {!czyPusty(wybor) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onZmiana(pustyWybor())}
            data-testid="filtry-wyczysc"
          >
            Wyczyść filtry
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
        {WYMIARY_FILTRA.map((wymiar) => (
          <WyborZWyszukiwarka
            key={wymiar}
            etykieta={TEKSTY[wymiar].etykieta}
            opcje={(filtry?.[wymiar] ?? []).map((p) => p.value)}
            wybrane={wybor[wymiar]}
            onZmiana={(nowe) => ustawWymiar(wymiar, nowe)}
            tekstPusty={TEKSTY[wymiar].pusty}
            formatujLicznik={TEKSTY[wymiar].licznik}
            tekstSzukania={TEKSTY[wymiar].szukaj}
            testId={`filtr-${wymiar}`}
          />
        ))}
      </div>
    </div>
  );
}
