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
import { Ai } from "./konfiguracja/Ai";
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
         * Shoper i AI inicjalizują stan formularza wartościami z `GET /api/config`, więc
         * muszą się zamontować dopiero, gdy config jest już pobrany. `TabsContent` z Radiksa
         * montuje zawartość leniwie — dopóki zakładka nie jest aktywna, komponent nie
         * istnieje — a zapytanie ma `staleTime: Infinity`, więc przy wejściu w zakładkę dane
         * albo są w cache'u, albo karta pokazuje „Wczytywanie…" i montuje formularz po
         * odpowiedzi. Bez tego pola startowałyby puste i nadpisałyby zapisaną konfigurację.
         */}
        <TabsContent value="shoper" className="mt-4">
          <Shoper />
        </TabsContent>

        <TabsContent value="katalog" className="mt-4">
          <Katalog />
        </TabsContent>

        <TabsContent value="ai" className="mt-4">
          <Ai />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
