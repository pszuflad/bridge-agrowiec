/**
 * Multi-select z wyszukiwarką — kontrolka globalnego filtra analityki (blok 10a).
 *
 * DLACZEGO NIE `pages/katalog/WyborWielokrotny.tsx`. Tamten komponent rozwiązuje ten sam
 * problem 1:1 z oryginałem katalogu (`deminified/frontend-index.js:23490-23577`) i jest
 * dobry dla list, które da się przewinąć — „Marka" i „Kategoria" mają ich kilkadziesiąt.
 * Analityka dostaje z `/api/analytics/filters` listy ucięte dopiero na LIMIT-cie SQL:
 * `modele` 1000, `rozmiary` 1000, `indeksyNosnosci` 300 (`analytics_module.cjs:98-107` —
 * fixture potwierdza, że produkcja realnie dobija do tych limitów). Tysiąc pozycji bez
 * wyszukiwarki to kontrolka nie do użycia, stąd osobny komponent.
 *
 * DLACZEGO `Popover`, A NIE `DropdownMenu`. `DropdownMenu` Radiksa ma wbudowany typeahead:
 * wciśnięty znak przeskakuje do pozycji zaczynającej się na tę literę. Pole tekstowe
 * w środku takiego menu gubi przez to znaki. `Popover` typeaheadu nie ma.
 *
 * API celowo zgodne z `WyborWielokrotny` — gdyby katalog kiedyś potrzebował wyszukiwarki,
 * podmiana jest jednolinijkowa. Migracja `/katalog` NIE jest zakresem 10a.
 */
import { useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Ile pozycji renderujemy naraz po odfiltrowaniu. Lista 1000 elementów w DOM-ie zauważalnie
 * spowalnia otwarcie panelu, a i tak nikt jej nie przewinie — od tego jest wyszukiwarka.
 * Gdy filtr obcina wynik, licznik pod listą mówi wprost, ile pozycji zostało ukrytych.
 */
const LIMIT_WIDOCZNYCH = 200;

export type WyborZWyszukiwarkaProps = {
  etykieta: string;
  opcje: string[];
  wybrane: Set<string>;
  onZmiana: (nowe: Set<string>) => void;
  /** Napis na przycisku, gdy nic nie wybrano (np. „Wszyscy dostawcy"). */
  tekstPusty: string;
  /** Napis przy 2+ zaznaczeniach (np. `(n) => \`${n} marek\``). */
  formatujLicznik: (ile: number) => string;
  /** Podpowiedź w polu wyszukiwania (np. „Szukaj marki…"). */
  tekstSzukania: string;
  testId: string;
};

export function WyborZWyszukiwarka({
  etykieta,
  opcje,
  wybrane,
  onZmiana,
  tekstPusty,
  formatujLicznik,
  tekstSzukania,
  testId,
}: WyborZWyszukiwarkaProps) {
  const [szukane, ustawSzukane] = useState("");
  const poleRef = useRef<HTMLInputElement>(null);

  const pasujace = useMemo(() => {
    const fraza = szukane.trim().toLocaleLowerCase("pl-PL");
    if (!fraza) return opcje;
    return opcje.filter((o) => o.toLocaleLowerCase("pl-PL").includes(fraza));
  }, [opcje, szukane]);

  const widoczne = pasujace.slice(0, LIMIT_WIDOCZNYCH);
  const ukryte = pasujace.length - widoczne.length;

  const podsumowanie =
    wybrane.size === 0
      ? tekstPusty
      : wybrane.size === 1
        ? (Array.from(wybrane)[0] ?? tekstPusty)
        : formatujLicznik(wybrane.size);

  const przelacz = (wartosc: string): void => {
    const nowe = new Set(wybrane);
    if (nowe.has(wartosc)) nowe.delete(wartosc);
    else nowe.add(wartosc);
    onZmiana(nowe);
  };

  return (
    <Popover onOpenChange={(otwarty) => otwarty && ustawSzukane("")}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          data-testid={testId}
          aria-label={etykieta}
          className="w-full justify-between font-mono text-xs"
        >
          <span className="truncate">{podsumowanie}</span>
          <span className="ml-2 shrink-0 opacity-50">▾</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-64 p-0"
        // Fokus po otwarciu ląduje w polu wyszukiwania, a nie na pierwszej pozycji listy —
        // przy tysiącu opcji pisanie jest jedyną sensowną drogą do celu.
        onOpenAutoFocus={(zdarzenie) => {
          zdarzenie.preventDefault();
          poleRef.current?.focus();
        }}
      >
        <div className="border-b border-popover-border px-2 py-2">
          <div className="mb-2 text-xs font-medium text-muted-foreground">{etykieta}</div>
          <Input
            ref={poleRef}
            value={szukane}
            onChange={(e) => ustawSzukane(e.target.value)}
            placeholder={tekstSzukania}
            className="h-8 text-xs"
            data-testid={`${testId}-szukaj`}
          />
        </div>

        <div className="flex gap-1 border-b border-popover-border px-2 py-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-[10px]"
            // „Wszystkie" działa na tym, co widać po odfiltrowaniu — inaczej niewinne
            // kliknięcie przy wpisanej frazie zaznaczałoby tysiąc niewidocznych pozycji.
            onClick={() => onZmiana(new Set([...wybrane, ...pasujace]))}
            data-testid={`${testId}-wszystkie`}
          >
            Wszystkie
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-[10px]"
            onClick={() => onZmiana(new Set())}
            data-testid={`${testId}-zadne`}
          >
            Żadne
          </Button>
        </div>

        <div className="max-h-[45vh] overflow-y-auto py-1" role="listbox" aria-multiselectable>
          {widoczne.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              Brak pasujących pozycji
            </div>
          ) : (
            widoczne.map((wartosc) => (
              <button
                key={wartosc}
                type="button"
                role="option"
                aria-selected={wybrane.has(wartosc)}
                onClick={() => przelacz(wartosc)}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left font-mono text-xs hover:bg-accent hover:text-accent-foreground"
              >
                <span
                  aria-hidden
                  className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border border-input text-[10px] leading-none"
                >
                  {wybrane.has(wartosc) ? "✓" : ""}
                </span>
                <span className="truncate">{wartosc}</span>
              </button>
            ))
          )}
          {ukryte > 0 && (
            <div className="px-3 py-2 text-center text-[10px] text-muted-foreground">
              …i {ukryte} dalszych — zawęź wyszukiwanie
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
