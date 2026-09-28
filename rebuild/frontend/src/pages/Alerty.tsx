/**
 * Widok `/alerty` — dwie zakładki (karta P6.2, ticket `77-FEATURE-pseudo-alerty-katalogowe`).
 *
 *  • „Import"  — REALNE alerty importu z `GET /api/alerts`, zwinięte w grupy (Iteracja 6, P6.1).
 *    Tego oryginał pod tym adresem nie pokazywał wcale — odstępstwo D1 z ticketu
 *    `18-FEATURE-widok-alerty`, bo to te alerty mówią Ani, co się w nocy nie pobrało.
 *  • „Katalog" — PSEUDO-ALERTY liczone w przeglądarce z `GET /api/products` (marża ujemna,
 *    bardzo niska marża, nie-opona, brak importu cennika) — port `HT()`/`pv()` z żywego bundla
 *    na `origin/main`. Wróciły na prośbę Ani z 2026-09-21 (backlog #26, decyzja 1).
 *
 * Zakładka siedzi w adresie (`?zakladka=katalog`), żeby Pulpit mógł linkować wprost do właściwej
 * listy. Domyślna jest „Import" — dzisiejszy widok, pierwszy w kolejności z decyzji 1.
 */
import { useSearchParams } from "wouter";

import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ListaAlertowKatalogu } from "./alerty/ListaAlertowKatalogu";
import { TabelaAlertow } from "./alerty/TabelaAlertow";
import { ZAKLADKA_IMPORT, ZAKLADKA_KATALOG, type Zakladka } from "./alerty/zakladki";

export function Alerty() {
  const [parametry, ustawParametry] = useSearchParams();
  const zakladka: Zakladka =
    parametry.get("zakladka") === ZAKLADKA_KATALOG ? ZAKLADKA_KATALOG : ZAKLADKA_IMPORT;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Alerty"
        subtitle="Zdarzenia importu i ostrzeżenia liczone na żywo z katalogu"
      />
      <Tabs
        value={zakladka}
        onValueChange={(nowa) =>
          ustawParametry(nowa === ZAKLADKA_KATALOG ? { zakladka: ZAKLADKA_KATALOG } : {}, {
            replace: true,
          })
        }
      >
        <TabsList>
          <TabsTrigger value={ZAKLADKA_IMPORT} data-testid="tab-alerty-import">
            Import
          </TabsTrigger>
          <TabsTrigger value={ZAKLADKA_KATALOG} data-testid="tab-alerty-katalog">
            Katalog
          </TabsTrigger>
        </TabsList>
        <TabsContent value={ZAKLADKA_IMPORT} className="mt-4">
          <TabelaAlertow />
        </TabsContent>
        <TabsContent value={ZAKLADKA_KATALOG} className="mt-4">
          <ListaAlertowKatalogu />
        </TabsContent>
      </Tabs>
    </div>
  );
}
