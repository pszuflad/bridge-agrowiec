/**
 * Pulpit `/` — strona główna, port `N2` (`deminified/frontend-index.js:16836-17090`).
 * Ostatni placeholder Iteracji 10; blok 10f (ticket `26-FEATURE-analityka-export-pulpit`).
 *
 * Trzy poziomy, w kolejności oryginału:
 *   1. cztery kafle KPI (klikalne, z trendem) — liczone KLIENTEM z `/api/products`
 *      i `/api/staging`, nie z analityki;
 *   2. karta „Najnowsze powiadomienia" — najwyżej pięć alertów, renderowana TYLKO gdy jakieś są;
 *   3. karta „Ostatnia aktywność dostawców" — dziewięć kolumn z `/api/suppliers`.
 *
 * ─── ŚWIADOME ODSTĘPSTWO (decyzja użytkownika D1, 2026-09-04) ─────────────────────────
 *  • O-10f-1 — alerty pochodzą z REALNEJ trasy `GET /api/alerts` (alerty importu, Iteracja 6),
 *    a nie z pseudo-alertów katalogowych liczonych klientem przez `pv()` (`:16631-16745`).
 *    Układ, dobór (poziom + status `nowy`), sortowanie i limit pięciu zostają portem 1:1 —
 *    zmienia się wyłącznie ŹRÓDŁO. Uzasadnienie i konsekwencje: `pages/pulpit/kpi.ts`
 *    (nagłówek `najswiezszeAlerty`) oraz `docs/rebuild-backlog.md` #26.
 *
 * ─── 1:1 Z ORYGINAŁEM, CHOĆ WYGLĄDA NA DEFEKT ────────────────────────────────────────
 *  • Kafel „Ostatni eksport CSV" jest TRWALE MARTWY (decyzja D3). Szuka `typ === "eksport"`
 *    w odpowiedzi `GET /api/history`, a ta trasa oddaje tabelę `history` — wiersze bez pola
 *    `typ`. Zawsze pokazuje „—" i „Brak eksportów ani importów". Szczegóły i droga naprawy:
 *    `pages/pulpit/kpi.ts`, nagłówek `znajdzPoTypie`.
 *  • `GET /api/history` zwraca dziś na stagingu `[]`, bo tabela `history` nie ma jeszcze
 *    pisarza (jedynym jest ręczna edycja produktu, jeszcze niesportowana). To NIE jest błąd
 *    i widok nie może go tak potraktować.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, CircleAlert, CircleCheck, Info, Inbox, Package, TriangleAlert } from "lucide-react";
import { Link } from "wouter";

import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { pobierzAlerty, type Alert } from "@/pages/alerty/api";
import { useDostawcy, useDziennikZmian, useProdukty, useStaging } from "@/pages/pulpit/api";
import { formatujDate, formatujDateZGodzina, sformatujWzglednie } from "@/pages/pulpit/czas";
import { KafelKpi } from "@/pages/pulpit/KafelKpi";
import {
  aktywneAlerty,
  czyDzisiaj,
  czyWTymTygodniu,
  najswiezszeAlerty,
  sortujDostawcowPoKodzie,
  znajdzPoTypie,
} from "@/pages/pulpit/kpi";

/** Ikona wiersza alertu — trzy poziomy, 1:1 z `:16960-16970`. */
function IkonaPoziomu({ poziom }: { poziom: string }) {
  if (poziom === "krytyczny") return <CircleAlert className="h-4 w-4 text-red-600" />;
  if (poziom === "ostrzezenie") return <TriangleAlert className="h-4 w-4 text-amber-600" />;
  return <Info className="h-4 w-4 text-muted-foreground" />;
}

/** Odznaka statusu dostawcy — trzy warianty, 1:1 z `:17074-17082`. */
function OdznakaStatusu({ status }: { status: string }) {
  if (status === "aktywny") {
    return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">OK</Badge>;
  }
  if (status === "blad") return <Badge variant="destructive">Błąd</Badge>;
  if (status === "wstrzymany") return <Badge variant="secondary">Wstrzymany</Badge>;
  return null;
}

export function Pulpit() {
  const { data: produkty } = useProdukty();
  const { data: staging } = useStaging();
  const { data: dostawcy } = useDostawcy();
  const { data: dziennik } = useDziennikZmian();

  // Reużycie klienta z Iteracji 6 — ten sam `queryKey`, więc widok `/alerty` i Pulpit
  // dzielą jeden wpis w cache'u zamiast pobierać listę dwa razy.
  const { data: alerty } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
    queryFn: pobierzAlerty,
  });

  const aktywne = useMemo(() => aktywneAlerty(alerty), [alerty]);
  const najswiezsze = useMemo(() => najswiezszeAlerty(aktywne), [aktywne]);

  const liczbaProduktow = produkty?.length ?? 0;
  const noweProdukty = (produkty ?? []).filter((p) =>
    czyWTymTygodniu(p.dataAktualizacji as string | null),
  ).length;
  const liczbaStagingu = staging?.length ?? 0;
  const noweStaging = (staging ?? []).filter((p) => czyDzisiaj(p.utworzono)).length;

  // Oba wychodzą `null` zawsze — patrz nagłówek pliku i `znajdzPoTypie`.
  const ostatniEksport = znajdzPoTypie(dziennik, "eksport");
  const ostatniImport = znajdzPoTypie(dziennik, "import");

  const krytyczne = aktywne.filter((a) => a.poziom === "krytyczny").length;

  return (
    // Rama aplikacji jest częścią tego widoku, nie routera — `N2` zwraca `mn(…)`, czyli
    // shell z sidebarem, i tak samo robi `WidokWPrzygotowaniu`, który stał tu przed 10f.
    <AppShell>
      <PageHeader title="Pulpit" subtitle="Codzienny obraz kanału dostawców i katalogu produktów" />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KafelKpi
          ikona={Package}
          label="Produkty w katalogu"
          wartosc={liczbaProduktow}
          zmiana={
            liczbaProduktow === 0
              ? { kierunek: "none", text: "Katalog jest pusty" }
              : noweProdukty > 0
                ? { kierunek: "up", text: `+${noweProdukty} w tym tygodniu` }
                : { kierunek: "none", text: "Brak nowych w tym tygodniu" }
          }
          testId="kpi-products"
          href="/katalog"
        />
        <KafelKpi
          ikona={Inbox}
          label="Oczekujące w staging"
          wartosc={liczbaStagingu}
          zmiana={
            liczbaStagingu === 0
              ? { kierunek: "none", text: "Staging pusty" }
              : noweStaging > 0
                ? { kierunek: "up", text: `+${noweStaging} nowych dziś` }
                : { kierunek: "none", text: "Bez nowych dziś" }
          }
          testId="kpi-staging"
          href="/staging"
        />
        <KafelKpi
          ikona={Bell}
          label="Aktywne alerty"
          wartosc={aktywne.length}
          zmiana={{
            kierunek: aktywne.length > 0 ? "up" : "none",
            text: aktywne.length === 0 ? "Brak alertów" : `${krytyczne} krytycznych`,
          }}
          testId="kpi-alerts"
          href="/alerty"
        />
        <KafelKpi
          ikona={CircleCheck}
          label="Ostatni eksport CSV"
          wartosc={ostatniEksport?.kiedy ? sformatujWzglednie(ostatniEksport.kiedy) : "—"}
          zmiana={
            ostatniEksport
              ? {
                  kierunek: "none",
                  text: `${ostatniEksport.dostawca ?? "wszyscy"} — ${ostatniEksport.liczbaPozycji ?? 0} produktów`,
                }
              : ostatniImport?.kiedy
                ? { kierunek: "none", text: `Ostatni import: ${sformatujWzglednie(ostatniImport.kiedy)}` }
                : { kierunek: "none", text: "Brak eksportów ani importów" }
          }
          testId="kpi-export"
          href="/historia"
        />
      </div>

      {/* Karty nie ma wcale, gdy nie ma alertów — `o.length > 0 && …` (`:16918`). */}
      {najswiezsze.length > 0 && (
        <Card className="mb-6 border-card-border" data-testid="card-recent-alerts">
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-medium">
                  <Bell className="h-4 w-4 text-amber-600" />
                  Najnowsze powiadomienia
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {aktywne.length} aktywnych alertów łącznie
                </p>
              </div>
              <Link href="/alerty">
                <Button variant="outline" size="sm" data-testid="link-all-alerts">
                  Zobacz wszystkie
                </Button>
              </Link>
            </div>

            <div className="divide-y divide-border">
              {najswiezsze.map((alert) => (
                <Link key={alert.id} href="/alerty">
                  <div
                    className="flex cursor-pointer items-start gap-3 px-5 py-3 hover:bg-muted/30"
                    data-testid={`row-dashboard-alert-${alert.id}`}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      <IkonaPoziomu poziom={alert.poziom} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{alert.typ}</div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {alert.opis}
                      </div>
                    </div>
                    <div className="flex-shrink-0 font-mono text-[11px] text-muted-foreground">
                      {alert.dostawca && <span className="mr-2">{alert.dostawca}</span>}
                      {sformatujWzglednie(alert.data)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-card-border">
        <CardContent className="p-0">
          <div className="border-b border-border px-5 py-4">
            <h3 className="text-sm font-medium">Ostatnia aktywność dostawców</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              10 dostawców M1–M10 monitorowanych przez Bridge
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="tabela-dostawcow-pulpit">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-2.5 font-medium">Kod</th>
                  <th className="px-5 py-2.5 font-medium">Dostawca</th>
                  <th className="px-5 py-2.5 font-medium">Email</th>
                  <th className="px-5 py-2.5 font-medium">Format</th>
                  <th className="px-5 py-2.5 font-medium">Ostatni plik</th>
                  <th className="px-5 py-2.5 font-medium">Ostatnia aktualizacja ceny</th>
                  <th className="px-5 py-2.5 font-medium">
                    Ostatnia aktualizacja stanu magazynowego
                  </th>
                  <th className="px-5 py-2.5 text-right font-medium">Produkty</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {sortujDostawcowPoKodzie(dostawcy ?? []).map((dostawca) => (
                  <tr
                    key={dostawca.id}
                    className="border-t border-border hover:bg-muted/30"
                    data-testid={`row-supplier-${dostawca.kod}`}
                  >
                    <td className="px-5 py-2.5 font-mono font-medium">{dostawca.kod}</td>
                    <td className="px-5 py-2.5">{dostawca.nazwa}</td>
                    <td className="px-5 py-2.5 font-mono text-xs text-muted-foreground">
                      {dostawca.email}
                    </td>
                    <td className="px-5 py-2.5">
                      <Badge variant="outline" className="font-mono">
                        {dostawca.formatPliku?.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-5 py-2.5 font-mono text-xs text-muted-foreground">
                      {formatujDate(dostawca.ostatniPlik)}
                    </td>
                    <td className="px-5 py-2.5 font-mono text-xs text-muted-foreground">
                      {formatujDateZGodzina(dostawca.ostatniaAktualizacjaCeny)}
                    </td>
                    <td className="px-5 py-2.5 font-mono text-xs text-muted-foreground">
                      {formatujDateZGodzina(dostawca.ostatniaAktualizacjaStanu)}
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono tabular-nums">
                      {dostawca.liczbaProduktow}
                    </td>
                    <td className="px-5 py-2.5">
                      <OdznakaStatusu status={dostawca.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
