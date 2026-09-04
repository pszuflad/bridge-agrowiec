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
 *              (uzasadnienie w `components/ui/chart.tsx`); blok 10b rozszerza to
 *              o wykres inflacji (O-10b-2),
 *  • O-10a-4 — zakładki były puste do czasu bloków 10b–10e; dziś niesie treść komplet
 *              pięciu. To był zakres bloków,
 *              nie zmiana zachowania: nazwy i kolejność już są, więc kolejne sesje
 *              wstawiają treść, zamiast przemeblowywać widok.
 *  • O-10d-1 — wykres dostępności w karcie „1.4 / 1.5" zakładki `dostawcy` (decyzja D2
 *              z 2026-09-03) — kontynuacja O-10a-3, uzasadnienie w `SekcjaStanDostawcow.tsx`.
 *
 * ─── CO DOŁOŻYŁ BLOK 10c (2026-09-03, `22-FEATURE-analityka-ean`) ──────────────────────
 * Zakładka „EAN i ceny" niesie trzy karty oryginału (`SekcjaEan.tsx`). Nagłówek KPI ZOSTAJE
 * na `GET /api/analytics/kpi` — oryginał liczy dwa z czterech kafli z `ean/comparison`
 * i `ean/unique` (`:28002-28017`) i te dane są już dostępne, ale przepięcie to osobna
 * decyzja użytkownika (D1 bloku 10c), nie skutek uboczny wypełniania zakładki.
 *
 * ─── CO DOŁOŻYŁ BLOK 10e (2026-09-04, `25-FEATURE-analityka-dostepnosc-rotacja`) ───────
 * Zakładka „Dostępność" niesie trzy karty oryginału (4.1, 4.2, 4.4), a pod kartą marż
 * w zakładce „Marża i rotacja" stają dwie kolejne (rotacja, cykl życia modelu) — tak jak
 * w produkcji (`frontend-index.js:28516-28640`), bez tworzenia nowej zakładki.
 *  • O-10e-1 — wykres liniowy w karcie „4.4 Sezonowy wzorzec cen"
 *              (uzasadnienie w `analityka/SekcjaSezonowosci.tsx`).
 *
 * ⚠ Karty „4.1" i „4.2" pokazują „Brak danych" NIEZALEŻNIE od stanu bazy i tak jest też
 * w produkcji: ich zapytania pytają `historia_cen` o kolumnę `nazwa`, której ta tabela nie ma
 * (`docs/rebuild-backlog.md` #32). To nie jest usterka odbudowy.
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
  useCyklZyciaModeli,
  useDostepnoscProduktow,
  useFiltry,
  useKpi,
  useMarze,
  usePokrycieEan,
  usePorownanieEan,
  useRankingDostawcowEan,
  useSezonowoscMiesieczna,
  useStabilnoscDostawcow,
  useStanDostawcow,
  useStatusHistorii,
  useTempoSchodzenia,
  useUnikalneEan,
} from "./analityka/api";
import { FiltryGlobalne } from "./analityka/FiltryGlobalne";
import { pustyWybor, type WyborFiltrow } from "./analityka/filtrowanie";
import { NaglowekKpi } from "./analityka/NaglowekKpi";
import { SekcjaCeny } from "./analityka/SekcjaCeny";
import { SekcjaCyklZyciaDostawcow } from "./analityka/SekcjaCyklZyciaDostawcow";
import { SekcjaCykluZyciaModeli } from "./analityka/SekcjaCykluZyciaModeli";
import { SekcjaDostepnosciProduktow } from "./analityka/SekcjaDostepnosciProduktow";
import { SekcjaEan } from "./analityka/SekcjaEan";
import { SekcjaMarze } from "./analityka/SekcjaMarze";
import { SekcjaRotacji } from "./analityka/SekcjaRotacji";
import { SekcjaSezonowosci } from "./analityka/SekcjaSezonowosci";
import { SekcjaStabilnoscDostawcow } from "./analityka/SekcjaStabilnoscDostawcow";
import { SekcjaStanDostawcow } from "./analityka/SekcjaStanDostawcow";
import { SekcjaTempaSchodzenia } from "./analityka/SekcjaTempaSchodzenia";

// `ZakladkaWPrzygotowaniu` — komponent-zaślepka z bloku 10a — zniknął przy scaleniu 10b i 10e
// (2026-09-04): wszystkie pięć zakładek niesie już treść, więc nie miał czego zastępować.
// Historia w `docs/tickets/19-FEATURE-analityka-fundament/`.

/** Wartość początkowa pola „Bez ruchu dni" — `useState("60")` oryginału. Napis, nie liczba. */
const DNI_ROTACJI_POCZATKOWE = "60";

export function Analityka() {
  const [wybor, ustawWybor] = useState<WyborFiltrow>(pustyWybor);

  const { data: filtry } = useFiltry();
  const { data: status } = useStatusHistorii();
  const { data: kpi } = useKpi();
  const { data: marze, isPending: marzeWczytywane } = useMarze();
  const { data: stabilnosc, isPending: stabilnoscWczytywana } = useStabilnoscDostawcow();
  const { data: cyklZycia, isPending: cyklZyciaWczytywany } = useCyklZyciaDostawcow();
  const { data: stan, isPending: stanWczytywany } = useStanDostawcow();

  // Blok 10c — cztery trasy EAN, które oryginalny frontend realnie woła (`fe.js:27839-27851`).
  // `ean/details` i `ean-porownanie` hooka nie mają: w oryginale nie mają konsumenta (D6).
  // Każde zapytanie niesie SWÓJ stan ładowania — cztery lecą niezależnie, więc jedna
  // wspólna flaga kazałaby jednej tabeli kłamać o stanie drugiej.
  const porownanieEan = usePorownanieEan();
  const unikalneEan = useUnikalneEan();
  const pokrycieEan = usePokrycieEan();
  const rankingEan = useRankingDostawcowEan();

  // Blok 10e. Wartość pola „Bez ruchu dni" mieszka TU, a nie w sekcji rotacji — tak jak
  // w oryginale (`useState("60")`, `frontend-index.js:27805`). Powód jest praktyczny:
  // `Tabs.Content` odmontowuje nieaktywną zakładkę, więc stan trzymany w sekcji wracałby
  // do „60" po każdym przejściu na inną zakładkę. Samo zapytanie zostaje w sekcji.
  const { data: dostepnosc, isPending: dostepnoscWczytywana } = useDostepnoscProduktow();
  const { data: tempo, isPending: tempoWczytywane } = useTempoSchodzenia();
  const { data: sezonowosc, isPending: sezonowoscWczytywana } = useSezonowoscMiesieczna();
  const { data: cyklZyciaModeli, isPending: cyklModeliWczytywany } = useCyklZyciaModeli();
  const [dniRotacji, ustawDniRotacji] = useState(DNI_ROTACJI_POCZATKOWE);

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
          <SekcjaEan
            porownanie={{ dane: porownanieEan.data, ladowanie: porownanieEan.isPending }}
            unikalne={{ dane: unikalneEan.data, ladowanie: unikalneEan.isPending }}
            pokrycie={{ dane: pokrycieEan.data, ladowanie: pokrycieEan.isPending }}
            ranking={{ dane: rankingEan.data, ladowanie: rankingEan.isPending }}
            wybor={wybor}
          />
        </TabsContent>

        {/*
          Wypełnione w bloku 10b. Karty są TRZY, a nie pięć: `top-zmiany`
          i `market/group-prices` mają w tym bloku backend, ale świadomie nie mają UI
          (decyzje D1 i D2) — oryginał ich nie renderuje. Szczegóły w `SekcjaCeny.tsx`.
        */}
        <TabsContent value="ceny" className="mt-4">
          <SekcjaCeny wybor={wybor} />
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
          <SekcjaRotacji wybor={wybor} dni={dniRotacji} onZmianaDni={ustawDniRotacji} />
          <SekcjaCykluZyciaModeli
            dane={cyklZyciaModeli}
            wybor={wybor}
            ladowanie={cyklModeliWczytywany}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
