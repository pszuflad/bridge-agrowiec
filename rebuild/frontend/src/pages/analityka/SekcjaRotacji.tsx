/**
 * Karta „Rotacja / produkty bez aktualizacji" — zakładka „Marża i rotacja", POD kartą marż
 * z bloku 10a (port `deminified/frontend-index.js:28562-28604`).
 *
 * ⚠ JEDYNA SEKCJA CAŁEJ ANALITYKI Z FILTREM SERWEROWYM. Pole „Bez ruchu dni" (`:28576-28583`)
 * trafia do `?days`, bo `rotation/inactive` jako jedna z niewielu tras modułu realnie czyta
 * `req.query` (`analytics_module.cjs:300`). Pozostałe sekcje filtrują się klientem. Rozstrzyga
 * o tym oryginał, nie wygoda — opis wzorca w `README.md` obok.
 *
 * ⚠ STAN POLA MIESZKA W `Analityka.tsx`, NIE TUTAJ — i to nie jest kwestia gustu. Radix
 * `Tabs.Content` bez `forceMount` ODMONTOWUJE nieaktywną zakładkę, więc stan trzymany w tej
 * sekcji ginąłby przy każdym przejściu na inną zakładkę i wracał do „60". Oryginał trzyma go
 * w komponencie widoku (`useState("60")`, `:27805`), gdzie przełączanie zakładek go nie rusza —
 * odtwarzamy to samo rozmieszczenie.
 *
 * ⚠ BEZ DEBOUNCE'A — i to jest wierność, nie przeoczenie. Oryginał odpytuje backend przy
 * każdym znaku (`onChange: e => l(e.target.value)`), a `staleTime: Infinity` w naszym kliencie
 * sprawia, że raz pobrana wartość zostaje w cache i powrót do „60" nie wywołuje nowego zapytania.
 *
 * Pole jest tekstowe, nie liczbowe — dokładnie jak w oryginale. Wpisany napis nieliczbowy
 * przechodzi do backendu i wraca jako `days: null` z pustą listą; zaciskanie do [1, 730]
 * należy do backendu i tylko do niego.
 *
 * Bez przycisku „CSV" (`M("rotation-inactive")`, `:28572`) — trasa eksportu należy do 10f.
 */
import { useMemo } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { useRotacjeNieaktywnych, type WierszRotacji } from "./api";
import {
  zastosujFiltry,
  wymiaryNieobslugiwane,
  wymiaryZMapowania,
  type MapowanieWymiarow,
  type WyborFiltrow,
} from "./filtrowanie";
import { NaglowekSekcji } from "./NaglowekSekcji";
import { TabelaAnalityki, type KolumnaTabeli } from "./TabelaAnalityki";

/**
 * Wiersz rotacji niesie CZTERY z sześciu wymiarów — to najbogatsza sekcja tego bloku.
 * Brakuje tylko obu indeksów, bo `SELECT` oryginału ich nie wybiera (`:301`).
 */
const MAPOWANIE: MapowanieWymiarow<WierszRotacji> = {
  dostawcy: (w) => w.dostawca,
  marki: (w) => w.marka,
  modele: (w) => w.model,
  rozmiary: (w) => w.rozmiar,
};

const KOLUMNY: KolumnaTabeli<WierszRotacji>[] = [
  { key: "ostatniaAktualizacja", label: "Ostatnia aktualizacja", mono: true },
  { key: "dostawca", label: "Dostawca", mono: true },
  { key: "kod", label: "Kod", mono: true },
  { key: "nazwa", label: "Nazwa" },
  { key: "stan", label: "Stan", right: true },
];

export function SekcjaRotacji({
  wybor,
  dni,
  onZmianaDni,
}: {
  wybor: WyborFiltrow;
  dni: string;
  onZmianaDni: (wartosc: string) => void;
}) {
  const { data, isPending } = useRotacjeNieaktywnych(dni);

  const wiersze = useMemo(
    () => zastosujFiltry(data?.rows ?? [], wybor, MAPOWANIE),
    [data, wybor],
  );

  return (
    // ⚠ JEDYNA KARTA ANALITYKI Z WŁASNYM PADDINGIEM: oryginał daje jej `p-4 space-y-3`
    // (`frontend-index.js:28563`), a nie `p-0` z kreską pod nagłówkiem jak wszystkim innym.
    <Card className="border-card-border">
      <CardContent className="space-y-3 p-4">
        <NaglowekSekcji
          bezRamki
          tytul="Rotacja / produkty bez aktualizacji"
          wszystkie={data?.rows.length ?? 0}
          widoczne={wiersze.length}
          pominiete={wymiaryNieobslugiwane(wybor, wymiaryZMapowania(MAPOWANIE))}
          wyjasnieniePominietych="Odpowiedź tej sekcji nie niesie indeksów, więc nie stosuje filtrów:"
          rzeczownik="produktów"
          prefiksTestu="rotacja"
        />

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Bez ruchu dni</span>
          <Input
            value={dni}
            onChange={(e) => onZmianaDni(e.target.value)}
            className="w-24 font-mono"
            aria-label="Bez ruchu dni"
            data-testid="pole-dni-rotacji"
          />
        </div>

        <TabelaAnalityki
          dane={wiersze}
          kolumny={KOLUMNY}
          tekstPusty={isPending ? "Wczytywanie…" : "Brak danych"}
          testId="tabela-rotacja"
        />
      </CardContent>
    </Card>
  );
}
