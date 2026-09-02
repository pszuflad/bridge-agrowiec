/**
 * Widok `/staging` — odtworzenie ekranu z oryginału
 * (`deminified/frontend-index.js:20616-20946`).
 *
 * ⚠ INACZEJ NIŻ KATALOG: ten widok jest STRONICOWANY PO STRONIE SERWERA. Katalog (I2)
 * pobiera całą tabelę jednym żądaniem i filtruje u siebie, bo `GET /api/products` nie zna
 * paginacji. Tutaj `GET /api/staging/paged` przyjmuje `page`, `limit`, `typZmiany` i `search`,
 * więc filtrowanie i szukanie idą do backendu — tak jak w oryginale.
 *
 * ⚠ POZYCJE AUTO-ZATWIERDZONE TU NIE TRAFIAJĄ. Import wpisuje je wprost do katalogu
 * (§3 roadmapy, „Staging auto-accept"), więc widok nie ma czego dla nich pokazywać i nie ma
 * ich liczyć. Ślad po nich zostaje w tabeli `historia_cen`, której czytelnika dowozi
 * Iteracja 10 (`/api/analytics/prices/product-history`) — NIE widok `/historia` z Iteracji 5.
 * Ten ostatni jest logiem zdarzeń z `audit_log` i pojedynczych auto-zatwierdzeń nie pokazuje.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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
import { SzczegolyPozycji } from "./staging/SzczegolyPozycji";
import { TabelaStagingu } from "./staging/TabelaStagingu";
import {
  OPCJE_FILTRA_TYPU,
  ROZMIARY_STRONY,
  adresStrony,
  odrzucPozycje,
  odrzucWszystkie,
  zatwierdzPozycje,
  zatwierdzWszystkie,
  type StronaStagingu,
} from "./staging/dane";

export function Staging() {
  const klient = useQueryClient();
  const [typZmiany, ustawTyp] = useState("all");
  const [szukaj, ustawSzukaj] = useState("");
  const [strona, ustawStrone] = useState(1);
  const [naStronie, ustawNaStronie] = useState<number>(ROZMIARY_STRONY[0]);
  const [zaznaczone, ustawZaznaczone] = useState<Set<number>>(new Set());
  const [szczegolyId, ustawSzczegolyId] = useState<number | null>(null);
  const [komunikat, ustawKomunikat] = useState<string | null>(null);

  // Zmiana filtra, szukanej frazy albo rozmiaru strony cofa na stronę 1 — inaczej łatwo
  // wylądować poza zakresem wyników i zobaczyć pustą tabelę, która wygląda jak brak danych.
  useEffect(() => {
    ustawStrone(1);
  }, [typZmiany, szukaj, naStronie]);

  const adres = adresStrony({ page: strona, limit: naStronie, typZmiany, search: szukaj });

  const { data, isLoading, isError } = useQuery<StronaStagingu | null>({
    // Klucz zawiera pełny adres z parametrami, więc każda kombinacja filtrów ma własny wpis
    // w cache, a `queryFn` z `queryClient.ts` skleja go w URL przez `queryKey.join("/")`.
    queryKey: [adres],
  });

  const pozycje = useMemo(() => data?.items ?? [], [data]);

  // Zaznaczenia nie przechodzą między stronami — akcja „zaznaczone" ma dotyczyć tego,
  // co użytkownik naprawdę widzi.
  useEffect(() => {
    ustawZaznaczone(new Set());
  }, [adres]);

  const odswiez = async () => {
    await klient.invalidateQueries({ queryKey: ["/api/staging"] });
    await klient.invalidateQueries({ queryKey: [adres] });
    // Akceptacja rusza katalog, więc oryginał unieważnia też `/api/products` (`fe.js:9131`).
    await klient.invalidateQueries({ queryKey: ["/api/products"] });
    ustawZaznaczone(new Set());
  };

  const akcja = useMutation({
    mutationFn: async (wykonaj: () => Promise<number>) => wykonaj(),
    onSuccess: async (ile: number) => {
      ustawKomunikat(`Przetworzono pozycji: ${ile}`);
      await odswiez();
    },
    onError: (e: Error) => ustawKomunikat(`Błąd: ${e.message}`),
  });

  const idWidoczne = pozycje.map((p) => p.id);
  const idZaznaczone = [...zaznaczone];

  const przelaczZaznaczenie = (id: number) =>
    ustawZaznaczone((poprzednie) => {
      const nowe = new Set(poprzednie);
      if (nowe.has(id)) nowe.delete(id);
      else nowe.add(id);
      return nowe;
    });

  const przelaczWszystkie = () =>
    ustawZaznaczone((poprzednie) =>
      idWidoczne.every((id) => poprzednie.has(id)) ? new Set() : new Set(idWidoczne),
    );

  const liczbaStron = data?.pages ?? 1;
  const razem = data?.total ?? 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Staging"
        subtitle="Pozycje z importu czekające na decyzję. Zmiany cen i stanów import zatwierdza sam — tutaj trafia to, co wymaga oka człowieka."
      />

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={typZmiany} onValueChange={ustawTyp}>
              <SelectTrigger className="w-56" data-testid="select-filter-type" aria-label="Typ sprawy">
                <SelectValue placeholder="Typ sprawy" />
              </SelectTrigger>
              <SelectContent>
                {OPCJE_FILTRA_TYPU.map(({ wartosc, etykieta }) => (
                  <SelectItem key={wartosc} value={wartosc}>
                    {etykieta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Szukaj po nazwie lub kodzie…"
                aria-label="Szukaj w stagingu"
                data-testid="input-search-staging"
                value={szukaj}
                onChange={(e) => ustawSzukaj(e.target.value)}
              />
            </div>
          </div>

          {/*
            Trzy warianty każdej akcji, jak w oryginale: ZAZNACZONE (`ids`), WIDOCZNE (`ids`
            z bieżącej strony) i WSZYSTKIE PRZEFILTROWANE (`allFiltered` + filtr typu).
            Ten trzeci nie ogląda się na paginację — dlatego pyta o potwierdzenie.
          */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              data-testid="button-accept-checked"
              disabled={idZaznaczone.length === 0 || akcja.isPending}
              onClick={() => akcja.mutate(() => zatwierdzPozycje(idZaznaczone))}
            >
              Akceptuj zaznaczone ({idZaznaczone.length})
            </Button>
            <Button
              size="sm"
              variant="outline"
              data-testid="button-accept-selected"
              disabled={idWidoczne.length === 0 || akcja.isPending}
              onClick={() => akcja.mutate(() => zatwierdzPozycje(idWidoczne))}
            >
              Akceptuj widoczne
            </Button>
            <Button
              size="sm"
              variant="outline"
              data-testid="button-accept-all"
              disabled={razem === 0 || akcja.isPending}
              onClick={() => {
                if (!confirm(`Zaakceptować wszystkie pasujące pozycje (${razem})?`)) return;
                akcja.mutate(() => zatwierdzWszystkie(typZmiany));
              }}
            >
              Akceptuj wszystkie ({razem})
            </Button>

            <span className="mx-1 h-5 w-px bg-border" />

            <Button
              size="sm"
              variant="outline"
              data-testid="button-reject-checked"
              disabled={idZaznaczone.length === 0 || akcja.isPending}
              onClick={() => akcja.mutate(() => odrzucPozycje(idZaznaczone))}
            >
              Odrzuć zaznaczone ({idZaznaczone.length})
            </Button>
            <Button
              size="sm"
              variant="outline"
              data-testid="button-reject-selected"
              disabled={idWidoczne.length === 0 || akcja.isPending}
              onClick={() => akcja.mutate(() => odrzucPozycje(idWidoczne))}
            >
              Odrzuć widoczne
            </Button>
            <Button
              size="sm"
              variant="destructive"
              data-testid="button-reject-all"
              disabled={razem === 0 || akcja.isPending}
              onClick={() => {
                if (!confirm(`Odrzucić wszystkie pasujące pozycje (${razem})?`)) return;
                akcja.mutate(() => odrzucWszystkie(typZmiany));
              }}
            >
              Odrzuć wszystkie ({razem})
            </Button>
          </div>

          {komunikat ? (
            <p className="text-sm text-muted-foreground" role="status" data-testid="komunikat-akcji">
              {komunikat}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isError ? (
            <p className="p-8 text-center text-sm text-destructive" role="alert">
              Nie udało się pobrać pozycji stagingu.
            </p>
          ) : (
            <TabelaStagingu
              pozycje={pozycje}
              zaznaczone={zaznaczone}
              przelaczZaznaczenie={przelaczZaznaczenie}
              przelaczWszystkie={przelaczWszystkie}
              otworzSzczegoly={ustawSzczegolyId}
              ladowanie={isLoading}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Na stronie:</span>
          {ROZMIARY_STRONY.map((rozmiar) => (
            <Button
              key={rozmiar}
              size="sm"
              variant={rozmiar === naStronie ? "default" : "outline"}
              data-testid={`button-page-size-${rozmiar}`}
              onClick={() => ustawNaStronie(rozmiar)}
            >
              {rozmiar}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2">
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
          <span className="text-muted-foreground" data-testid="info-strona">
            Strona {strona} z {liczbaStron} ({razem} pozycji)
          </span>
          <Button
            size="sm"
            variant="outline"
            data-testid="button-next-page"
            disabled={strona >= liczbaStron}
            onClick={() => ustawStrone((s) => s + 1)}
          >
            Następna
          </Button>
        </div>
      </div>

      <SzczegolyPozycji id={szczegolyId} zamknij={() => ustawSzczegolyId(null)} />
    </div>
  );
}
