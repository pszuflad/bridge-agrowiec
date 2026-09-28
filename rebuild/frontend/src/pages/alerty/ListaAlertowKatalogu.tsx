/**
 * Zakładka „Katalog" na `/alerty` — pseudo-alerty liczone z katalogu (karta P6.2, ticket
 * `77-FEATURE-pseudo-alerty-katalogowe`). Port widoku `HT()` z żywego bundla na `origin/main`.
 *
 * Co jest 1:1: reguły i ich teksty (silnik), filtr poziomu, ukrycie rozwiązanych w domyślnym
 * widoku, „Zaakceptuj wszystko" na widocznych, licznik „N alert/alertów", pusty stan, karta
 * z lewym paskiem dla `nowy` krytycznych/ostrzeżeń, plakietka poziomu, data `toLocaleString`,
 * plakietka surowego statusu, przyciski „Oznacz jako przejrzany" / „Rozwiąż".
 *
 * Świadome odstępstwa (plan P6.2): status na serwerze zamiast IndexedDB (decyzja 2) i zapis
 * od razu, bez debounce 300 ms; filtr statusu jak w zakładce „Import" (Q3); „Otwórz ponownie"
 * ze wspólnego komponentu P6.1 (Q4).
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, Info, TriangleAlert } from "lucide-react";
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
  FILTR_NIEROZWIAZANE,
  FILTRY_KATALOGU_POCZATKOWE,
  doZaakceptowania,
  filtrujAlertyKatalogu,
  podsumowanieKatalogu,
  type FiltryKatalogu,
} from "./filtry-katalogu";
import { KLUCZ_STATUSOW_KATALOGU, useAlertyKatalogu, zmienStatusyKatalogu } from "./katalog-api";
import { PrzyciskiStatusu } from "./PrzyciskiStatusu";
import type { AlertKatalogu, PoziomAlertuKatalogu } from "./silnik-katalogu";
import {
  ETYKIETY_STATUSU,
  STATUS_NOWY,
  STATUS_PRZEJRZANY,
  STATUS_ROZWIAZANY,
  type StatusAlertu,
} from "./statusy";

/** Wartość „bez zawężenia" w `Select` — Radix nie przyjmuje pustego stringa jako `value`. */
const WSZYSTKIE = "all";

/** Konkretne statusy w filtrze — te same trzy i te same etykiety co w zakładce „Import". */
const STATUSY_FILTRA: StatusAlertu[] = [STATUS_NOWY, STATUS_PRZEJRZANY, STATUS_ROZWIAZANY];

/** Plakietka poziomu — `KT()` oryginału. */
function PlakietkaPoziomu({ poziom }: { poziom: PoziomAlertuKatalogu }) {
  if (poziom === "krytyczny") {
    return (
      <Badge className="gap-1 bg-red-600 text-white hover:bg-red-600">
        <CircleAlert className="h-3 w-3" /> krytyczny
      </Badge>
    );
  }
  if (poziom === "ostrzezenie") {
    return (
      <Badge className="gap-1 bg-amber-600 text-white hover:bg-amber-600">
        <TriangleAlert className="h-3 w-3" /> ostrzeżenie
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <Info className="h-3 w-3" /> info
    </Badge>
  );
}

/** Lewy pasek tylko dla NOWYCH krytycznych i ostrzeżeń — jak w `HT()`. */
function klasaPaska(alert: AlertKatalogu): string {
  if (alert.status !== STATUS_NOWY) return "";
  if (alert.poziom === "krytyczny") return "border-l-4 border-l-red-600";
  if (alert.poziom === "ostrzezenie") return "border-l-4 border-l-amber-500";
  return "";
}

function wariantStatusu(status: string): "default" | "secondary" | "outline" {
  if (status === STATUS_NOWY) return "default";
  if (status === STATUS_PRZEJRZANY) return "secondary";
  return "outline";
}

export function ListaAlertowKatalogu() {
  const klient = useQueryClient();
  const { toast } = useToast();
  const [filtry, ustawFiltry] = useState<FiltryKatalogu>(FILTRY_KATALOGU_POCZATKOWE);
  const { alerty, ladowanie, blad } = useAlertyKatalogu();

  const zmiana = useMutation<number, Error, { ids: string[]; status: StatusAlertu }>({
    mutationFn: ({ ids, status }) => zmienStatusyKatalogu(ids, status),
    // Unieważnienie zamiast `window.dispatchEvent("alerty-statusy-updated")` oryginału —
    // Pulpit czyta ten sam klucz, więc odświeża się sam (łatki `ackalerts` pkt 2 i 3).
    onSettled: () => void klient.invalidateQueries({ queryKey: KLUCZ_STATUSOW_KATALOGU }),
    onSuccess: (zmienione) =>
      toast({
        title: zmienione === 1 ? "Status alertu zmieniony" : `Zmieniono status ${zmienione} alertów`,
      }),
    onError: (e) =>
      toast({ title: "Nie udało się zmienić statusu", description: e.message, variant: "destructive" }),
  });

  const zmien = (ids: string[], status: StatusAlertu) => {
    if (ids.length > 0) zmiana.mutate({ ids, status });
  };

  const wszystkie = useMemo(() => alerty ?? [], [alerty]);
  const widoczne = useMemo(() => filtrujAlertyKatalogu(wszystkie, filtry), [wszystkie, filtry]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground" data-testid="text-catalog-alerts-subtitle">
        {podsumowanieKatalogu(wszystkie)}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Filtry</span>
        <Select
          value={filtry.poziom ?? WSZYSTKIE}
          onValueChange={(v) =>
            ustawFiltry((p) => ({ ...p, poziom: v === WSZYSTKIE ? null : (v as PoziomAlertuKatalogu) }))
          }
        >
          <SelectTrigger className="w-44" data-testid="select-level" aria-label="Poziom">
            <SelectValue placeholder="Poziom" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={WSZYSTKIE}>Wszystkie poziomy</SelectItem>
            <SelectItem value="krytyczny">Krytyczny</SelectItem>
            <SelectItem value="ostrzezenie">Ostrzeżenie</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filtry.status ?? WSZYSTKIE}
          onValueChange={(v) => ustawFiltry((p) => ({ ...p, status: v === WSZYSTKIE ? null : v }))}
        >
          <SelectTrigger className="w-44" data-testid="select-status-alerts" aria-label="Status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FILTR_NIEROZWIAZANE}>Nierozwiązane</SelectItem>
            <SelectItem value={WSZYSTKIE}>Wszystkie statusy</SelectItem>
            {STATUSY_FILTRA.map((status) => (
              <SelectItem key={status} value={status}>
                {ETYKIETY_STATUSU[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={zmiana.isPending}
          data-testid="button-accept-all-alerts"
          onClick={() => zmien(doZaakceptowania(widoczne), STATUS_ROZWIAZANY)}
        >
          Zaakceptuj wszystko
        </Button>

        <div className="ml-auto font-mono text-xs text-muted-foreground" data-testid="text-catalog-alerts-count">
          {widoczne.length} {widoczne.length === 1 ? "alert" : "alertów"}
        </div>
      </div>

      {blad ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-destructive" role="alert">
            Nie udało się policzyć alertów katalogu.
          </CardContent>
        </Card>
      ) : ladowanie || alerty === null ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Liczenie alertów z katalogu…
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {widoczne.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Brak alertów spełniających filtr.
              </CardContent>
            </Card>
          ) : null}
          {widoczne.map((alert) => (
            <Card key={alert.id} className={klasaPaska(alert)} data-testid={`row-catalog-alert-${alert.id}`}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="shrink-0">
                  <PlakietkaPoziomu poziom={alert.poziom} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{alert.typ}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{alert.opis}</div>
                  <div className="mt-1.5 flex gap-3 font-mono text-[11px] text-muted-foreground">
                    <span>{new Date(alert.data).toLocaleString("pl-PL")}</span>
                    {alert.dostawca ? <span>· dostawca {alert.dostawca}</span> : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={wariantStatusu(alert.status)} className="text-[10px]">
                    {alert.status}
                  </Badge>
                  <PrzyciskiStatusu
                    status={alert.status}
                    liczba={1}
                    zablokowane={zmiana.isPending}
                    testId={alert.id}
                    onZmien={(cel) => zmien([alert.id], cel)}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
