/**
 * Widok `/archiwum` — „Archiwum importów".
 *
 * W produkcji NIE był trasą Reacta: robił go skrypt wstrzykiwany do DOM
 * (`mirror/frontend/assets/archive-injection.js`), który przejmował adres `/archiwum`
 * (bundle pokazywał tam 404), podmieniał zawartość `<main>` i doklejał link do sidebara
 * tuż za „Historią". Odbudowa robi z tego zwykłą trasę w ramie — tak jak z Selly.
 *
 * Po co Ani: porównanie, czy plik od dostawcy zgadza się z katalogiem, i weryfikacja
 * brakujących pozycji — dlatego kluczowy jest przycisk „Pobierz" (odpowiedź 12.1 z przeglądu
 * 12 widoków, karta PR.1).
 *
 * Zachowanie przeniesione z oryginału:
 *  • każde wejście na widok i „Odśwież" pobiera listę i statystyki od nowa (`tick()`/`loadData`,
 *    :83-103, :275-289) — stąd `refetchOnMount: "always"` wbrew globalnemu `staleTime: Infinity`;
 *  • w trakcie pobierania tabela ustępuje miejsca „Ładowanie…" (:175);
 *  • błąd statystyk nie psuje widoku — pasek zajętości po prostu znika (`.catch(() => null)`, :94).
 */
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { TabelaArchiwum } from "./archiwum-importow/TabelaArchiwum";
import {
  OPCJE_STATUSU,
  WSZYSTKIE,
  adresListy,
  etykietaMiesiaca,
  opcjeFiltrow,
  pobierzPlikArchiwum,
  sformatujRozmiar,
  type ListaArchiwum,
  type PozycjaArchiwum,
  type StatystykiArchiwum,
} from "./archiwum-importow/dane";

export function ArchiwumImportow() {
  const { toast } = useToast();
  const [dostawca, ustawDostawce] = useState<string>(WSZYSTKIE);
  const [miesiac, ustawMiesiac] = useState<string>(WSZYSTKIE);
  const [status, ustawStatus] = useState<string>(WSZYSTKIE);

  const lista = useQuery<ListaArchiwum | null>({
    queryKey: [adresListy({ dostawca, miesiac, status })],
    refetchOnMount: "always",
    // Oryginał liczy opcje selectów ze STAREJ listy, dopóki nowa się nie wczyta.
    placeholderData: keepPreviousData,
  });
  const statystyki = useQuery<StatystykiArchiwum | null>({
    queryKey: ["/api/import-archive/stats"],
    refetchOnMount: "always",
  });

  const pozycje = lista.data?.items ?? [];
  const ladowanie = lista.isFetching;
  const { dostawcy, miesiace } = opcjeFiltrow(pozycje, { dostawca, miesiac });
  const staty = statystyki.isError ? null : statystyki.data;

  const odswiez = () => {
    void lista.refetch();
    void statystyki.refetch();
  };

  const pobierz = (pozycja: PozycjaArchiwum) => {
    pobierzPlikArchiwum(pozycja).catch((e: unknown) => {
      // Oryginał: `alert('Nie udało się pobrać pliku: ' + e.message)` (:226). W odbudowie
      // nie ma ani jednego `alert()` — błędy idą toastem.
      toast({
        title: "Nie udało się pobrać pliku",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Archiwum importów"
        subtitle="Surowe pliki, które wpłynęły z importów (auto-pull, ręczne pobranie z URL, upload z panelu)."
        actions={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            data-testid="button-archiwum-odswiez"
            onClick={odswiez}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Odśwież
          </Button>
        }
      />

      {lista.isError ? (
        <p
          className="rounded-md bg-destructive/10 px-3.5 py-3 text-sm text-destructive"
          role="alert"
          data-testid="text-archiwum-blad"
        >
          {lista.error.message}
        </p>
      ) : null}

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2.5 p-4">
          <Select value={dostawca} onValueChange={ustawDostawce}>
            <SelectTrigger className="w-48" data-testid="select-archiwum-dostawca" aria-label="Dostawca">
              <SelectValue placeholder="Dostawca" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={WSZYSTKIE}>Wszyscy dostawcy</SelectItem>
              {dostawcy.map((kod) => (
                <SelectItem key={kod} value={kod}>
                  {kod}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={miesiac} onValueChange={ustawMiesiac}>
            <SelectTrigger className="w-48" data-testid="select-archiwum-miesiac" aria-label="Miesiąc">
              <SelectValue placeholder="Miesiąc" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={WSZYSTKIE}>Wszystkie miesiące</SelectItem>
              {miesiace.map((m) => (
                <SelectItem key={m} value={m}>
                  {etykietaMiesiaca(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={status} onValueChange={ustawStatus}>
            <SelectTrigger className="w-48" data-testid="select-archiwum-status" aria-label="Status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {OPCJE_STATUSU.map(({ wartosc, etykieta }) => (
                <SelectItem key={wartosc} value={wartosc}>
                  {etykieta}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {staty ? (
            <div className="ml-auto text-xs text-muted-foreground" data-testid="text-archiwum-zajetosc">
              Archiwum: <b>{sformatujRozmiar(staty.bajtow)}</b> / {sformatujRozmiar(staty.limitBajtow)} ·{" "}
              {staty.plikow} plików · retencja {staty.retencjaDni} dni
              <div
                className="mt-1 h-1.5 w-56 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label="Zajętość archiwum"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(Math.min(100, (staty.bajtow / staty.limitBajtow) * 100))}
              >
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(100, (staty.bajtow / staty.limitBajtow) * 100)}%` }}
                />
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {ladowanie ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">Ładowanie…</p>
          ) : pozycje.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground" data-testid="text-archiwum-pusto">
              Brak zarchiwizowanych plików. Nowe importy będą się tu pojawiać automatycznie.
            </p>
          ) : (
            <TabelaArchiwum pozycje={pozycje} onPobierz={pobierz} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
