/**
 * Zakładka „Spedycja" — port karty `qT()` (`deminified/frontend-index.js:25808-25938`).
 *
 * Port 1:1: układ tabeli, nagłówki kolumn, `data-testid` (`row-sped-<KOD>`,
 * `input-sped-{prog,pon,pow,reguly}-<KOD>`, `button-sped-save-<KOD>`), iterowanie po
 * DOSTAWCACH (a nie po wierszach spedycji — dostawca bez limitu ma pusty wiersz),
 * pojawianie się przycisku „Zapisz" dopiero po zmianie w danym wierszu i konwersje pól:
 * pusty próg → `null`, niepoprawny koszt → `0`.
 *
 * ⚠ JEDYNA ZMIANA ZACHOWANIA (plan.md D2): zapis leci `POST /api/spedycja` zamiast do
 * IndexedDB. Powód i konsekwencje — w nagłówku `konfiguracja/spedycja.ts`.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { DostawcaKonfiguracji } from "./dostawcy";
import { KLUCZ_SPEDYCJI, zapiszLimit, type LimitSpedycji, type PatchLimitu } from "./spedycja";

/** Pola edytowalne w wierszu — bez `id` i `dostawcaKod`, które wynikają z wiersza. */
type ZmianaWiersza = {
  progNetto?: number | null;
  kosztPonizej?: number | null;
  kosztPowyzej?: number | null;
  dodatkoweReguly?: string | null;
};

export function Spedycja() {
  const klient = useQueryClient();
  // Ten sam klucz co w zakładce „Dostawcy" — jedno pobranie na cały ekran konfiguracji.
  const { data: dostawcy = [] } = useQuery<DostawcaKonfiguracji[]>({
    queryKey: ["/api/dostawcy"],
  });
  const { data: limity = [], isLoading } = useQuery<LimitSpedycji[]>({
    queryKey: KLUCZ_SPEDYCJI,
  });

  const [zmiany, ustawZmiany] = useState<Record<string, ZmianaWiersza>>({});
  const [komunikat, ustawKomunikat] = useState<{ tresc: string; blad: boolean } | null>(null);

  const zapis = useMutation<void, Error, PatchLimitu>({
    mutationFn: (patch) => zapiszLimit(patch),
    onSuccess: (_wynik, patch) => {
      ustawZmiany((biezace) => {
        const nowe = { ...biezace };
        delete nowe[patch.dostawcaKod];
        return nowe;
      });
      ustawKomunikat({ tresc: `Zapisano limity spedycyjne dla ${patch.dostawcaKod}`, blad: false });
      void klient.invalidateQueries({ queryKey: KLUCZ_SPEDYCJI });
    },
    onError: (e) => ustawKomunikat({ tresc: `Błąd zapisu: ${e.message}`, blad: true }),
  });

  /**
   * Wartość pola: najpierw niezapisana zmiana, potem wiersz z backendu, na końcu pustka.
   * Port `o(e, r)` (`:25814-25818`) — dostawca bez wiersza w `spedycja_limity` pokazuje
   * puste pola, a nie znika z tabeli.
   */
  function wartosc<K extends keyof ZmianaWiersza>(kod: string, pole: K): ZmianaWiersza[K] | "" {
    const zmiana = zmiany[kod];
    if (zmiana && pole in zmiana) return zmiana[pole];
    const limit = limity.find((l) => l.dostawcaKod === kod);
    return limit ? (limit[pole] as ZmianaWiersza[K]) : "";
  }

  function zmien<K extends keyof ZmianaWiersza>(kod: string, pole: K, nowa: ZmianaWiersza[K]) {
    ustawZmiany((biezace) => ({ ...biezace, [kod]: { ...biezace[kod], [pole]: nowa } }));
  }

  function zapisz(kod: string) {
    const zmiana = zmiany[kod];
    if (!zmiana) return;
    ustawKomunikat(null);
    // Scalenie z istniejącym wierszem — port `eS({...t.find(…), ...o, dostawcaKod: e})`
    // (`:25913-25917`). `id` świadomie pomijamy: to tożsamość wiersza, backend i tak
    // odsiewa je z ciała (`repos/spedycja.ts`), a upsert idzie po `dostawcaKod`.
    const istniejacy = limity.find((l) => l.dostawcaKod === kod);
    zapis.mutate({
      progNetto: istniejacy?.progNetto ?? null,
      kosztPonizej: istniejacy?.kosztPonizej ?? null,
      kosztPowyzej: istniejacy?.kosztPowyzej ?? null,
      dodatkoweReguly: istniejacy?.dodatkoweReguly ?? null,
      ...zmiana,
      dostawcaKod: kod,
    });
  }

  return (
    <Card className="border-card-border">
      <CardContent className="p-5">
        <div className="mb-4">
          <h3 className="text-sm font-medium">Limity spedycyjne per dostawca</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Próg netto i koszty dostawy. Po przekroczeniu progu — dostawa gratis lub ze zniżką.
          </p>
        </div>

        {komunikat ? (
          <p
            className={`text-[11px] mb-2 ${komunikat.blad ? "text-destructive" : "text-muted-foreground"}`}
            data-testid="komunikat-spedycja"
          >
            {komunikat.tresc}
          </p>
        ) : null}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Wczytywanie…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b">
                  <th className="text-left py-2 px-2">Dostawca</th>
                  <th className="text-left py-2 px-2">Próg netto (zł)</th>
                  <th className="text-left py-2 px-2">Koszt poniżej (zł)</th>
                  <th className="text-left py-2 px-2">Koszt powyżej (zł)</th>
                  <th className="text-left py-2 px-2">Dodatkowe reguły</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {dostawcy.map((dostawca) => {
                  const zmieniony = Boolean(zmiany[dostawca.kod]);
                  return (
                    <tr
                      key={dostawca.kod}
                      className="border-b border-border/50"
                      data-testid={`row-sped-${dostawca.kod}`}
                    >
                      <td className="py-2 px-2">
                        <div className="font-mono text-xs">{dostawca.kod}</div>
                        <div className="text-xs text-muted-foreground">{dostawca.nazwa}</div>
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          type="number"
                          className="w-24 font-mono text-xs"
                          value={wartosc(dostawca.kod, "progNetto") ?? ""}
                          // Pusty próg to „brak progu" (`null`), a nie zero — 1:1 z `:25879`.
                          onChange={(e) =>
                            zmien(
                              dostawca.kod,
                              "progNetto",
                              e.target.value ? Number.parseFloat(e.target.value) : null,
                            )
                          }
                          data-testid={`input-sped-prog-${dostawca.kod}`}
                          aria-label={`Próg netto — ${dostawca.kod}`}
                        />
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          type="number"
                          className="w-24 font-mono text-xs"
                          value={wartosc(dostawca.kod, "kosztPonizej") ?? ""}
                          // `parseFloat(…) || 0` z oryginału (`:25890`): pusto i śmieci → 0.
                          onChange={(e) =>
                            zmien(dostawca.kod, "kosztPonizej", Number.parseFloat(e.target.value) || 0)
                          }
                          data-testid={`input-sped-pon-${dostawca.kod}`}
                          aria-label={`Koszt poniżej progu — ${dostawca.kod}`}
                        />
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          type="number"
                          className="w-24 font-mono text-xs"
                          value={wartosc(dostawca.kod, "kosztPowyzej") ?? ""}
                          onChange={(e) =>
                            zmien(dostawca.kod, "kosztPowyzej", Number.parseFloat(e.target.value) || 0)
                          }
                          data-testid={`input-sped-pow-${dostawca.kod}`}
                          aria-label={`Koszt powyżej progu — ${dostawca.kod}`}
                        />
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          className="text-xs"
                          value={wartosc(dostawca.kod, "dodatkoweReguly") ?? ""}
                          onChange={(e) => zmien(dostawca.kod, "dodatkoweReguly", e.target.value)}
                          data-testid={`input-sped-reguly-${dostawca.kod}`}
                          aria-label={`Dodatkowe reguły — ${dostawca.kod}`}
                        />
                      </td>
                      <td className="py-2 px-2">
                        {/* Przycisk pojawia się dopiero po zmianie w wierszu — 1:1 z `:25910`. */}
                        {zmieniony ? (
                          <Button
                            size="sm"
                            disabled={zapis.isPending}
                            onClick={() => zapisz(dostawca.kod)}
                            data-testid={`button-sped-save-${dostawca.kod}`}
                          >
                            {zapis.isPending ? "Zapisywanie…" : "Zapisz"}
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
