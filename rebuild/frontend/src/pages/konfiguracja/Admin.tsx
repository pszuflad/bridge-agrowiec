/**
 * Zakładka „Admin" w `/konfiguracja` — dostawcy (konfiguracja + statystyki), użytkownicy
 * i utrzymanie katalogu.
 *
 * ⚠ TA ZAKŁADKA NIE ISTNIEJE W ORYGINALE (plan.md D1, świadome odstępstwo zatwierdzone przez
 * użytkownika). Produkcja obsługuje te cztery trasy serwerowymi stronami HTML poza React SPA
 * (`extensions.cjs:290-295,410-415`), więc nie ma tu czego odtwarzać 1:1 — jest za to kontrakt,
 * i to on wyznacza, co pokazujemy. Zachowanie SAMYCH TRAS pozostaje portem 1:1.
 *
 * ⚠ „Admin" nie znaczy „inne uprawnienia": tabela `users` nie ma kolumny roli
 * (`rebuild/schema/001_schema.sql`), więc zakładkę widzi każdy zalogowany. To stan zastany,
 * nie decyzja tej sesji — patrz `docs/rebuild-backlog.md`.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import {
  pobierzKonfiguracjeDostawcow,
  pobierzListeDostawcow,
  pobierzUzytkownikow,
  usunNieOpony,
  zapiszKonfiguracjeDostawcy,
  type KonfiguracjaDostawcy,
  type ZmianaDostawcy,
} from "./admin";
import { DialogKonfiguracjiDostawcy } from "./DialogKonfiguracjiDostawcy";

const KLUCZ_KONFIGURACJI = ["/api/admin/supplier-config"];
const KLUCZ_LISTY = ["/api/admin/suppliers-list"];

/** ISO 8601 → `dd.mm.rrrr, gg:mm`; `null` → „—". */
function sformatujDate(iso: string | null): string {
  if (!iso) return "—";
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? iso : data.toLocaleString("pl-PL");
}

export function Admin() {
  const { toast } = useToast();
  const klientZapytan = useQueryClient();
  const [edytowany, ustawEdytowanego] = useState<KonfiguracjaDostawcy | null>(null);
  const [bladZapisu, ustawBladZapisu] = useState<string | null>(null);

  const konfiguracja = useQuery({
    queryKey: KLUCZ_KONFIGURACJI,
    queryFn: pobierzKonfiguracjeDostawcow,
  });
  const lista = useQuery({ queryKey: KLUCZ_LISTY, queryFn: pobierzListeDostawcow });
  const uzytkownicy = useQuery({ queryKey: ["/api/users"], queryFn: pobierzUzytkownikow });

  const zapis = useMutation({
    mutationFn: ({ kod, zmiana }: { kod: string; zmiana: ZmianaDostawcy }) =>
      zapiszKonfiguracjeDostawcy(kod, zmiana),
    onSuccess: () => {
      toast({ title: "Zapisano", description: "Konfiguracja dostawcy zaktualizowana." });
      ustawEdytowanego(null);
      ustawBladZapisu(null);
      // Obie listy czytają te same kolumny `suppliers`, więc obie muszą się odświeżyć.
      void klientZapytan.invalidateQueries({ queryKey: KLUCZ_KONFIGURACJI });
      void klientZapytan.invalidateQueries({ queryKey: KLUCZ_LISTY });
    },
    onError: (blad: unknown) => {
      ustawBladZapisu(blad instanceof Error ? blad.message : String(blad));
    },
  });

  const czyszczenieNieOpon = useMutation({
    mutationFn: usunNieOpony,
    onSuccess: (wynik) => {
      toast({
        title: "Usunięto pozycje, które nie są oponami",
        description: `Usuniętych: ${wynik.usuniete}`,
      });
      void klientZapytan.invalidateQueries({ queryKey: ["/api/products"] });
      void klientZapytan.invalidateQueries({ queryKey: ["/api/analytics"] });
      void klientZapytan.invalidateQueries({ queryKey: KLUCZ_LISTY });
    },
    onError: (blad: unknown) => {
      toast({
        title: "Błąd usuwania",
        description: blad instanceof Error ? blad.message : String(blad),
        variant: "destructive",
      });
    },
  });

  /**
   * Scalenie obu tras dostawców w jeden wiersz tabeli: `supplier-config` daje pola do edycji
   * (URL efektywny, fallback, flaga pochodzenia), `suppliers-list` — statystyki importu.
   * Obie idą po tych samych dziesięciu kodach dispatchera, więc łączenie po `kod` jest pełne.
   */
  const wiersze = (konfiguracja.data ?? []).map((wpis) => ({
    ...wpis,
    statystyki: (lista.data ?? []).find((d) => d.kod === wpis.kod) ?? null,
  }));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Dostawcy — konfiguracja importu</h2>
            <span className="text-xs text-muted-foreground">
              Lista pochodzi z dispatchera, nie z bazy — jest zawsze kompletna.
            </span>
          </div>

          {konfiguracja.isLoading || lista.isLoading ? (
            <p className="text-sm text-muted-foreground" data-testid="admin-dostawcy-ladowanie">
              Wczytywanie…
            </p>
          ) : konfiguracja.isError || lista.isError ? (
            <p className="text-sm text-destructive" data-testid="admin-dostawcy-blad">
              Nie udało się wczytać konfiguracji dostawców.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="py-2 pr-3">Kod</th>
                    <th className="py-2 pr-3">Nazwa</th>
                    <th className="py-2 pr-3">Adres cennika</th>
                    <th className="py-2 pr-3">Co ile</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Ostatni plik</th>
                    <th className="py-2 pr-3 text-right">Produktów</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {wiersze.map((wiersz) => (
                    <tr
                      key={wiersz.kod}
                      className="border-b last:border-0"
                      data-testid={`row-admin-${wiersz.kod}`}
                    >
                      <td className="py-2 pr-3 font-mono">{wiersz.kod}</td>
                      <td className="py-2 pr-3">{wiersz.nazwa}</td>
                      <td className="py-2 pr-3 max-w-[22rem]">
                        <span className="font-mono text-xs break-all">{wiersz.url ?? "—"}</span>
                        {!wiersz.urlEfektywnyZDb && (
                          <span
                            className="ml-2 text-[10px] text-muted-foreground"
                            data-testid={`admin-fallback-${wiersz.kod}`}
                          >
                            (fallback)
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {wiersz.czestotliwoscMinuty === null
                          ? "—"
                          : `${wiersz.czestotliwoscMinuty} min`}
                      </td>
                      <td className="py-2 pr-3">{wiersz.status}</td>
                      <td className="py-2 pr-3 text-xs">
                        {sformatujDate(wiersz.statystyki?.ostatniPlik ?? null)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {wiersz.statystyki?.liczbaProduktow ?? 0}
                      </td>
                      <td className="py-2 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            ustawBladZapisu(null);
                            ustawEdytowanego(wiersz);
                          }}
                          data-testid={`button-admin-edytuj-${wiersz.kod}`}
                        >
                          Edytuj
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-3">
          <h2 className="text-sm font-medium">Użytkownicy</h2>
          <p className="text-xs text-muted-foreground">
            Lista tylko do odczytu — panel nie ma tras zakładania ani usuwania kont. Hasło
            zmienia się w „Moje konto".
          </p>

          {uzytkownicy.isLoading ? (
            <p className="text-sm text-muted-foreground">Wczytywanie…</p>
          ) : uzytkownicy.isError ? (
            <p className="text-sm text-destructive" data-testid="admin-uzytkownicy-blad">
              Nie udało się wczytać użytkowników.
            </p>
          ) : (
            <ul className="text-sm divide-y">
              {(uzytkownicy.data ?? []).map((uzytkownik) => (
                <li
                  key={uzytkownik.id}
                  className="py-2 flex justify-between gap-3"
                  data-testid={`row-admin-user-${uzytkownik.id}`}
                >
                  <span>{uzytkownik.imieNazwisko}</span>
                  <span className="text-muted-foreground font-mono text-xs">
                    {uzytkownik.email}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-3">
          <h2 className="text-sm font-medium">Utrzymanie katalogu</h2>
          <p className="text-xs text-muted-foreground">
            Usuwa z katalogu pozycje, których detektor importu nie uznaje za opony — tym samym,
            którym odsiewane są cenniki przy wczytywaniu. Przydatne po zmianie reguł detektora.
          </p>

          <Button
            variant="destructive"
            onClick={() => {
              if (
                window.confirm(
                  "Usunąć z katalogu wszystkie pozycje, które nie są oponami? Operacji nie da się cofnąć.",
                )
              ) {
                czyszczenieNieOpon.mutate();
              }
            }}
            disabled={czyszczenieNieOpon.isPending}
            data-testid="button-usun-nieopony"
          >
            {czyszczenieNieOpon.isPending ? "Usuwanie…" : "Usuń pozycje, które nie są oponami"}
          </Button>

          {czyszczenieNieOpon.data && (
            <div className="text-xs space-y-1" data-testid="wynik-usun-nieopony">
              <p>
                Usuniętych: <b>{czyszczenieNieOpon.data.usuniete}</b>
              </p>
              {Object.entries(czyszczenieNieOpon.data.perDostawca).length > 0 && (
                <p className="text-muted-foreground">
                  {Object.entries(czyszczenieNieOpon.data.perDostawca)
                    .map(([kod, ile]) => `${kod}: ${ile}`)
                    .join(" · ")}
                </p>
              )}
              {czyszczenieNieOpon.data.przyklady.length > 0 && (
                <ul className="text-muted-foreground font-mono">
                  {czyszczenieNieOpon.data.przyklady.map((przyklad) => (
                    <li key={przyklad}>{przyklad}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {edytowany && (
        <DialogKonfiguracjiDostawcy
          // `key` wymusza świeży stan pól po zmianie dostawcy — bez niego dialog otwarty dla
          // MO2 pokazałby wartości wpisane wcześniej dla MO1.
          key={edytowany.kod}
          dostawca={edytowany}
          otwarty
          onZamknij={() => {
            ustawEdytowanego(null);
            ustawBladZapisu(null);
          }}
          onZapisz={(zmiana) => zapis.mutate({ kod: edytowany.kod, zmiana })}
          zapisywanie={zapis.isPending}
          bladZapisu={bladZapisu}
        />
      )}
    </div>
  );
}
