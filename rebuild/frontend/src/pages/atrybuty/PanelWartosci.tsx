/**
 * Panel wartości wybranego rodzaju — port `renderWartosci()`
 * (`mirror/frontend/assets/pending-injection.js:722-887`).
 *
 * Dodawanie (przycisk i Enter), szukajka, sort `localeCompare(…, "pl")`, tabela z akcjami
 * Podgląd / Edytuj / Usuń. Teksty toastów i pytań 1:1 z oryginałem.
 *
 * ⚠ FILTR „ŹRÓDŁO” POMINIĘTY ŚWIADOMIE (plan.md D4): oryginał ma select `catalog/user/preset`
 * czytający `w.origin` (`:766`), ale ŻADNA trasa backendu nie zwraca tego pola
 * (`atrybuty_module.cjs:185-196`, `contract/fixtures/GET_atrybuty_wartosci.json`) — kolumna
 * istnieje w bazie, w odpowiedzi nie. W produkcji filtr zawsze pokazuje „user” i nic nie robi.
 * Odtworzenie martwego elementu nie jest parytetem zachowania, tylko parytetem usterki.
 *
 * ⚠ EDYCJA I POTWIERDZENIE USUNIĘCIA idą przez dialogi, nie `prompt()`/`confirm()` — patrz
 * `components/DialogTekstu.tsx` (odstępstwo D2). Teksty przeniesione dosłownie.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { DialogPotwierdzenia } from "@/components/DialogPotwierdzenia";
import { DialogTekstu } from "@/components/DialogTekstu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  dodajWartosc,
  komunikatBledu,
  usunWartosc,
  zapiszWartosc,
  type Rodzaj,
  type Wartosc,
} from "./api";

export function PanelWartosci({
  rodzaj,
  wartosci,
  onWroc,
  onPodglad,
}: {
  rodzaj: Rodzaj;
  /** Wartości WSZYSTKICH rodzajów — filtrowanie po `rodzaj` robimy tutaj, jak oryginał. */
  wartosci: Wartosc[];
  onWroc: () => void;
  onPodglad: (rodzaj: string, wartosc: string) => void;
}) {
  const klient = useQueryClient();
  const { toast } = useToast();
  const [nowa, ustawNowa] = useState("");
  const [szukaj, ustawSzukaj] = useState("");
  const [edytowana, ustawEdytowana] = useState<Wartosc | null>(null);
  const [doUsuniecia, ustawDoUsuniecia] = useState<Wartosc | null>(null);

  const odswiez = () => klient.invalidateQueries({ queryKey: ["/api/atrybuty"] });

  const zglosBlad = (e: unknown) =>
    toast({ title: `Błąd: ${komunikatBledu(e)}`, variant: "destructive" });

  const dodawanie = useMutation<void, Error, string>({
    mutationFn: (wartosc) => dodajWartosc(rodzaj.value, wartosc),
    onSuccess: (_wynik, wartosc) => {
      void odswiez();
      ustawNowa("");
      toast({ title: `Dodano: ${wartosc}` });
    },
    onError: zglosBlad,
  });

  const edycja = useMutation<void, Error, { pozycja: Wartosc; nowa: string }>({
    mutationFn: ({ pozycja, nowa: tekst }) => zapiszWartosc(pozycja.id, tekst),
    onSuccess: (_wynik, { pozycja, nowa: tekst }) => {
      void odswiez();
      ustawEdytowana(null);
      toast({ title: `Zmieniono: ${pozycja.wartosc} → ${tekst}` });
    },
    onError: zglosBlad,
  });

  const kasowanie = useMutation<void, Error, Wartosc>({
    mutationFn: (pozycja) => usunWartosc(pozycja.id),
    onSuccess: (_wynik, pozycja) => {
      void odswiez();
      ustawDoUsuniecia(null);
      toast({ title: `Usunięto: ${pozycja.wartosc}` });
    },
    onError: (e) => {
      ustawDoUsuniecia(null);
      zglosBlad(e);
    },
  });

  function dodaj() {
    const wartosc = nowa.trim();
    // Oryginał: pusta wartość to toast błędu, nie cichy no-op (`:825`).
    if (!wartosc) {
      toast({ title: "Wpisz wartość", variant: "destructive" });
      return;
    }
    dodawanie.mutate(wartosc);
  }

  const wszystkieRodzaju = wartosci.filter((w) => w.rodzaj === rodzaj.value);
  const widoczne = wszystkieRodzaju
    .filter((w) => (w.wartosc || "").toLowerCase().includes(szukaj.toLowerCase()))
    .sort((a, b) => (a.wartosc || "").localeCompare(b.wartosc || "", "pl"));

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={onWroc}
        className="mb-3"
        data-testid="button-wroc-do-kafli"
      >
        ← Wróć do kafli
      </Button>

      <div className="rounded-lg border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold" data-testid="text-rodzaj-label">
              {rodzaj.label}
            </h2>
            <div className="text-xs text-muted-foreground">{rodzaj.opis ?? ""}</div>
          </div>
          <div className="flex gap-2">
            <Input
              value={nowa}
              onChange={(zdarzenie) => ustawNowa(zdarzenie.target.value)}
              onKeyDown={(zdarzenie) => {
                if (zdarzenie.key === "Enter") dodaj();
              }}
              placeholder={`Nowa wartość dla "${rodzaj.label}"`}
              className="sm:w-64"
              data-testid="input-nowa-wartosc"
            />
            <Button onClick={dodaj} disabled={dodawanie.isPending} data-testid="button-dodaj-wartosc">
              + Dodaj
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5">
          <Input
            value={szukaj}
            onChange={(zdarzenie) => ustawSzukaj(zdarzenie.target.value)}
            placeholder="Szukaj..."
            className="max-w-xs"
            data-testid="input-szukaj-wartosci"
          />
          <div className="ml-auto text-xs text-muted-foreground" data-testid="text-licznik-wartosci">
            Wyświetlono: <b className="text-primary">{widoczne.length}</b>
          </div>
        </div>

        {widoczne.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Brak wartości</div>
        ) : (
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Wartość</th>
                  <th className="px-4 py-2 font-medium text-right">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {widoczne.map((pozycja) => (
                  <tr
                    key={pozycja.id}
                    className="border-t border-border hover:bg-muted/30"
                    data-testid={`wiersz-wartosc-${pozycja.id}`}
                  >
                    <td className="px-4 py-2">{pozycja.wartosc}</td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onPodglad(pozycja.rodzaj, pozycja.wartosc)}
                          title="Zobacz produkty używające tej wartości"
                          data-testid={`button-podglad-${pozycja.id}`}
                        >
                          Podgląd
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => ustawEdytowana(pozycja)}
                          data-testid={`button-edytuj-wartosc-${pozycja.id}`}
                        >
                          Edytuj
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => ustawDoUsuniecia(pozycja)}
                          data-testid={`button-usun-wartosc-${pozycja.id}`}
                        >
                          Usuń
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DialogTekstu
        otwarty={edytowana !== null}
        tytul="Edytuj wartość"
        etykieta={edytowana ? `Edytuj wartość "${edytowana.wartosc}":` : ""}
        wartoscPoczatkowa={edytowana?.wartosc ?? ""}
        zajety={edycja.isPending}
        onZatwierdz={(tekst) => {
          // Oryginał nie wysyła żądania, gdy wartość się nie zmieniła (`:853`).
          if (!edytowana || tekst === edytowana.wartosc) {
            ustawEdytowana(null);
            return;
          }
          edycja.mutate({ pozycja: edytowana, nowa: tekst });
        }}
        onZamknij={() => ustawEdytowana(null)}
        testId="dialog-edytuj-wartosc"
      />

      <DialogPotwierdzenia
        otwarty={doUsuniecia !== null}
        tytul="Usuń wartość"
        tresc={
          doUsuniecia
            ? `Usunąć wartość "${doUsuniecia.wartosc}" z rodzaju "${rodzaj.value}"?`
            : ""
        }
        etykietaPotwierdzenia="Usuń"
        wariantPotwierdzenia="destructive"
        zajety={kasowanie.isPending}
        onPotwierdz={() => doUsuniecia && kasowanie.mutate(doUsuniecia)}
        onZamknij={() => ustawDoUsuniecia(null)}
        testId="dialog-usun-wartosc"
      />
    </>
  );
}
