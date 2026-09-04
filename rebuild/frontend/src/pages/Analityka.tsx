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
 *  • O-10a-4 — cztery zakładki są puste do czasu bloków 10b–10e. To zakres bloku,
 *              nie zmiana zachowania: nazwy i kolejność już są, więc kolejne sesje
 *              wstawiają treść, zamiast przemeblowywać widok.
 *  • O-10d-1 — wykres dostępności w karcie „1.4 / 1.5" zakładki `dostawcy` (decyzja D2
 *              z 2026-09-03) — kontynuacja O-10a-3, uzasadnienie w `SekcjaStanDostawcow.tsx`.
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
  useCyklZyciaDostawcow,
  useFiltry,
  useKpi,
  useMarze,
  useStabilnoscDostawcow,
  useStanDostawcow,
  useStatusHistorii,
} from "./analityka/api";
import { FiltryGlobalne } from "./analityka/FiltryGlobalne";
import { pustyWybor, type WyborFiltrow } from "./analityka/filtrowanie";
import { NaglowekKpi } from "./analityka/NaglowekKpi";
import { SekcjaCyklZyciaDostawcow } from "./analityka/SekcjaCyklZyciaDostawcow";
import { SekcjaMarze } from "./analityka/SekcjaMarze";
import { SekcjaStabilnoscDostawcow } from "./analityka/SekcjaStabilnoscDostawcow";
import { SekcjaStanDostawcow } from "./analityka/SekcjaStanDostawcow";

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
  const { data: stabilnosc, isPending: stabilnoscWczytywana } = useStabilnoscDostawcow();
  const { data: cyklZycia, isPending: cyklZyciaWczytywany } = useCyklZyciaDostawcow();
  const { data: stan, isPending: stanWczytywany } = useStanDostawcow();

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

        {/*
          Zakładka DOMYŚLNA całego widoku (`:27805`, `useState("dostawcy")`). Trzy karty
          w kolejności oryginału (`:28050-28174`) — blok 10d wstawia treść w gotowe miejsce,
          nie przemeblowuje zakładek.
        */}
        <TabsContent value="dostawcy" className="mt-4">
          <div className="space-y-4">
            <SekcjaStabilnoscDostawcow
              dane={stabilnosc}
              wybor={wybor}
              ladowanie={stabilnoscWczytywana}
            />
            <SekcjaCyklZyciaDostawcow
              dane={cyklZycia}
              wybor={wybor}
              ladowanie={cyklZyciaWczytywany}
            />
            <SekcjaStanDostawcow dane={stan} wybor={wybor} ladowanie={stanWczytywany} />
          </div>
        </TabsContent>

        <TabsContent value="ean" className="mt-4">
          <ZakladkaWPrzygotowaniu
            blok="10c"
            zakres="Porównanie EAN, pokrycie, pozycje unikalne i ranking dostawców."
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
