/**
 * Widok `/narzuty` — port `VT()` (`deminified/frontend-index.js:25122-25152`).
 *
 * Dwie zakładki, domyślnie „narzuty"; zakładka narzutów niesie tabelę ORAZ symulator ceny,
 * zakładka promocji — samą tabelę. Układ i `data-testid` 1:1 z oryginałem.
 */
import { Percent } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Symulator } from "./narzuty/Symulator";
import { TabelaNarzutow } from "./narzuty/TabelaNarzutow";
import { TabelaPromocji } from "./narzuty/TabelaPromocji";

export function Narzuty() {
  return (
    <div>
      <PageHeader
        title="Narzuty i promocje"
        subtitle="Konfiguracja reguł cen i czasowych rabatów"
      />
      <Tabs defaultValue="narzuty">
        <TabsList>
          <TabsTrigger value="narzuty" data-testid="tab-narzuty">
            <Percent className="w-4 h-4 mr-2" /> Narzuty
          </TabsTrigger>
          <TabsTrigger value="promocje" data-testid="tab-promocje">
            Promocje
          </TabsTrigger>
        </TabsList>
        <TabsContent value="narzuty" className="mt-4">
          <TabelaNarzutow />
          <Symulator />
        </TabsContent>
        <TabsContent value="promocje" className="mt-4">
          <TabelaPromocji />
        </TabsContent>
      </Tabs>
    </div>
  );
}
