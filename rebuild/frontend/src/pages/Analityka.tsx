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
 *  • O-10a-4 — zakładki puste do czasu bloków 10b–10d. To zakres bloku, nie zmiana
 *              zachowania: nazwy i kolejność już są, więc kolejne sesje wstawiają treść,
 *              zamiast przemeblowywać widok. Blok 10e wypełnił „Dostępność" i dołożył
 *              dwie karty pod marżami;
 *  • O-10e-1 — wykres liniowy w karcie „4.4 Sezonowy wzorzec cen"
 *              (uzasadnienie w `analityka/SekcjaSezonowosci.tsx`).
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
  useCyklZyciaModeli,
  useDostepnoscProduktow,
  useFiltry,
  useKpi,
  useMarze,
  useSezonowoscMiesieczna,
  useStatusHistorii,
  useTempoSchodzenia,
} from "./analityka/api";
import { FiltryGlobalne } from "./analityka/FiltryGlobalne";
import { pustyWybor, type WyborFiltrow } from "./analityka/filtrowanie";
import { NaglowekKpi } from "./analityka/NaglowekKpi";
import { SekcjaCykluZycia } from "./analityka/SekcjaCykluZycia";
import { SekcjaDostepnosciProduktow } from "./analityka/SekcjaDostepnosciProduktow";
import { SekcjaMarze } from "./analityka/SekcjaMarze";
import { SekcjaRotacji } from "./analityka/SekcjaRotacji";
import { SekcjaSezonowosci } from "./analityka/SekcjaSezonowosci";
import { SekcjaTempaSchodzenia } from "./analityka/SekcjaTempaSchodzenia";

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

  // Blok 10e. Zapytanie rotacji NIE jest tutaj — zależy od kontrolki „Bez ruchu dni",
  // więc mieszka razem z nią w `SekcjaRotacji` (jedyny filtr serwerowy całej analityki).
  const { data: dostepnosc, isPending: dostepnoscWczytywana } = useDostepnoscProduktow();
  const { data: tempo, isPending: tempoWczytywane } = useTempoSchodzenia();
  const { data: sezonowosc, isPending: sezonowoscWczytywana } = useSezonowoscMiesieczna();
  const { data: cyklZycia, isPending: cyklWczytywany } = useCyklZyciaModeli();

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

        {/*
          Trzy karty w kolejności oryginału (`frontend-index.js:28417-28515`): 4.1, 4.2, 4.4.
          Numeracja jest z produkcji i ma luki — „4.3" i „4.5" siedzą w innych zakładkach.

          ⚠ Dwie pierwsze karty są w produkcji TRWALE PUSTE (`historia_cen` nie ma kolumny
          `nazwa`, o którą pytają ich zapytania). Odtwarzamy to zachowanie 1:1; szczegóły
          w nagłówkach obu sekcji i w `repos/analityka.ts`.
        */}
        <TabsContent value="dostepnosc" className="mt-4 space-y-4">
          <SekcjaDostepnosciProduktow
            dane={dostepnosc}
            wybor={wybor}
            ladowanie={dostepnoscWczytywana}
          />
          <SekcjaTempaSchodzenia dane={tempo} wybor={wybor} ladowanie={tempoWczytywane} />
          <SekcjaSezonowosci dane={sezonowosc} wybor={wybor} ladowanie={sezonowoscWczytywana} />
        </TabsContent>

        {/*
          Trzy karty, w kolejności oryginału (`frontend-index.js:28516-28640`): marże z bloku
          10a NA GÓRZE, pod nimi rotacja i cykl życia z 10e. To JEDNA zakładka, a nie nowa —
          `rotation/inactive` i `lifecycle/models` należą tu, bo tak jest w produkcji.
        */}
        <TabsContent value="marza" className="mt-4 space-y-4">
          <SekcjaMarze dane={marze} wybor={wybor} ladowanie={marzeWczytywane} />
          <SekcjaRotacji wybor={wybor} />
          <SekcjaCykluZycia dane={cyklZycia} wybor={wybor} ladowanie={cyklWczytywany} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
