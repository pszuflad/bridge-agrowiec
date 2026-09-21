/**
 * Tabela „Przewoźnicy i dzielniki" wraz z trybem edycji — port `:26774-26953`.
 *
 * To NIE jest ozdobnik do kalkulatora: Ania dodaje tu własnych przewoźników i poprawia
 * dzielniki, a lista jest jedynym miejscem, z którego kalkulator bierze dzielnik.
 *
 * ⚠ ODSTĘPSTWA ŚWIADOME (karta P9.1, ticket 76, backlog #27), wszystkie przez to, że lista jest
 * teraz WSPÓLNA dla firmy i żyje na serwerze, a nie w IndexedDB jednej przeglądarki:
 *  - usunięcie i „Przywróć domyślne" pytają o potwierdzenie (w oryginale działają od razu);
 *  - nazwa i dzielnik zapisują się po opuszczeniu pola, nie co znak (plan.md D2) — co znak
 *    oznaczałoby żądanie na każdy klawisz, a chwilowo pusta nazwa dostałaby 400. Pusta nazwa
 *    albo zły dzielnik wracają do poprzedniej wartości z komunikatem;
 *  - przyciski zapisujące są zablokowane, dopóki poprzedni zapis nie wróci z serwera.
 * Stan listy trzyma widok nadrzędny (razem z zapisem), tutaj jest prezentacja i szkice pól.
 */
import { Info, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";

import { DialogPotwierdzenia } from "@/components/DialogPotwierdzenia";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { OBJETOSC_PRZYKLADU, type Przewoznik } from "./przewoznicy";

export type WlasciwosciTabeli = {
  przewoznicy: Przewoznik[];
  /** Zapisuje całą listę na serwerze; `true`, gdy się udało (błąd pokazuje widok nadrzędny). */
  zapiszListe: (nastepni: Przewoznik[]) => Promise<boolean>;
  /** Trwa zapis — przyciski zmieniające listę czekają. */
  zapisuje: boolean;
  wybrany: string;
  ustawWybranego: (id: string) => void;
  przywrocDomyslne: () => Promise<boolean>;
};

/** Niezatwierdzona treść pól wiersza w trybie edycji — znika po opuszczeniu pola. */
type Szkic = { nazwa?: string; dzielnik?: string };

/** `parseFloat` z przecinkiem jak w oryginale (`:26858`); `null`, gdy nie jest liczbą dodatnią. */
function naDzielnik(tekst: string): number | null {
  const dzielnik = Number.parseFloat(tekst.replace(",", "."));
  return Number.isFinite(dzielnik) && dzielnik > 0 ? dzielnik : null;
}

export function TabelaPrzewoznikow({
  przewoznicy,
  zapiszListe,
  zapisuje,
  wybrany,
  ustawWybranego,
  przywrocDomyslne,
}: WlasciwosciTabeli) {
  const [edycja, ustawEdycje] = useState(false);
  const [nowaNazwa, ustawNowaNazwe] = useState("");
  const [nowyDzielnik, ustawNowyDzielnik] = useState("");
  const [szkice, ustawSzkice] = useState<Record<string, Szkic>>({});
  const [doUsuniecia, ustawDoUsuniecia] = useState<Przewoznik | null>(null);
  const [pytanieOReset, ustawPytanieOReset] = useState(false);
  const { toast } = useToast();

  const zmienSzkic = (id: string, pole: keyof Szkic, wartosc: string) =>
    ustawSzkice((poprzednie) => ({ ...poprzednie, [id]: { ...poprzednie[id], [pole]: wartosc } }));

  const porzucSzkic = (id: string, pole: keyof Szkic) =>
    ustawSzkice((poprzednie) => {
      const { [pole]: _porzucone, ...reszta } = poprzednie[id] ?? {};
      return { ...poprzednie, [id]: reszta };
    });

  /**
   * Zatwierdzenie pola po opuszczeniu go (plan.md D2). Niezmieniona wartość nie wysyła niczego;
   * błędna wraca do tej z serwera z komunikatem — oryginał błędny dzielnik po cichu ignorował
   * (`:26858`), ale tam nie było zapisu, który mógłby się „nie udać" bez śladu.
   */
  const zatwierdzPole = (przewoznik: Przewoznik, pole: keyof Szkic) => {
    const tekst = szkice[przewoznik.id]?.[pole];
    porzucSzkic(przewoznik.id, pole);
    if (tekst === undefined) return;

    if (pole === "nazwa") {
      if (!tekst.trim()) {
        toast({
          title: "Brak nazwy",
          description: "Nazwa przewoźnika nie może być pusta.",
          variant: "destructive",
        });
        return;
      }
      if (tekst === przewoznik.nazwa) return;
      void zapiszListe(
        przewoznicy.map((p) => (p.id === przewoznik.id ? { ...p, nazwa: tekst } : p)),
      );
      return;
    }

    const dzielnik = naDzielnik(tekst);
    if (dzielnik === null) {
      toast({
        title: "Niepoprawny dzielnik",
        description: "Dzielnik musi być liczbą dodatnią.",
        variant: "destructive",
      });
      return;
    }
    if (dzielnik === przewoznik.dzielnik) return;
    void zapiszListe(przewoznicy.map((p) => (p.id === przewoznik.id ? { ...p, dzielnik } : p)));
  };

  /** Blokada ostatniego przewoźnika z oryginału (`:26876-26880`) — sprawdzana PRZED pytaniem. */
  const zapytajOUsuniecie = (przewoznik: Przewoznik) => {
    if (przewoznicy.length <= 1) {
      toast({
        title: "Nie można usunąć",
        description: "Musi pozostać co najmniej jeden przewoźnik.",
        variant: "destructive",
      });
      return;
    }
    ustawDoUsuniecia(przewoznik);
  };

  /**
   * Usunięcie po potwierdzeniu. Skasowanie AKTUALNIE WYBRANEGO przenosi wybór na pierwszego
   * z pozostałych (`:26881-26885`).
   */
  const usun = (id: string) => {
    ustawDoUsuniecia(null);
    const pozostali = przewoznicy.filter((p) => p.id !== id);
    if (wybrany === id && pozostali[0]) ustawWybranego(pozostali[0].id);
    void zapiszListe(pozostali);
  };

  const dodaj = async () => {
    const nazwa = nowaNazwa.trim();
    const dzielnik = naDzielnik(nowyDzielnik);
    if (!nazwa || dzielnik === null) {
      toast({
        title: "Brak danych",
        description: "Podaj nazwę i dodatni dzielnik.",
        variant: "destructive",
      });
      return;
    }
    // Id z sygnatury czasowej — 1:1 z oryginałem (`:26922`).
    const zapisano = await zapiszListe([
      ...przewoznicy,
      { id: `custom_${Date.now()}`, nazwa, dzielnik },
    ]);
    if (!zapisano) return;
    ustawNowaNazwe("");
    ustawNowyDzielnik("");
  };

  const przywroc = async () => {
    ustawPytanieOReset(false);
    if (await przywrocDomyslne()) {
      toast({
        title: "Przywrócono",
        description: "Domyślna lista przewoźników i dzielników.",
      });
    }
  };

  return (
    <Card className="p-6 mt-6">
      {doUsuniecia ? (
        <DialogPotwierdzenia
          otwarty
          tytul="Usunąć przewoźnika?"
          tresc={`Przewoźnik „${doUsuniecia.nazwa}" zniknie z listy. Lista jest wspólna — zmiana obowiązuje wszystkich użytkowników.`}
          etykietaPotwierdzenia="Usuń przewoźnika"
          wariantPotwierdzenia="destructive"
          onPotwierdz={() => usun(doUsuniecia.id)}
          onZamknij={() => ustawDoUsuniecia(null)}
          testId="dialog-usun-przewoznika"
        />
      ) : null}

      <DialogPotwierdzenia
        otwarty={pytanieOReset}
        tytul="Przywrócić domyślną listę przewoźników?"
        tresc={
          "Lista wróci do sześciu domyślnych przewoźników: GEIS Polska, DPD, GLS, InPost Kurier, UPS i DHL Parcel.\n" +
          "To zmienia listę dla całej firmy — dodani przewoźnicy i poprawione dzielniki znikną u wszystkich."
        }
        etykietaPotwierdzenia="Przywróć domyślne"
        wariantPotwierdzenia="destructive"
        onPotwierdz={() => void przywroc()}
        onZamknij={() => ustawPytanieOReset(false)}
        testId="dialog-przywroc-domyslne"
      />

      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold">Przewoźnicy i dzielniki</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Dzielnik dla GEIS Polska = 10 000 (paczki). DPD = 6 000. GLS = 4 000. Zmiany
            zapisują się automatycznie. Lista jest wspólna — zmiana obowiązuje wszystkich
            użytkowników.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => ustawEdycje((poprzednia) => !poprzednia)}
            data-testid="button-edycja-przewoznikow"
          >
            {edycja ? "Gotowe" : "Edytuj listę"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => ustawPytanieOReset(true)}
            disabled={zapisuje}
            data-testid="button-przywroc-domyslne"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-2" />
            Przywróć domyślne
          </Button>
        </div>
      </div>

      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Przewoźnik</th>
              <th className="text-right px-3 py-2 font-medium">Dzielnik</th>
              <th className="text-left px-3 py-2 font-medium">Przykład dla paczki 60×50×50</th>
              {edycja ? <th className="text-right px-3 py-2 font-medium">Akcje</th> : null}
            </tr>
          </thead>
          <tbody>
            {przewoznicy.map((przewoznik) => (
              <tr key={przewoznik.id} className="border-t">
                <td className="px-3 py-2">
                  {edycja ? (
                    <Input
                      value={szkice[przewoznik.id]?.nazwa ?? przewoznik.nazwa}
                      onChange={(zdarzenie) =>
                        zmienSzkic(przewoznik.id, "nazwa", zdarzenie.target.value)
                      }
                      onBlur={() => zatwierdzPole(przewoznik, "nazwa")}
                      className="h-8"
                      data-testid={`input-nazwa-${przewoznik.id}`}
                    />
                  ) : (
                    <span className="font-medium">{przewoznik.nazwa}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {edycja ? (
                    <Input
                      type="number"
                      value={szkice[przewoznik.id]?.dzielnik ?? przewoznik.dzielnik}
                      onChange={(zdarzenie) =>
                        zmienSzkic(przewoznik.id, "dzielnik", zdarzenie.target.value)
                      }
                      onBlur={() => zatwierdzPole(przewoznik, "dzielnik")}
                      className="h-8 w-24 ml-auto text-right"
                      data-testid={`input-dzielnik-${przewoznik.id}`}
                    />
                  ) : (
                    przewoznik.dzielnik.toLocaleString("pl-PL")
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-muted-foreground">
                  {(OBJETOSC_PRZYKLADU / przewoznik.dzielnik).toFixed(2)} kg
                </td>
                {edycja ? (
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => zapytajOUsuniecie(przewoznik)}
                      disabled={zapisuje}
                      data-testid={`button-usun-${przewoznik.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {edycja ? (
        <div className="mt-4 pt-4 border-t">
          <Label className="text-sm font-medium mb-2 block">Dodaj nowego przewoźnika</Label>
          <div className="flex gap-2 max-w-2xl">
            <Input
              placeholder="Nazwa (np. Pocztex)"
              value={nowaNazwa}
              onChange={(zdarzenie) => ustawNowaNazwe(zdarzenie.target.value)}
              data-testid="input-nowy-nazwa"
            />
            <Input
              placeholder="Dzielnik (np. 5000)"
              type="number"
              value={nowyDzielnik}
              onChange={(zdarzenie) => ustawNowyDzielnik(zdarzenie.target.value)}
              className="w-40"
              data-testid="input-nowy-dzielnik"
            />
            <Button
              onClick={() => void dodaj()}
              disabled={zapisuje}
              data-testid="button-dodaj-przewoznika"
            >
              <Plus className="w-4 h-4 mr-2" />
              Dodaj
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 bg-muted/30 rounded-md p-3 text-xs space-y-2">
        <div className="flex items-start gap-2">
          <Info className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
          <div className="text-muted-foreground space-y-1">
            <div>
              <strong>Wzór GEIS Polska:</strong> waga gabarytowa [kg] = (długość × szerokość ×
              wysokość [cm]) / 10 000
            </div>
            <div>
              Przykład: paczka 60 × 50 × 50 cm → 60 × 50 × 50 / 10 000 = <strong>15 kg</strong>
            </div>
            <div>
              Do wyceny GEIS porównuje wagę rzeczywistą i gabarytową — przyjmuje większą
              wartość.
            </div>
            <div>Dla palet GEIS stosuje też przelicznik: objętość [m³] × 250.</div>
          </div>
        </div>
      </div>
    </Card>
  );
}
