/**
 * Pulpit `/` — strona główna, port `N2` (`deminified/frontend-index.js:16836-17090`).
 * Ostatni placeholder Iteracji 10; blok 10f (ticket `26-FEATURE-analityka-export-pulpit`).
 *
 * Trzy poziomy, w kolejności oryginału:
 *   1. cztery kafle KPI (klikalne, z trendem) — liczone KLIENTEM z `/api/products`
 *      i `/api/staging`, nie z analityki;
 *   2. karta „Najnowsze powiadomienia" — dwie sekcje (Import / Katalog), w każdej najwyżej pięć
 *      alertów; renderowana TYLKO gdy jakieś są;
 *   3. karta „Ostatnia aktywność dostawców" — dziewięć kolumn z `/api/suppliers`.
 *
 * ─── ŚWIADOME ODSTĘPSTWO (decyzja 3 użytkownika z 2026-09-21, karta P6.2) ─────────────
 *  • Alerty pochodzą z DWÓCH źródeł: realnych alertów importu (`GET /api/alerts`, Iteracja 6 —
 *    wcześniejsze O-10f-1) ORAZ pseudo-alertów katalogowych liczonych klientem (`pv()`, port
 *    w `pages/alerty/silnik-katalogu.ts`) — oryginał miał tylko te drugie. Dobór (poziom +
 *    status `nowy`), sortowanie i limit pięciu zostają portem 1:1, osobno dla każdego źródła.
 *  • Kafel „Aktywne alerty" liczy `nowy` z OBU źródeł; podpis „N krytycznych" też łącznie
 *    (alerty importu nie mają poziomu `krytyczny`, więc w praktyce to krytyczne z katalogu).
 *  • Zmiana statusu na `/alerty` odświeża Pulpit przez unieważnienie zapytań (wspólne klucze
 *    react-query) — odpowiednik łatek `ackalerts` pkt 2 i 3 bez `window.dispatchEvent`.
 *    Uzasadnienie: `docs/rebuild-backlog.md` #26.
 *
 * ─── ŚWIADOME ODSTĘPSTWO (backlog #34, decyzja Ani 2026-09-21; karta P10.2, ticket 96) ───
 *  • Kafel „Ostatni eksport CSV" pokazuje prawdziwe dane. W produkcji jest TRWALE MARTWY —
 *    szuka `typ === "eksport"` w `GET /api/history`, której wiersze (tabela `history`) pola
 *    `typ` nie mają. Tutaj czyta najnowszy eksport i import z `GET /api/history/paged`
 *    (`audit_log`), a `GET /api/history` Pulpit przestał wołać — kafel był jedynym
 *    odbiorcą tej odpowiedzi. Teksty i format daty 1:1; nowy jest tylko podpis przy błędzie zapytania.
 *    Szczegóły: `pages/pulpit/kpi.ts`, nagłówek `opisKafelkaEksportu`.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, CircleAlert, CircleCheck, Info, Inbox, Package, TriangleAlert } from "lucide-react";
import { Link } from "wouter";

import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { pobierzAlerty, type Alert } from "@/pages/alerty/api";
import { useAlertyKatalogu } from "@/pages/alerty/katalog-api";
import type { AlertKatalogu } from "@/pages/alerty/silnik-katalogu";
import { adresZakladki, ZAKLADKA_IMPORT, ZAKLADKA_KATALOG } from "@/pages/alerty/zakladki";
import {
  useDostawcy,
  useOstatniWpisHistorii,
  useProdukty,
  useStaging,
} from "@/pages/pulpit/api";
import { formatujDate, formatujDateZGodzina, sformatujWzglednie } from "@/pages/pulpit/czas";
import { KafelKpi } from "@/pages/pulpit/KafelKpi";
import {
  aktywneAlerty,
  czyDzisiaj,
  czyWTymTygodniu,
  najswiezszeAlerty,
  opisKafelkaEksportu,
  sortujDostawcowPoKodzie,
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

/**
 * Jedna sekcja karty „Najnowsze powiadomienia" — wiersz 1:1 z `:16918-16975`, osobno dla
 * każdego źródła alertów. Pusta sekcja się nie renderuje.
 */
function SekcjaPowiadomien<A extends Alert | AlertKatalogu>({
  tytul,
  testId,
  alerty,
  href,
  testIdWiersza,
  blad = null,
}: {
  tytul: string;
  testId: string;
  alerty: A[];
  href: string;
  testIdWiersza: (alert: A) => string;
  /** Komunikat zamiast listy, gdy źródła nie dało się wczytać. */
  blad?: string | null;
}) {
  if (alerty.length === 0 && !blad) return null;
  return (
    <section className="border-b border-border last:border-b-0" data-testid={testId}>
      <h4 className="bg-muted/40 px-5 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {tytul}
      </h4>
      {blad ? (
        <p className="px-5 py-3 text-xs text-destructive" role="alert">
          {blad}
        </p>
      ) : null}
      <div className="divide-y divide-border">
        {alerty.map((alert) => (
          <Link key={alert.id} href={href}>
            <div
              className="flex cursor-pointer items-start gap-3 px-5 py-3 hover:bg-muted/30"
              data-testid={testIdWiersza(alert)}
            >
              <div className="mt-0.5 flex-shrink-0">
                <IkonaPoziomu poziom={alert.poziom} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{alert.typ}</div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">{alert.opis}</div>
              </div>
              <div className="flex-shrink-0 font-mono text-[11px] text-muted-foreground">
                {alert.dostawca && <span className="mr-2">{alert.dostawca}</span>}
                {sformatujWzglednie(alert.data)}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function Pulpit() {
  const { data: produkty } = useProdukty();
  const { data: staging } = useStaging();
  const { data: dostawcy } = useDostawcy();
  // Dwa zapytania, nie jedno `typ=all`: najnowszy wpis Historii bywa edycją produktu.
  const eksporty = useOstatniWpisHistorii("eksport");
  const importy = useOstatniWpisHistorii("import");

  // Reużycie klienta z Iteracji 6 — ten sam `queryKey`, więc widok `/alerty` i Pulpit
  // dzielą jeden wpis w cache'u zamiast pobierać listę dwa razy.
  const { data: alerty } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
    queryFn: pobierzAlerty,
  });

  // Pseudo-alerty katalogowe (P6.2) — liczone z tego samego `["/api/products"]`, które Pulpit
  // i tak pobiera, więc nie dokładają żądania katalogu (tylko ~25 ms liczenia na 7405 produktach).
  // Gdy katalog albo statusy padną, sekcja „Katalog" mówi to wprost — cichy fallback do zera
  // wyglądałby na Pulpicie jak „katalog jest czysty".
  const { alerty: alertyKatalogu, blad: bladKatalogu } = useAlertyKatalogu();

  const aktywneImport = useMemo(() => aktywneAlerty(alerty), [alerty]);
  const aktywneKatalog = useMemo(() => aktywneAlerty(alertyKatalogu), [alertyKatalogu]);
  const najswiezszeImport = useMemo(() => najswiezszeAlerty(aktywneImport), [aktywneImport]);
  const najswiezszeKatalog = useMemo(() => najswiezszeAlerty(aktywneKatalog), [aktywneKatalog]);
  const liczbaAktywnych = aktywneImport.length + aktywneKatalog.length;

  const liczbaProduktow = produkty?.length ?? 0;
  const noweProdukty = (produkty ?? []).filter((p) =>
    czyWTymTygodniu(p.dataAktualizacji as string | null),
  ).length;
  const liczbaStagingu = staging?.length ?? 0;
  const noweStaging = (staging ?? []).filter((p) => czyDzisiaj(p.utworzono)).length;

  const kafelEksportu = opisKafelkaEksportu(
    { strona: eksporty.data, blad: eksporty.isError },
    { strona: importy.data, blad: importy.isError },
  );

  const krytyczne = [...aktywneImport, ...aktywneKatalog].filter(
    (a) => a.poziom === "krytyczny",
  ).length;

  return (
    <>
      {/* Rama z sidebarem (AppShell) wpinana jest przez ROUTER — patrz `App.tsx`,
          `TRASY_Z_RAMA`. Do 12e każdy widok zawijał się w nią sam, tak jak `mn()`
          w oryginale, ale robiło to tylko 5 z 12 widoków (backlog #36). */}
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
          wartosc={liczbaAktywnych}
          zmiana={{
            kierunek: liczbaAktywnych > 0 ? "up" : "none",
            text: liczbaAktywnych === 0 ? "Brak alertów" : `${krytyczne} krytycznych`,
          }}
          testId="kpi-alerts"
          href="/alerty"
        />
        <KafelKpi
          ikona={CircleCheck}
          label="Ostatni eksport CSV"
          wartosc={kafelEksportu.wartosc}
          zmiana={kafelEksportu.zmiana}
          testId="kpi-export"
          href="/historia"
        />
      </div>

      {/* Karty nie ma wcale, gdy nie ma alertów — `o.length > 0 && …` (`:16918`); sekcja
          źródła bez alertów też znika. */}
      {(najswiezszeImport.length > 0 || najswiezszeKatalog.length > 0 || bladKatalogu) && (
        <Card className="mb-6 border-card-border" data-testid="card-recent-alerts">
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-medium">
                  <Bell className="h-4 w-4 text-amber-600" />
                  Najnowsze powiadomienia
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {liczbaAktywnych} aktywnych alertów łącznie
                </p>
              </div>
              <Link href="/alerty">
                <Button variant="outline" size="sm" data-testid="link-all-alerts">
                  Zobacz wszystkie
                </Button>
              </Link>
            </div>

            <SekcjaPowiadomien
              tytul="Import"
              testId="section-recent-alerts-import"
              alerty={najswiezszeImport}
              href={adresZakladki(ZAKLADKA_IMPORT)}
              testIdWiersza={(a: Alert) => `row-dashboard-alert-${a.id}`}
            />
            <SekcjaPowiadomien
              tytul="Katalog"
              testId="section-recent-alerts-katalog"
              alerty={najswiezszeKatalog}
              href={adresZakladki(ZAKLADKA_KATALOG)}
              testIdWiersza={(a: AlertKatalogu) => `row-dashboard-catalog-alert-${a.id}`}
              blad={bladKatalogu ? "Nie udało się policzyć alertów katalogu." : null}
            />
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
    </>
  );
}
