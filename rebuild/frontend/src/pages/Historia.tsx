/**
 * Widok `/historia` — odtworzenie ekranu z oryginału
 * (`deminified/frontend-index.js:25374-25635`, funkcja `GT()`).
 *
 * Stronicowany po stronie serwera: filtry i paginacja idą do `GET /api/history/paged`,
 * a lista dostawców do filtra pochodzi z `GET /api/history/meta`. Gołej `GET /api/history`
 * ten ekran NIE woła — co ten widok pokazuje i czego nie, opisuje nagłówek `historia/dane.ts`.
 */
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TabelaHistorii } from "./historia/TabelaHistorii";
import {
  OPCJE_FILTRA_TYPU,
  ROZMIARY_STRONY,
  adresStrony,
  type MetaHistorii,
  type StronaHistorii,
} from "./historia/dane";

export function Historia() {
  const [szukaj, ustawSzukaj] = useState("");
  const [typ, ustawTyp] = useState("all");
  const [dostawca, ustawDostawce] = useState("all");
  const [strona, ustawStrone] = useState(1);
  const [naStronie, ustawNaStronie] = useState<number>(ROZMIARY_STRONY[0]);

  // Zmiana filtra cofa na stronę 1 — inaczej łatwo wylądować poza zakresem wyników
  // i zobaczyć pustą tabelę, która wygląda jak brak danych (oryginał: `:25375-25377`).
  // `naStronie` jest tu dodatkowo, bo oryginał zeruje stronę przy przełączniku 25/50/100
  // osobno, w `onClick` (`:25580`) — u nas załatwia to jeden efekt.
  useEffect(() => {
    ustawStrone(1);
  }, [szukaj, typ, dostawca, naStronie]);

  const adres = adresStrony({ page: strona, limit: naStronie, search: szukaj, typ, dostawca });

  // Klucz zawiera pełny adres z parametrami, więc każda kombinacja filtrów ma własny wpis
  // w cache, a `queryFn` z `lib/queryClient.ts` skleja go w URL przez `queryKey.join("/")`.
  const { data, isLoading, isError } = useQuery<StronaHistorii | null>({ queryKey: [adres] });
  const { data: meta } = useQuery<MetaHistorii | null>({ queryKey: ["/api/history/meta"] });

  const wpisy = data?.items ?? [];
  const razem = data?.total ?? 0;
  const liczbaStron = data?.pages ?? 1;
  const dostawcy = meta?.dostawcy ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Historia zmian"
        subtitle="Log każdego importu, eksportu i ręcznej edycji produktu w katalogu"
      />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2.5 p-4">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8 font-mono text-sm"
              placeholder="Szukaj po kodzie produktu, dostawcy lub treści zmiany..."
              aria-label="Szukaj w historii"
              data-testid="input-search-history"
              value={szukaj}
              onChange={(e) => ustawSzukaj(e.target.value)}
            />
          </div>

          <Select value={typ} onValueChange={ustawTyp}>
            <SelectTrigger className="w-44" data-testid="select-history-type" aria-label="Typ">
              <SelectValue placeholder="Typ" />
            </SelectTrigger>
            <SelectContent>
              {OPCJE_FILTRA_TYPU.map(({ wartosc, etykieta }) => (
                <SelectItem key={wartosc} value={wartosc}>
                  {etykieta}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={dostawca} onValueChange={ustawDostawce}>
            <SelectTrigger
              className="w-44"
              data-testid="select-history-supplier"
              aria-label="Dostawca"
            >
              <SelectValue placeholder="Dostawca" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszyscy dostawcy</SelectItem>
              {dostawcy.map((kod) => (
                <SelectItem key={kod} value={kod}>
                  {kod}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="ml-auto font-mono text-xs text-muted-foreground">{razem} wpisów</div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isError ? (
            <p className="p-8 text-center text-sm text-destructive" role="alert">
              Nie udało się pobrać historii zmian.
            </p>
          ) : (
            <TabelaHistorii wpisy={wpisy} ladowanie={isLoading} />
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="text-[11px]">Na stronie:</span>
          {ROZMIARY_STRONY.map((rozmiar) => (
            <Button
              key={rozmiar}
              size="sm"
              variant={rozmiar === naStronie ? "default" : "outline"}
              className="h-7 px-2 font-mono text-[11px]"
              data-testid={`button-page-size-${rozmiar}`}
              onClick={() => ustawNaStronie(rozmiar)}
            >
              {rozmiar}
            </Button>
          ))}
        </div>

        <span className="ml-3 font-mono" data-testid="info-strona">
          Strona {strona} z {liczbaStron} · {razem} wpisów
        </span>

        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="outline"
            data-testid="button-first-page"
            disabled={strona <= 1}
            onClick={() => ustawStrone(1)}
          >
            « Pierwsza
          </Button>
          <Button
            size="sm"
            variant="outline"
            data-testid="button-prev-page"
            disabled={strona <= 1}
            onClick={() => ustawStrone((s) => Math.max(1, s - 1))}
          >
            Poprzednia
          </Button>
          <Button
            size="sm"
            variant="outline"
            data-testid="button-next-page"
            disabled={strona >= liczbaStron}
            onClick={() => ustawStrone((s) => s + 1)}
          >
            Następna
          </Button>
          <Button
            size="sm"
            variant="outline"
            data-testid="button-last-page"
            disabled={strona >= liczbaStron}
            onClick={() => ustawStrone(liczbaStron)}
          >
            Ostatnia »
          </Button>
        </div>
      </div>
    </div>
  );
}
