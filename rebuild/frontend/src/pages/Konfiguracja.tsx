/**
 * Widok `/konfiguracja` — szkielet sześciu zakładek z oryginału
 * (`deminified/frontend-index.js:26286-26382`).
 *
 * Bloki 3f-1 i 3f-2 wypełniają dwie zakładki: „Dostawcy" i „Wgrywanie ręczne".
 * Pozostałe cztery istnieją,
 * jest osiągalnych i mówi wprost, co je dowiezie — bo szkielet bez nich rozjechałby
 * kolejność zakładek, którą Ania zna z produkcji. Przypisanie do bloków wynika z decyzji
 * użytkownika z 2026-09-01 (roadmapa §5, blok 3f) i mieszka w `konfiguracja/zakladki.ts`.
 */
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dostawcy } from "./konfiguracja/Dostawcy";
import { Wgrywanie } from "./konfiguracja/Wgrywanie";
import { ZAKLADKI_KONFIGURACJI } from "./konfiguracja/zakladki";

export function Konfiguracja() {
  return (
    <AppShell>
      <PageHeader
        title="Konfiguracja"
        subtitle="Dostawcy, wgrywanie ręczne, spedycja, Shoper i AI Fallback"
      />
      {/*
       * `defaultValue="dostawcy"` — jak w oryginale (`:26298`). 3f-1 otwierał ekran na
       * „wgrywanie" tylko dlatego, że tamta zakładka była wtedy jedyną wypełnioną;
       * po 3f-2 ta wymuszona zmiana jest już niepotrzebna.
       */}
      <Tabs defaultValue="dostawcy">
        <TabsList className="flex-wrap h-auto">
          {ZAKLADKI_KONFIGURACJI.map((z) => (
            <TabsTrigger key={z.wartosc} value={z.wartosc} data-testid={`tab-${z.wartosc}`}>
              {z.etykieta}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="dostawcy" className="mt-4">
          <Dostawcy />
        </TabsContent>

        <TabsContent value="wgrywanie" className="mt-4">
          <Wgrywanie />
        </TabsContent>

        {ZAKLADKI_KONFIGURACJI.filter((z) => z.domykaBlok !== null).map((z) => (
          <TabsContent key={z.wartosc} value={z.wartosc} className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground" data-testid={`zaslepka-${z.wartosc}`}>
                  {z.opis} Ta zakładka powstanie w{" "}
                  <span className="font-medium text-foreground">{z.domykaBlok}</span>.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </AppShell>
  );
}
