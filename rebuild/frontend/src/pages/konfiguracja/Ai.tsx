/**
 * Zakładka „AI Fallback" — port karty `YT()` (`deminified/frontend-index.js:25940-26018`).
 *
 * Port 1:1: tytuł, podtytuł, dwa pola (klucz API jako `password` z placeholderem
 * `sk-proj-...`, model), odznaka AKTYWNY/SYMULACJA wyliczana WYŁĄCZNIE z tego, czy klucz
 * jest niepusty (`:25944`), teksty pomocnicze i `data-testid` (`input-openai-key`,
 * `input-openai-model`, `button-save-ai`).
 *
 * ⚠ `ai_fallback.aktywny` NIE MA własnego pola w formularzu — jest wyprowadzane z klucza
 * przy zapisie (`wartosc: t ? "true" : "false"`, `:26000`). Dołożenie przełącznika byłoby
 * wymyślaniem nowego zachowania, a przy okazji rozjechałoby odznakę ze stanem zapisanym.
 *
 * ⚠ PODZIAŁ NA DWA KOMPONENTY JEST KONIECZNY, nie kosmetyczny. Formularz inicjalizuje
 * `useState` wartościami z configu, a `useState` bierze wartość początkową WYŁĄCZNIE przy
 * pierwszym renderze. Gdyby pobieranie i formularz siedziały w jednym komponencie, pierwsze
 * wejście w zakładkę (config jeszcze nie w cache'u) zamrażałoby pola na wartościach
 * domyślnych — a kliknięcie „Zapisz" nadpisałoby wtedy prawdziwy klucz API pustką.
 * Dlatego `FormularzAi` montuje się DOPIERO z gotowymi danymi. Tak też działa oryginał:
 * config pobiera strona (`eM()`, `:26277-26290`) i wstrzykuje kartom propsem `cfg`.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KLUCZ_KONFIGURACJI, zapiszKlucze, type Konfiguracja } from "./config";

/** Wartość domyślna modelu z oryginału (`:25943`) — ta sama, co w seedzie backendu. */
const MODEL_DOMYSLNY = "gpt-4o-mini";

export function Ai() {
  const { data: konfiguracja, isLoading } = useQuery<Konfiguracja>({
    queryKey: KLUCZ_KONFIGURACJI,
  });

  // Rozdzielone świadomie: `isLoading` to „zapytanie jeszcze trwa", a `data === null` to
  // WYGASŁA SESJA (`zapytanieZwracajaceNullNa401`, `lib/queryClient.ts:13-16`). Spinner
  // należy się tylko pierwszemu; przy 401 pokazujemy formularz na pustej konfiguracji, bo
  // `staleTime: Infinity` znaczy, że drugiej odpowiedzi już nie będzie i „Wczytywanie…"
  // wisiałoby w nieskończoność. To ta sama degradacja, co w reszcie aplikacji: pusty widok
  // teraz, twardy błąd dopiero przy zapisie. Oryginał robi to samo — strona domyśla
  // `cfg = {}` (`frontend-index.js:26290`).
  if (isLoading) {
    return (
      <Card className="border-card-border">
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground">Wczytywanie…</p>
        </CardContent>
      </Card>
    );
  }
  return <FormularzAi konfiguracja={konfiguracja ?? {}} />;
}

function FormularzAi({ konfiguracja }: { konfiguracja: Konfiguracja }) {
  const klient = useQueryClient();

  // Stan POCZĄTKOWY z configu — jak w oryginale, gdzie karta dostaje `cfg` propsem.
  // Późniejsze odświeżenie configu świadomie NIE nadpisuje pól: to samo robi oryginał
  // (`useState(e[...])`, `:25943`), a nadpisywanie kasowałoby niezapisane zmiany.
  const [kluczApi, ustawKluczApi] = useState(konfiguracja["ai_fallback.klucz_api"] ?? "");
  const [model, ustawModel] = useState(konfiguracja["ai_fallback.model"] ?? MODEL_DOMYSLNY);
  const [komunikat, ustawKomunikat] = useState<{ tresc: string; blad: boolean } | null>(null);

  /** Odznaka patrzy na POLE, nie na zapisany `ai_fallback.aktywny` — 1:1 z `:25944`. */
  const aktywny = kluczApi.trim() !== "";

  const zapis = useMutation<void, Error, void>({
    mutationFn: () =>
      zapiszKlucze([
        ["ai_fallback.klucz_api", kluczApi],
        ["ai_fallback.model", model],
        ["ai_fallback.aktywny", kluczApi ? "true" : "false"],
      ]),
    onSuccess: () => {
      ustawKomunikat({ tresc: "Zapisano AI Fallback", blad: false });
      void klient.invalidateQueries({ queryKey: KLUCZ_KONFIGURACJI });
    },
    onError: (e) => ustawKomunikat({ tresc: `Błąd zapisu: ${e.message}`, blad: true }),
  });

  return (
    <Card className="border-card-border">
      <CardContent className="p-5">
        <div className="mb-4">
          <h3 className="text-sm font-medium">AI Fallback (OpenAI ChatGPT)</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gdy parser nie rozpozna kolumn — OpenAI ChatGPT próbuje odgadnąć strukturę cennika.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 max-w-2xl">
          <div className="sm:col-span-2">
            <Label htmlFor="openai-key">Klucz API OpenAI</Label>
            <Input
              id="openai-key"
              type="password"
              value={kluczApi}
              onChange={(e) => ustawKluczApi(e.target.value)}
              placeholder="sk-proj-..."
              className="font-mono mt-1"
              data-testid="input-openai-key"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Klucz przechowywany w bazie. Wymagany do trybu aktywnego.
            </p>
          </div>

          <div>
            <Label htmlFor="openai-model">Model</Label>
            <Input
              id="openai-model"
              value={model}
              onChange={(e) => ustawModel(e.target.value)}
              className="font-mono mt-1"
              data-testid="input-openai-model"
            />
          </div>

          <div>
            <Label>Status</Label>
            <div className="mt-2">
              {aktywny ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">AKTYWNY</Badge>
              ) : (
                <Badge variant="secondary">SYMULACJA</Badge>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                {aktywny
                  ? "AI Fallback gotowy do użycia (klucz wprowadzony)."
                  : "Tryb symulacji — bez prawdziwych zapytań do OpenAI."}
              </p>
            </div>
          </div>

          <div className="sm:col-span-2 flex flex-col gap-2">
            <div>
              <Button
                onClick={() => {
                  ustawKomunikat(null);
                  zapis.mutate();
                }}
                disabled={zapis.isPending}
                data-testid="button-save-ai"
              >
                {zapis.isPending ? "Zapisywanie…" : "Zapisz"}
              </Button>
            </div>
            {komunikat ? (
              <p
                className={`text-[11px] ${komunikat.blad ? "text-destructive" : "text-muted-foreground"}`}
                data-testid="komunikat-ai"
              >
                {komunikat.tresc}
              </p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
