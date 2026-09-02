/**
 * Tabela promocji — port `BT()` (`deminified/frontend-index.js:24805-24970`).
 *
 * Sześć kolumn, sort po `id` malejąco, brak paginacji — jak przy narzutach.
 *
 * ⚠ ETYKIETA STATUSU IDZIE Z DAT, NIE Z BAZY — i to jest zachowanie produkcji, nie nasz
 * pomysł: `_b()` (`:9508`) przelicza status przy każdym odczycie `/api/promotions`, ale
 * NIGDY nie zapisuje wyniku na serwer. Silnik cen czyta niezmienioną kolumnę `status`,
 * więc etykieta i ceny potrafią mówić co innego. Dokładamy jedyne odstępstwo: gdy się
 * rozjeżdżają, wiersz pokazuje to wprost (plan.md D5, `repos` po stronie widoku: `status.ts`).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { DialogReguly } from "./DialogReguly";
import { pobierzPromocje, usunPromocje, type Promocja } from "./api";
import { ETYKIETY_STANU, zeStanem, type StanPromocji } from "./status";
import { odczytajWarunki } from "./warunki";

/** Data w formacie lokalnym; brak albo śmieć → „—". Port `o()` z `BT()` (`:24833-24840`). */
function formatujDate(wartosc: string | null): string {
  if (!wartosc) return "—";
  const data = new Date(wartosc);
  if (Number.isNaN(data.getTime())) return "—";
  return data.toLocaleDateString("pl-PL");
}

function OdznakaStanu({ stan }: { stan: StanPromocji }) {
  if (stan === "aktywna") {
    return (
      <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px]">
        {ETYKIETY_STANU.aktywna}
      </Badge>
    );
  }
  if (stan === "zaplanowana") {
    return (
      <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[10px]">
        {ETYKIETY_STANU.zaplanowana}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-[10px]">
      {ETYKIETY_STANU.zakonczona}
    </Badge>
  );
}

export function TabelaPromocji() {
  const klient = useQueryClient();
  const { toast } = useToast();
  const [edytowana, ustawEdytowana] = useState<Promocja | null>(null);

  const { data: promocje = [] } = useQuery<Promocja[]>({
    queryKey: ["/api/promotions"],
    queryFn: pobierzPromocje,
  });

  const odswiez = () => {
    void klient.invalidateQueries({ queryKey: ["/api/promotions"] });
    void klient.invalidateQueries({ queryKey: ["/api/products"] });
  };

  const kasowanie = useMutation<void, Error, number>({
    mutationFn: usunPromocje,
    onSuccess: () => {
      odswiez();
      toast({ title: "Promocja usunięta" });
    },
    onError: (e) =>
      toast({ title: "Nie udało się usunąć promocji", description: e.message, variant: "destructive" }),
  });

  const posortowane = [...promocje].sort((a, b) => b.id - a.id).map((p) => zeStanem(p));

  return (
    <>
      <div className="flex justify-between items-center mb-4 gap-4">
        <div className="text-sm text-muted-foreground">
          Promocje to czasowe rabaty z warunkami (marka, kategoria, dostawca itd.). Etykieta
          statusu wyliczana jest z dat przy każdym odczycie.
        </div>
        <DialogReguly trybInicjalny="promocja" />
      </div>

      {edytowana ? (
        <DialogReguly
          trybInicjalny="promocja"
          edytowanaPromocja={edytowana}
          onClose={() => ustawEdytowana(null)}
        />
      ) : null}

      <Card className="border-card-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Nazwa / Warunki</th>
                  <th className="px-4 py-2.5 font-medium text-right">Rabat</th>
                  <th className="px-4 py-2.5 font-medium">Start</th>
                  <th className="px-4 py-2.5 font-medium">Koniec</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium" />
                </tr>
              </thead>
              <tbody>
                {posortowane.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                      Brak promocji. Dodaj pierwszą promocję powyżej.
                    </td>
                  </tr>
                ) : null}
                {posortowane.map((promocja) => {
                  const warunki = odczytajWarunki(promocja.warunki);
                  return (
                    <tr
                      key={promocja.id}
                      className="border-t border-border hover:bg-muted/30"
                      data-testid={`row-promotion-${promocja.id}`}
                    >
                      <td className="px-4 py-2.5">
                        {promocja.nazwa ? (
                          <div className="font-medium mb-0.5">{promocja.nazwa}</div>
                        ) : null}
                        <div className="flex flex-wrap gap-1">
                          {warunki.length === 0 ? (
                            <Badge variant="outline" className="text-[10px]">
                              GLOBALNA
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
                          −{promocja.rabatPct}%
                        </span>
                      </td>
                      <td className="px-4 py-2.5">{formatujDate(promocja.start)}</td>
                      <td className="px-4 py-2.5">{formatujDate(promocja.koniec)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-col items-start gap-1">
                          <OdznakaStanu stan={promocja.stanZDat} />
                          {promocja.rozbieznosc ? (
                            <span
                              className="flex items-start gap-1 text-[10px] text-amber-600 dark:text-amber-500"
                              data-testid={`rozbieznosc-statusu-${promocja.id}`}
                            >
                              <AlertTriangle className="w-3 h-3 shrink-0 mt-px" />
                              {promocja.rozbieznosc}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-0.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => ustawEdytowana(promocja)}
                            data-testid={`button-edit-promotion-${promocja.id}`}
                            title="Edytuj"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => kasowanie.mutate(promocja.id)}
                            disabled={kasowanie.isPending}
                            data-testid={`button-delete-promotion-${promocja.id}`}
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
