/**
 * Widok `/konfiguracja` — sześć zakładek z oryginału
 * (`deminified/frontend-index.js:26286-26382`), wszystkie wypełnione.
 *
 * Dowożone kolejno: „Wgrywanie ręczne" w bloku 3f-1, „Dostawcy" w 3f-2, a „Spedycja",
 * „Shoper", „Katalog" i „AI Fallback" w Iteracji 11. Kolejność i etykiety zakładek
 * mieszkają w `konfiguracja/zakladki.ts` i są 1:1 z produkcją — Ania zna je z pamięci.
 */
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Admin } from "./konfiguracja/Admin";
import { Ai } from "./konfiguracja/Ai";
import { Dziennik } from "./konfiguracja/Dziennik";
import { Dostawcy } from "./konfiguracja/Dostawcy";
import { Katalog } from "./konfiguracja/Katalog";
import { Shoper } from "./konfiguracja/Shoper";
import { Spedycja } from "./konfiguracja/Spedycja";
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

        <TabsContent value="spedycja" className="mt-4">
          <Spedycja />
        </TabsContent>

        {/*
         * Shoper i AI inicjalizują stan formularza wartościami z `GET /api/config`. Za to,
         * żeby formularz zobaczył je już przy pierwszym renderze, odpowiadają SAME zakładki:
         * każda dzieli się na komponent pobierający i formularz montowany dopiero z gotowymi
         * danymi (patrz nagłówek `Ai.tsx`). Leniwe montowanie `TabsContent` tu nie wystarcza
         * — chroni tylko wtedy, gdy config jest już w cache'u.
         */}
        <TabsContent value="shoper" className="mt-4">
          <Shoper />
        </TabsContent>

        <TabsContent value="katalog" className="mt-4">
          <Katalog />
        </TabsContent>

        <TabsContent value="admin" className="mt-4">
          <Admin />
        </TabsContent>

        <TabsContent value="dziennik" className="mt-4">
          <Dziennik />
        </TabsContent>

        <TabsContent value="ai" className="mt-4">
          <Ai />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
