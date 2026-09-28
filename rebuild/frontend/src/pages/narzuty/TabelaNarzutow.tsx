/**
 * Tabela reguł narzutu — port `WT()` (`deminified/frontend-index.js:24661-24803`).
 *
 * Cztery kolumny, sort po `id` MALEJĄCO po stronie klienta, brak paginacji, filtrów
 * i sortowania po nagłówkach — dokładnie jak oryginał. Status jest KLIKALNY: przełącza
 * `aktywny` ↔ `nieaktywny` jednym PATCH-em (`:24756-24775`).
 *
 * ⚠ ODSTĘPSTWO ŚWIADOME — USUWANIE PYTA O POTWIERDZENIE (karta 14f, zadanie 5).
 * Oryginał kasuje od razu i pokazuje toast (`:24784`). Decyzja Ani (§3.6 instrukcji I4,
 * potwierdzona 2026-09-18) jest inna: usuwanie ma pytać, i to **z informacją, ilu produktów
 * dotyczy zmiana** — bo każde usunięcie reguły przelicza ceny CAŁEGO katalogu po stronie
 * serwera, a tego z jednego kliknięcia nie da się cofnąć.
 *
 * Liczbę produktów liczy `liczbaProduktowZNarzutem` tym samym silnikiem, co symulator
 * (`narzuty/ceny.ts`) — patrz tam po uzasadnienie, dlaczego NIE matcherem ostrzeżenia.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import type { Produkt } from "@/pages/katalog/filtrowanie";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DialogPotwierdzenia } from "@/components/DialogPotwierdzenia";
import { useToast } from "@/components/ui/toast";
import { DialogReguly } from "./DialogReguly";
import { liczbaProduktowZNarzutem, opisLiczbyProduktow } from "./ceny";
import { pobierzNarzuty, usunNarzut, zapiszNarzut, type Narzut } from "./api";
import { STATUS_NARZUTU_AKTYWNY, STATUS_NARZUTU_NIEAKTYWNY } from "./status";
import { odczytajWarunki } from "./warunki";

export function TabelaNarzutow() {
  const klient = useQueryClient();
  const { toast } = useToast();
  const [edytowany, ustawEdytowany] = useState<Narzut | null>(null);
  const [doUsuniecia, ustawDoUsuniecia] = useState<Narzut | null>(null);

  const { data: narzuty = [] } = useQuery<Narzut[]>({
    queryKey: ["/api/markups"],
    queryFn: pobierzNarzuty,
  });

  /**
   * Katalog — ten sam klucz zapytania, z którego korzystają symulator i ostrzeżenie „poniżej
   * kosztu" (`DialogReguly`, `Symulator`), więc potwierdzenie liczy na tym samym materiale
   * i nie dokłada własnego źródła prawdy o produktach.
   */
  const { data: produkty } = useQuery<Produkt[]>({ queryKey: ["/api/products"] });

  /**
   * Każda mutacja reguły przelicza ceny CAŁEGO katalogu po stronie serwera (4a), więc
   * unieważniamy też produkty — inaczej katalog pokazywałby ceny sprzed zmiany.
   */
  const odswiez = () => {
    void klient.invalidateQueries({ queryKey: ["/api/markups"] });
    void klient.invalidateQueries({ queryKey: ["/api/products"] });
  };

  const przelacz = useMutation<unknown, Error, Narzut>({
    mutationFn: (regula) =>
      zapiszNarzut(regula.id, {
        status:
          regula.status === STATUS_NARZUTU_AKTYWNY
            ? STATUS_NARZUTU_NIEAKTYWNY
            : STATUS_NARZUTU_AKTYWNY,
      }),
    onSuccess: odswiez,
    onError: (e) => toast({ title: "Nie udało się zmienić statusu", description: e.message, variant: "destructive" }),
  });

  const kasowanie = useMutation<void, Error, number>({
    mutationFn: usunNarzut,
    onSuccess: () => {
      odswiez();
      toast({ title: "Reguła usunięta" });
    },
    onError: (e) => toast({ title: "Nie udało się usunąć reguły", description: e.message, variant: "destructive" }),
  });

  const posortowane = [...narzuty].sort((a, b) => b.id - a.id);

  /**
   * `null` znaczy „katalog jeszcze się nie wczytał" i jest ROZRÓŻNIANE od zera: „0 produktów"
   * to twierdzenie o regule, a brak danych to brak wiedzy. Pokazanie zera zamiast „ładowanie"
   * zachęcałoby do usunięcia reguły, która realnie wycenia pół katalogu.
   */
  const liczbaObjetych =
    doUsuniecia && produkty ? liczbaProduktowZNarzutem(produkty, narzuty, doUsuniecia) : null;

  return (
    <>
      <div className="flex justify-between items-center mb-4 gap-4">
        <div className="text-sm text-muted-foreground">
          Reguły narzutów stosowane przy obliczaniu ceny sprzedaży. Wygrywa najbardziej
          szczegółowa reguła. Warunki w jednej regule łączone są operatorem AND.
        </div>
        <DialogReguly trybInicjalny="narzut" />
      </div>

      {edytowany ? (
        <DialogReguly
          trybInicjalny="narzut"
          edytowanyNarzut={edytowany}
          onClose={() => ustawEdytowany(null)}
        />
      ) : null}

      {doUsuniecia ? (
        <DialogPotwierdzenia
          otwarty
          tytul="Usunąć regułę narzutu?"
          tresc={`Reguła „${doUsuniecia.nazwa}" zostanie usunięta, a ceny całego katalogu przeliczone od nowa. Tej operacji nie można cofnąć.`}
          etykietaPotwierdzenia="Usuń regułę"
          wariantPotwierdzenia="destructive"
          zajety={kasowanie.isPending}
          onPotwierdz={() => {
            kasowanie.mutate(doUsuniecia.id);
            ustawDoUsuniecia(null);
          }}
          onZamknij={() => ustawDoUsuniecia(null)}
          testId="dialog-usun-narzut"
        >
          <p className="text-sm" data-testid="liczba-produktow-narzutu">
            {opisLiczbyProduktow(liczbaObjetych, "wycenia dziś ta reguła")}
          </p>
        </DialogPotwierdzenia>
      ) : null}

      <Card className="border-card-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Nazwa / Warunki</th>
                  <th className="px-4 py-2.5 font-medium text-right">Narzut</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium" />
                </tr>
              </thead>
              <tbody>
                {posortowane.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                      Brak reguł narzutów. Dodaj pierwszą regułę powyżej.
                    </td>
                  </tr>
                ) : null}
                {posortowane.map((regula) => {
                  const warunki = odczytajWarunki(regula.warunki);
                  const aktywny = regula.status === STATUS_NARZUTU_AKTYWNY;
                  return (
                    <tr
                      key={regula.id}
                      className="border-t border-border hover:bg-muted/30"
                      data-testid={`row-markup-${regula.id}`}
                    >
                      <td className="px-4 py-2.5">
                        {regula.nazwa ? (
                          <div className="font-medium mb-0.5">{regula.nazwa}</div>
                        ) : null}
                        <div className="flex flex-wrap gap-1">
                          {warunki.length === 0 ? (
                            <Badge variant="outline" className="text-[10px]">
                              GLOBALNY
                            </Badge>
                          ) : (
                            warunki.map((w, i) => (
                              <Badge
                                key={`${w.typ}-${w.wartosc}-${i}`}
                                variant="secondary"
                                className="text-[10px] font-mono"
                              >
                                {w.typ}: {w.wartosc}
                              </Badge>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="font-mono tabular-nums text-primary font-semibold">
                          +{regula.wartosc}%
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => przelacz.mutate(regula)}
                          disabled={przelacz.isPending}
                          title="Kliknij aby przełączyć"
                          data-testid={`toggle-status-${regula.id}`}
                        >
                          {aktywny ? (
                            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] cursor-pointer">
                              aktywny
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] cursor-pointer">
                              nieaktywny
                            </Badge>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-0.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => ustawEdytowany(regula)}
                            data-testid={`button-edit-markup-${regula.id}`}
                            title="Edytuj"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => ustawDoUsuniecia(regula)}
                            disabled={kasowanie.isPending}
                            data-testid={`button-delete-markup-${regula.id}`}
                            title="Usuń"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
