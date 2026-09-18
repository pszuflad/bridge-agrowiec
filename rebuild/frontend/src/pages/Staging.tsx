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
import { Check, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { DialogPotwierdzenia } from "@/components/DialogPotwierdzenia";
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
import { KonfiguratorKolumn } from "./staging/KonfiguratorKolumn";
import { SzczegolyPozycji } from "./staging/SzczegolyPozycji";
import { TabelaStagingu } from "./staging/TabelaStagingu";
import { wczytajKolumny, zapiszKolumny, type WidocznoscKolumn } from "./staging/kolumny";
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
  /*
    ⭐ „nowa", nie „all" — 1:1 z oryginałem (`fe.js:20617`).
    To nie jest kosmetyka: filtr steruje zakresem przycisków „Akceptuj/Odrzuć wszystkie (N)",
    bo `allFiltered` leci z bieżącą wartością `typZmiany`. Domyślnie akcja masowa dotyczy
    więc TYLKO nowych produktów, a nie całego stagingu razem z błędami i wycofaniami —
    i właśnie to chroni przed zatwierdzeniem wszystkiego jednym kliknięciem.
  */
  const [typZmiany, ustawTyp] = useState("nowa");
  const [szukaj, ustawSzukaj] = useState("");
  const [strona, ustawStrone] = useState(1);
  const [naStronie, ustawNaStronie] = useState<number>(ROZMIARY_STRONY[0]);
  const [zaznaczone, ustawZaznaczone] = useState<Set<number>>(new Set());
  const [szczegolyId, ustawSzczegolyId] = useState<number | null>(null);
  const [komunikat, ustawKomunikat] = useState<string | null>(null);
  /**
   * Która z dwóch operacji masowych czeka na potwierdzenie (`null` = żadna).
   *
   * ODSTĘPSTWO ŚWIADOME (finalny audyt 12e, D5, backlog #51): oryginał pyta natywnym
   * `confirm()`, tak jak przed 7b robiła to cała odbudowa. Treści pytań przenosimy DOSŁOWNIE,
   * zmienia się wyłącznie nośnik — ten sam wzorzec co D2 z 7b, D6 z narzutów i D1 z 12c.
   */
  const [doPotwierdzenia, ustawDoPotwierdzenia] = useState<"akceptuj" | "odrzuc" | null>(null);

  /*
    Wybór kolumn z konfiguratora. Czytamy go RAZ przy montowaniu (leniwy inicjalizator),
    tak jak oryginał czytał `loadPrefs()` przy starcie skryptu (`fe.js:29122`).
    Zapis idzie do `localStorage` pod kluczem oryginału — patrz `staging/kolumny.ts`.
  */
  const [widoczneKolumny, ustawWidoczneKolumny] = useState<WidocznoscKolumn>(wczytajKolumny);

  const zmienKolumny = (nowe: WidocznoscKolumn) => {
    ustawWidoczneKolumny(nowe);
    zapiszKolumny(nowe);
  };

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
      {/*
        Nagłówek 1:1 z oryginałem (`fe.js:20679-20706`), razem z akcjami masowymi w `actions`.
        Oryginał trzyma „Akceptuj/Odrzuć wszystkie (N)" WŁAŚNIE TUTAJ, a nie w pasku — pasek
        dostaje tylko warianty „zaznaczone" i „widoczne".

        ⚠ Nazwy `data-testid` zostają w konwencji odbudowy (`button-accept-all` = „wszystkie").
        W oryginale są semantycznie zamienione — tam „Akceptuj wszystkie" ma
        `button-accept-selected`, a „Akceptuj widoczne" ma `button-accept-all`. To ŚWIADOME
        odstępstwo (D4 przy 14b): atrybut nie jest widoczny dla użytkownika, a wierność
        utrwaliłaby mylącą nazwę w naszym kodzie. Jedyne miejsce, gdzie ta zamiana ma skutek,
        to pozycja przycisku „Kolumny" — i ona jest odtworzona, patrz `KonfiguratorKolumn`.
      */}
      <PageHeader
        title="Staging — zmiany do akceptacji"
        subtitle="Do decyzji Marty trafiają tylko nowe, wycofane, błędne i kluczowo zmienione pozycje. Cena i stan aktualizują katalog automatycznie."
        actions={
          <>
            <Button
              data-testid="button-accept-all"
              disabled={razem === 0 || akcja.isPending}
              onClick={() => ustawDoPotwierdzenia("akceptuj")}
            >
              <Check className="mr-2 h-4 w-4" /> Akceptuj wszystkie ({razem})
            </Button>
            <Button
              variant="outline"
              data-testid="button-reject-all"
              disabled={razem === 0 || akcja.isPending}
              onClick={() => ustawDoPotwierdzenia("odrzuc")}
            >
              <X className="mr-2 h-4 w-4" /> Odrzuć wszystkie ({razem})
            </Button>
          </>
        }
      />

      {/*
        Pasek narzędzi — jeden rząd, POZA kartą, dokładnie jak w oryginale
        (`fe.js:20707-20770`, `div.flex.items-center.gap-3.mb-4`). Kolejność:
        szukajka → „Typ sprawy" → select → licznik zmian → (do prawej) akcje na zaznaczonych
        i widocznych. Odbudowa trzymała to wcześniej w karcie i w dwóch rzędach.
      */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8 font-mono text-sm"
            /* Trzy kropki ASCII, nie wielokropek — tak ma oryginał (`fe.js:20714`). */
            placeholder="Szukaj po kodzie, nazwie, dostawcy lub EAN..."
            aria-label="Szukaj w stagingu"
            data-testid="input-search-staging"
            value={szukaj}
            onChange={(e) => ustawSzukaj(e.target.value)}
          />
        </div>

        <span className="text-xs uppercase tracking-wide text-muted-foreground">Typ sprawy</span>

        <Select value={typZmiany} onValueChange={ustawTyp}>
          <SelectTrigger className="w-64" data-testid="select-filter-type" aria-label="Typ sprawy">
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

        {/* Liczebnik jak w oryginale: „1 zmiana", poza tym „N zmian" (`fe.js:20738`). */}
        <div className="font-mono text-xs text-muted-foreground" data-testid="licznik-zmian">
          {razem} {razem === 1 ? "zmiana" : "zmian"}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/*
            Oryginał RENDERUJE te dwa przyciski tylko przy niepustym zaznaczeniu
            (`n.size > 0 && …`), zamiast pokazywać je wyszarzone. Odbudowa trzymała je
            zawsze — stąd uwaga Ani, że pasek wygląda inaczej.
          */}
          {idZaznaczone.length > 0 ? (
            <>
              <Button
                size="sm"
                data-testid="button-accept-checked"
                disabled={akcja.isPending}
                onClick={() => akcja.mutate(() => zatwierdzPozycje(idZaznaczone))}
              >
                Akceptuj zaznaczone ({idZaznaczone.length})
              </Button>
              <Button
                size="sm"
                variant="outline"
                data-testid="button-reject-checked"
                disabled={akcja.isPending}
                onClick={() => akcja.mutate(() => odrzucPozycje(idZaznaczone))}
              >
                Odrzuć zaznaczone ({idZaznaczone.length})
              </Button>
            </>
          ) : null}

          <KonfiguratorKolumn widoczne={widoczneKolumny} onZmiana={zmienKolumny} />

          <Button
            size="sm"
            variant="ghost"
            data-testid="button-accept-selected"
            disabled={idWidoczne.length === 0 || akcja.isPending}
            onClick={() => akcja.mutate(() => zatwierdzPozycje(idWidoczne))}
          >
            Akceptuj widoczne
          </Button>
          <Button
            size="sm"
            variant="ghost"
            data-testid="button-reject-selected"
            disabled={idWidoczne.length === 0 || akcja.isPending}
            onClick={() => akcja.mutate(() => odrzucPozycje(idWidoczne))}
          >
            Odrzuć widoczne
          </Button>
        </div>
      </div>

      {komunikat ? (
        <p className="mb-2 text-sm text-muted-foreground" role="status" data-testid="komunikat-akcji">
          {komunikat}
        </p>
      ) : null}

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
              widoczneKolumny={widoczneKolumny}
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

      {/* Teksty DOSŁOWNIE takie, jakie stały w `confirm()` do 12e — parytet treści zostaje. */}
      <DialogPotwierdzenia
        otwarty={doPotwierdzenia === "akceptuj"}
        tytul="Akceptacja wszystkich pozycji"
        tresc={`Zaakceptować wszystkie pasujące pozycje (${razem})?`}
        etykietaPotwierdzenia="Akceptuj wszystkie"
        zajety={akcja.isPending}
        onPotwierdz={() => {
          ustawDoPotwierdzenia(null);
          akcja.mutate(() => zatwierdzWszystkie(typZmiany));
        }}
        onZamknij={() => ustawDoPotwierdzenia(null)}
        testId="dialog-akceptuj-wszystkie"
      />

      <DialogPotwierdzenia
        otwarty={doPotwierdzenia === "odrzuc"}
        tytul="Odrzucenie wszystkich pozycji"
        tresc={`Odrzucić wszystkie pasujące pozycje (${razem})?`}
        etykietaPotwierdzenia="Odrzuć wszystkie"
        wariantPotwierdzenia="destructive"
        zajety={akcja.isPending}
        onPotwierdz={() => {
          ustawDoPotwierdzenia(null);
          akcja.mutate(() => odrzucWszystkie(typZmiany));
        }}
        onZamknij={() => ustawDoPotwierdzenia(null)}
        testId="dialog-odrzuc-wszystkie"
      />
    </div>
  );
}
