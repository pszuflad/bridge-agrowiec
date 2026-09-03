/**
 * Tabela „Przewoźnicy i dzielniki" wraz z trybem edycji — port `:26774-26953`.
 *
 * To NIE jest ozdobnik do kalkulatora: Ania dodaje tu własnych przewoźników i poprawia
 * dzielniki, a lista jest jedynym miejscem, z którego kalkulator bierze dzielnik.
 * Stan trzyma widok nadrzędny (razem z zapisem do IndexedDB), tutaj jest sama prezentacja.
 */
import { Info, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { OBJETOSC_PRZYKLADU, type Przewoznik } from "./przewoznicy";

export type WlasciwosciTabeli = {
  przewoznicy: Przewoznik[];
  ustawPrzewoznikow: (nastepni: Przewoznik[]) => void;
  wybrany: string;
  ustawWybranego: (id: string) => void;
  przywrocDomyslne: () => void;
};

export function TabelaPrzewoznikow({
  przewoznicy,
  ustawPrzewoznikow,
  wybrany,
  ustawWybranego,
  przywrocDomyslne,
}: WlasciwosciTabeli) {
  const [edycja, ustawEdycje] = useState(false);
  const [nowaNazwa, ustawNowaNazwe] = useState("");
  const [nowyDzielnik, ustawNowyDzielnik] = useState("");
  const { toast } = useToast();

  const zmienNazwe = (id: string, nazwa: string) =>
    ustawPrzewoznikow(przewoznicy.map((p) => (p.id === id ? { ...p, nazwa } : p)));

  /** Nieliczbowy albo niedodatni dzielnik jest po cichu IGNOROWANY (`:26858`) — */
  /** pole zostaje przy poprzedniej wartości, zamiast wpuścić do wzoru NaN. */
  const zmienDzielnik = (id: string, tekst: string) => {
    const dzielnik = Number.parseFloat(tekst.replace(",", "."));
    if (!Number.isFinite(dzielnik) || dzielnik <= 0) return;
    ustawPrzewoznikow(przewoznicy.map((p) => (p.id === id ? { ...p, dzielnik } : p)));
  };

  /**
   * Usunięcie z dwoma zabezpieczeniami z oryginału (`:26876-26886`): ostatni przewoźnik
   * zostaje (bez niego kalkulator nie ma czym dzielić), a skasowanie AKTUALNIE WYBRANEGO
   * przenosi wybór na pierwszego z pozostałych.
   */
  const usun = (id: string) => {
    if (przewoznicy.length <= 1) {
      toast({
        title: "Nie można usunąć",
        description: "Musi pozostać co najmniej jeden przewoźnik.",
        variant: "destructive",
      });
      return;
    }
    ustawPrzewoznikow(przewoznicy.filter((p) => p.id !== id));
    if (wybrany === id) {
      const zastepca = przewoznicy.find((p) => p.id !== id);
      if (zastepca) ustawWybranego(zastepca.id);
    }
  };

  const dodaj = () => {
    const nazwa = nowaNazwa.trim();
    const dzielnik = Number.parseFloat(nowyDzielnik.replace(",", "."));
    if (!nazwa || !Number.isFinite(dzielnik) || dzielnik <= 0) {
      toast({
        title: "Brak danych",
        description: "Podaj nazwę i dodatni dzielnik.",
        variant: "destructive",
      });
      return;
    }
    // Id z sygnatury czasowej — 1:1 z oryginałem (`:26922`).
    ustawPrzewoznikow([...przewoznicy, { id: `custom_${Date.now()}`, nazwa, dzielnik }]);
    ustawNowaNazwe("");
    ustawNowyDzielnik("");
  };

  return (
    <Card className="p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold">Przewoźnicy i dzielniki</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Dzielnik dla GEIS Polska = 10 000 (paczki). DPD = 6 000. GLS = 4 000. Zmiany
            zapisują się automatycznie.
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
            onClick={() => {
              przywrocDomyslne();
              toast({
                title: "Przywrócono",
                description: "Domyślna lista przewoźników i dzielników.",
              });
            }}
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
                      value={przewoznik.nazwa}
                      onChange={(zdarzenie) => zmienNazwe(przewoznik.id, zdarzenie.target.value)}
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
                      value={przewoznik.dzielnik}
                      onChange={(zdarzenie) =>
                        zmienDzielnik(przewoznik.id, zdarzenie.target.value)
                      }
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
                      onClick={() => usun(przewoznik.id)}
                      data-testid={`button-usun-${przewoznik.id}`}
                      aria-label={`Usuń ${przewoznik.nazwa}`}
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
            <Button onClick={dodaj} data-testid="button-dodaj-przewoznika">
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
