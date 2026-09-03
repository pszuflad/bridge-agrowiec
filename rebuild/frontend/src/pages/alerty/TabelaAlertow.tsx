/**
 * Lista alertów ZWINIĘTA DO GRUP — wymóg Iteracji 6, nie ozdobnik.
 *
 * Jeden wiersz = jedna grupa `(dostawca, typ, status)` z licznikiem powtórzeń i czasem
 * ostatniego wystąpienia; pojedyncze wpisy pokazują się dopiero po rozwinięciu. Powód
 * i skala: nagłówek `grupowanie.ts`.
 *
 * ⚠ TO NIE JEST PORT UI ORYGINAŁU (odstępstwo D1 planu). Oryginalny `/alerty`
 * (`deminified/frontend-index.js:25177-25340`, `HT()`) w ogóle nie woła `/api/alerts` —
 * liczy pseudo-alerty z `GET /api/products` (marża ujemna, niska marża, „nie-opona")
 * i trzyma ich stan w IndexedDB. Ten widok stoi na realnych alertach importu, bo to one
 * niosą informację o tym, co się w nocy zepsuło. Pominięte pseudo-alerty katalogowe
 * czekają na decyzję w `docs/rebuild-backlog.md`.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, ChevronRight, CircleAlert, Info } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
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
import {
  pobierzAlerty,
  zmienStatusAlertow,
  STATUS_NOWY,
  STATUS_ROZWIAZANY,
  type Alert,
  type WynikZmianyGrupowej,
} from "./api";
import {
  FILTRY_POCZATKOWE,
  filtrujAlerty,
  pogrupujAlerty,
  sformatujOstatnia,
  wartosciFiltrow,
  type FiltryAlertow,
  type GrupaAlertow,
} from "./grupowanie";

/** Wartość „bez zawężenia" w `Select` — Radix nie przyjmuje pustego stringa jako `value`. */
const WSZYSTKIE = "all";

/** Ikona i kolor po `poziom`. Realnie występują `info` i `ostrzezenie`; `blad` — na zapas. */
function ikonaPoziomu(poziom: string) {
  if (poziom === "blad") return <CircleAlert className="h-4 w-4 shrink-0 text-destructive" />;
  if (poziom === "ostrzezenie")
    return <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />;
  return <Info className="h-4 w-4 shrink-0 text-muted-foreground" />;
}

/**
 * Odmiana rzeczownika przez liczbę po polsku: 1 grupa, 2 grupy, 5 grup.
 * Reguła: końcówka 2-4 (poza nastkami 12-14) bierze formę mnogą „lekką".
 */
function odmien(ile: number, jedna: string, dwie: string, wiele: string): string {
  const ostatnia = ile % 10;
  const dwieOstatnie = ile % 100;
  if (ile === 1) return `1 ${jedna}`;
  if (ostatnia >= 2 && ostatnia <= 4 && (dwieOstatnie < 12 || dwieOstatnie > 14))
    return `${ile} ${dwie}`;
  return `${ile} ${wiele}`;
}

/** Docelowy status akcji: to przełącznik w obie strony, nie jednokierunkowe „zamknij". */
function przeciwnyStatus(status: string): string {
  return status === STATUS_ROZWIAZANY ? STATUS_NOWY : STATUS_ROZWIAZANY;
}

function etykietaAkcji(status: string, liczba: number): string {
  const kierunek = status === STATUS_ROZWIAZANY ? "Otwórz ponownie" : "Oznacz jako rozwiązane";
  return liczba > 1 ? `${kierunek} (${liczba})` : kierunek;
}

export function TabelaAlertow() {
  const klient = useQueryClient();
  const { toast } = useToast();
  const [filtry, ustawFiltry] = useState<FiltryAlertow>(FILTRY_POCZATKOWE);
  const [rozwiniete, ustawRozwiniete] = useState<ReadonlySet<string>>(new Set());

  const {
    data: alerty = [],
    isLoading,
    isError,
  } = useQuery<Alert[]>({ queryKey: ["/api/alerts"], queryFn: pobierzAlerty });

  /**
   * Zmiana statusu idzie PRZEZ API (decyzja D3 planu), nie do przeglądarki — inaczej
   * niż w oryginale, który trzymał obsługę alertu w IndexedDB. Dzięki temu alert
   * zamknięty na laptopie jest zamknięty także w telefonie i po wyczyszczeniu cache.
   */
  const zmiana = useMutation<WynikZmianyGrupowej, Error, { idki: number[]; status: string }>({
    mutationFn: ({ idki, status }) => zmienStatusAlertow(idki, status),
    // Invalidacja leci ZAWSZE, także po błędzie: przy akcji na grupie część PATCH-ów
    // mogła przejść, więc lista musi się przeładować, żeby nie kłamać licznikami.
    onSettled: () => void klient.invalidateQueries({ queryKey: ["/api/alerts"] }),
    onSuccess: ({ udane, blad }, { idki }) => {
      if (blad) {
        toast({
          title:
            udane === 0
              ? "Nie udało się zmienić statusu"
              : `Zmieniono ${udane} z ${idki.length} alertów`,
          description: blad.message,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: udane === 1 ? "Status alertu zmieniony" : `Zmieniono status ${udane} alertów`,
      });
    },
    onError: (e) =>
      toast({ title: "Nie udało się zmienić statusu", description: e.message, variant: "destructive" }),
  });

  const przelacz = (idki: number[], status: string) => zmiana.mutate({ idki, status });

  const przelaczRozwiniecie = (klucz: string) =>
    ustawRozwiniete((poprzednie) => {
      const nowe = new Set(poprzednie);
      if (!nowe.delete(klucz)) nowe.add(klucz);
      return nowe;
    });

  // Wartości filtrów liczymy z PEŁNEGO zbioru, nie z przefiltrowanego — inaczej wybranie
  // dostawcy wyczyściłoby listę pozostałych i nie dałoby się jej zmienić bez resetu.
  const dostepne = useMemo(() => wartosciFiltrow(alerty), [alerty]);

  // `useMemo` nie jest tu przedwczesną optymalizacją: rozwinięcie DOWOLNEJ grupy zmienia stan
  // komponentu, więc bez tego każde kliknięcie w chevron przeliczałoby grupowanie całego
  // zbioru od nowa. Dziś to ~3000 wierszy, ale scheduler z 3f-3 dokłada ~120 alertów na dobę.
  const widoczne = useMemo(() => filtrujAlerty(alerty, filtry), [alerty, filtry]);
  const grupy = useMemo(() => pogrupujAlerty(widoczne), [widoczne]);

  const ustawFiltr = (pole: keyof FiltryAlertow) => (wartosc: string) =>
    ustawFiltry((poprzednie) => ({
      ...poprzednie,
      [pole]: wartosc === WSZYSTKIE ? null : wartosc,
    }));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2.5 p-4">
          <Select value={filtry.status ?? WSZYSTKIE} onValueChange={ustawFiltr("status")}>
            <SelectTrigger className="w-44" data-testid="select-alert-status" aria-label="Status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={WSZYSTKIE}>Wszystkie statusy</SelectItem>
              {dostepne.statusy.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filtry.dostawca ?? WSZYSTKIE} onValueChange={ustawFiltr("dostawca")}>
            <SelectTrigger
              className="w-44"
              data-testid="select-alert-supplier"
              aria-label="Dostawca"
            >
              <SelectValue placeholder="Dostawca" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={WSZYSTKIE}>Wszyscy dostawcy</SelectItem>
              {dostepne.dostawcy.map((kod) => (
                <SelectItem key={kod} value={kod}>
                  {kod}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filtry.typ ?? WSZYSTKIE} onValueChange={ustawFiltr("typ")}>
            <SelectTrigger className="w-56" data-testid="select-alert-type" aria-label="Typ">
              <SelectValue placeholder="Typ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={WSZYSTKIE}>Wszystkie typy</SelectItem>
              {dostepne.typy.map((typ) => (
                <SelectItem key={typ} value={typ}>
                  {typ}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div
            className="ml-auto font-mono text-xs text-muted-foreground"
            data-testid="text-alert-summary"
          >
            {odmien(grupy.length, "grupa", "grupy", "grup")} /{" "}
            {odmien(widoczne.length, "alert", "alerty", "alertów")}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isError ? (
            <p className="p-8 text-center text-sm text-destructive" role="alert">
              Nie udało się pobrać alertów.
            </p>
          ) : isLoading ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Wczytywanie alertów…</p>
          ) : grupy.length === 0 ? (
            <p className="p-12 text-center text-sm text-muted-foreground">
              Brak alertów spełniających filtry.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {grupy.map((grupa) => (
                <WierszGrupy
                  key={grupa.klucz}
                  grupa={grupa}
                  rozwinieta={rozwiniete.has(grupa.klucz)}
                  onRozwin={() => przelaczRozwiniecie(grupa.klucz)}
                  onPrzelacz={przelacz}
                  zablokowane={zmiana.isPending}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function WierszGrupy({
  grupa,
  rozwinieta,
  onRozwin,
  onPrzelacz,
  zablokowane,
}: {
  grupa: GrupaAlertow;
  rozwinieta: boolean;
  onRozwin: () => void;
  onPrzelacz: (idki: number[], status: string) => void;
  zablokowane: boolean;
}) {
  // Grupa jednoelementowa nie ma czego rozwijać — pokazujemy `opis` od razu, bez strzałki.
  const powtorki = grupa.liczba > 1;
  const docelowy = przeciwnyStatus(grupa.status);

  return (
    <li data-testid={`group-alert-${grupa.klucz}`}>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-muted/30">
        {powtorki ? (
          <button
            type="button"
            onClick={onRozwin}
            aria-expanded={rozwinieta}
            aria-label={`${rozwinieta ? "Zwiń" : "Rozwiń"} grupę ${grupa.dostawca ?? "bez dostawcy"} — ${grupa.typ}`}
            className="flex items-center gap-1 text-left"
            data-testid={`button-expand-${grupa.klucz}`}
          >
            {rozwinieta ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            {ikonaPoziomu(grupa.poziom)}
          </button>
        ) : (
          <span className="flex items-center gap-1 pl-5">{ikonaPoziomu(grupa.poziom)}</span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {grupa.dostawca ? (
              <span className="font-mono text-sm font-medium">{grupa.dostawca}</span>
            ) : null}
            <span className="text-sm font-medium">{grupa.typ}</span>
            {powtorki ? (
              <Badge variant="secondary" data-testid={`badge-count-${grupa.klucz}`}>
                {grupa.liczba}×
              </Badge>
            ) : null}
            <Badge variant={grupa.status === STATUS_NOWY ? "default" : "outline"}>
              {grupa.status}
            </Badge>
          </div>
          {/* Jeden wpis: treść od razu. Powtórki: `opis` różni się między wpisami (np. błąd
              sieci vs błąd parsera w tym samym typie), więc pokazujemy go po rozwinięciu. */}
          {powtorki ? null : (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{grupa.wpisy[0]!.opis}</p>
          )}
        </div>

        <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
          ostatnio {sformatujOstatnia(grupa.ostatnia)}
        </span>

        <Button
          size="sm"
          variant="outline"
          disabled={zablokowane}
          data-testid={`button-toggle-${grupa.klucz}`}
          onClick={() =>
            onPrzelacz(
              grupa.wpisy.map((wpis) => wpis.id),
              docelowy,
            )
          }
        >
          {etykietaAkcji(grupa.status, grupa.liczba)}
        </Button>
      </div>

      {powtorki && rozwinieta ? (
        <ul className="border-t border-border bg-muted/20">
          {grupa.wpisy.map((wpis) => (
            <li
              key={wpis.id}
              className="flex flex-wrap items-center gap-3 px-4 py-2 pl-12"
              data-testid={`row-alert-${wpis.id}`}
            >
              <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                {sformatujOstatnia(wpis.data)}
              </span>
              <span className="min-w-0 flex-1 text-xs">{wpis.opis}</span>
              <Button
                size="sm"
                variant="ghost"
                disabled={zablokowane}
                data-testid={`button-toggle-alert-${wpis.id}`}
                onClick={() => onPrzelacz([wpis.id], przeciwnyStatus(wpis.status))}
              >
                {etykietaAkcji(wpis.status, 1)}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
