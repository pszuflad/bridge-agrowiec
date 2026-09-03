/**
 * Widok `/analityka` — szkielet bloku 10a. Port `zM()`
 * (`deminified/frontend-index.js:27804-28640`).
 *
 * ─── CO JEST 1:1 Z ORYGINAŁEM ─────────────────────────────────────────────────────────
 *  • tytuł i podtytuł nagłówka strony (`:27973-27976`),
 *  • banner o zasięgu historii cen (`:27922`) — patrz `NaglowekKpi.tsx`,
 *  • PIĘĆ zakładek, ich `value`, kolejność i etykiety PL (`:28034-28046`),
 *    z domyślną `dostawcy` — nie „marże" (`:27805`, `useState("dostawcy")`),
 *  • karta „Marża per dostawca/kategoria/marka" z siedmioma kolumnami (`:28516-28560`),
 *  • limit 300 renderowanych wierszy (`:27953`).
 *
 * ─── CO JEST ŚWIADOMYM ODSTĘPSTWEM (decyzje D1–D3 użytkownika, 2026-09-03) ─────────────
 *  • O-10a-1 — kafle KPI liczone z `GET /api/analytics/kpi` zamiast z `filters`/`ean/*`/`status`
 *              (uzasadnienie w `NaglowekKpi.tsx`),
 *  • O-10a-2 — globalny pasek sześciu filtrów, którego oryginał nie ma
 *              (uzasadnienie w `FiltryGlobalne.tsx`),
 *  • O-10a-3 — wykres w sekcji marż; oryginał nie ma ani jednego wykresu
 *              (uzasadnienie w `components/ui/chart.tsx`),
 *  • O-10a-4 — pozostałe zakładki są puste do czasu bloków 10b, 10d i 10e. To zakres bloku,
 *              nie zmiana zachowania: nazwy i kolejność już są, więc kolejne sesje
 *              wstawiają treść, zamiast przemeblowywać widok.
 *
 * ─── CO DOŁOŻYŁ BLOK 10c (2026-09-03, `22-FEATURE-analityka-ean`) ──────────────────────
 * Zakładka „EAN i ceny" niesie trzy karty oryginału (`SekcjaEan.tsx`). Nagłówek KPI ZOSTAJE
 * na `GET /api/analytics/kpi` — oryginał liczy dwa z czterech kafli z `ean/comparison`
 * i `ean/unique` (`:28002-28017`) i te dane są już dostępne, ale przepięcie to osobna
 * decyzja użytkownika (D1 bloku 10c), nie skutek uboczny wypełniania zakładki.
 *
 * ─── CZEGO TU NIE MA ──────────────────────────────────────────────────────────────────
 * `POST /api/analytics/bootstrap-current` nie ma i mieć nie będzie przycisku (decyzja D4).
 * Trasa jest nieidempotentna — każde wywołanie dokłada po jednym wierszu `historia_cen`
 * na każdy aktywny produkt — a oryginalny frontend też jej nigdy nie woła.
 */
import { useState } from "react";

import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  useFiltry,
  useKpi,
  useMarze,
  usePokrycieEan,
  usePorownanieEan,
  useRankingDostawcowEan,
  useStatusHistorii,
  useUnikalneEan,
} from "./analityka/api";
import { FiltryGlobalne } from "./analityka/FiltryGlobalne";
import { pustyWybor, type WyborFiltrow } from "./analityka/filtrowanie";
import { NaglowekKpi } from "./analityka/NaglowekKpi";
import { SekcjaEan } from "./analityka/SekcjaEan";
import { SekcjaMarze } from "./analityka/SekcjaMarze";

/**
 * Zakładka jeszcze niewypełniona. Mówi wprost, który blok ją dowozi — inaczej pusty panel
 * wygląda jak awaria. Znika razem z wstawieniem treści przez odpowiednią sesję.
 */
function ZakladkaWPrzygotowaniu({ blok, zakres }: { blok: string; zakres: string }) {
  return (
    <div className="rounded border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      <div className="font-medium">Dashboardy w przygotowaniu — blok {blok}</div>
      <div className="mt-1 text-xs">{zakres}</div>
    </div>
  );
}

export function Analityka() {
  const [wybor, ustawWybor] = useState<WyborFiltrow>(pustyWybor);

  const { data: filtry } = useFiltry();
  const { data: status } = useStatusHistorii();
  const { data: kpi } = useKpi();
  const { data: marze, isPending: marzeWczytywane } = useMarze();

  // Blok 10c — cztery trasy EAN, które oryginalny frontend realnie woła (`fe.js:27839-27851`).
  // `ean/details` i `ean-porownanie` hooka nie mają: w oryginale nie mają konsumenta (D6).
  // Każde zapytanie niesie SWÓJ stan ładowania — cztery lecą niezależnie, więc jedna
  // wspólna flaga kazałaby jednej tabeli kłamać o stanie drugiej.
  const porownanieEan = usePorownanieEan();
  const unikalneEan = useUnikalneEan();
  const pokrycieEan = usePokrycieEan();
  const rankingEan = useRankingDostawcowEan();

  return (
    <div>
      <PageHeader
        title="Analityka"
        subtitle="Dostawcy, porównanie EAN, ceny w czasie, dostępność, marża i rotacja"
      />

      <NaglowekKpi kpi={kpi} status={status} />
      <FiltryGlobalne filtry={filtry} wybor={wybor} onZmiana={ustawWybor} />

      <Tabs defaultValue="dostawcy">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="dostawcy" data-testid="tab-dostawcy">
            Dostawcy
          </TabsTrigger>
          <TabsTrigger value="ean" data-testid="tab-ean">
            EAN i ceny
          </TabsTrigger>
          <TabsTrigger value="ceny" data-testid="tab-ceny">
            Ceny w czasie
          </TabsTrigger>
          <TabsTrigger value="dostepnosc" data-testid="tab-dostepnosc">
            Dostępność
          </TabsTrigger>
          <TabsTrigger value="marza" data-testid="tab-marza">
            Marża i rotacja
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dostawcy" className="mt-4">
          <ZakladkaWPrzygotowaniu
            blok="10d"
            zakres="Statystyki dostawców, stabilność, cykl życia i stany magazynowe."
          />
        </TabsContent>

        <TabsContent value="ean" className="mt-4">
          <SekcjaEan
            porownanie={{ dane: porownanieEan.data, ladowanie: porownanieEan.isPending }}
            unikalne={{ dane: unikalneEan.data, ladowanie: unikalneEan.isPending }}
            pokrycie={{ dane: pokrycieEan.data, ladowanie: pokrycieEan.isPending }}
            ranking={{ dane: rankingEan.data, ladowanie: rankingEan.isPending }}
            wybor={wybor}
          />
        </TabsContent>

        <TabsContent value="ceny" className="mt-4">
          <ZakladkaWPrzygotowaniu
            blok="10b"
            zakres="Inflacja cen, ostatni import, historia cen produktu, ceny rynkowe i największe zmiany."
          />
        </TabsContent>

        <TabsContent value="dostepnosc" className="mt-4">
          <ZakladkaWPrzygotowaniu
            blok="10e"
            zakres="Dostępność produktów, wyprzedaż, sezonowość i oś czasu importów."
          />
        </TabsContent>

        {/*
          Jedyna wypełniona zakładka 10a. W oryginale niesie trzy karty: marże,
          rotację (`rotation/inactive`) i cykl życia modelu (`lifecycle/models`) —
          te dwie należą do bloku 10e i dołożą się TUTAJ, pod sekcją marż.
        */}
        <TabsContent value="marza" className="mt-4 space-y-4">
          <SekcjaMarze dane={marze} wybor={wybor} ladowanie={marzeWczytywane} />
          <ZakladkaWPrzygotowaniu
            blok="10e"
            zakres="Rotacja (produkty bez aktualizacji) i cykl życia modelu dołączą do tej zakładki."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
