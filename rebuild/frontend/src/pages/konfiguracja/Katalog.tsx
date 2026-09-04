/**
 * Zakładka „Katalog" — port karty `XT()` (`deminified/frontend-index.js:26020-26145`),
 * BEZ części destrukcyjnej.
 *
 * ⚠ Ta zakładka NIE DOTYKA `/api/config`. Wbrew temu, czego można się spodziewać po nazwie,
 * cały jej stan siedzi w IndexedDB pod kluczem `konfig-domyslne-kolumny` — tym samym,
 * którego używa konfigurator kolumn w `/katalog` (`lib/magazynKV`). Zapis tutaj zmienia więc
 * to, co Ania zobaczy po kliknięciu „Domyślne" w panelu kolumn katalogu. Żadnego żądania
 * sieciowego stąd nie wychodzi — w oryginale też nie.
 *
 * Destrukcyjny przycisk „Usuń wszystko z katalogu" (`:26101-26134`) dołożyła Iteracja 12b
 * razem z trasą `POST /api/products/clear` — karta jest od tego momentu KOMPLETNA wobec
 * oryginału (odstępstwo D3 ticketu 18 zniesione).
 */
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { KLUCZ_KOLUMN_KATALOGU, odczytajKV, zapiszKV } from "@/lib/magazynKV";
import { KOLUMNY, KOLUMNY_DOMYSLNE } from "../katalog/kolumny";
import { TEKST_POTWIERDZENIA, wyczyscKatalog } from "./katalog";

export function Katalog() {
  const [wybrane, ustawWybrane] = useState<Set<string>>(new Set(KOLUMNY_DOMYSLNE));
  const [wczytano, ustawWczytano] = useState(false);
  const [komunikat, ustawKomunikat] = useState<string | null>(null);
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [czyszczenie, ustawCzyszczenie] = useState(false);
  const { toast } = useToast();
  const klientZapytan = useQueryClient();

  /**
   * Czyszczenie CAŁEGO katalogu — port `:26101-26134`.
   *
   * ⚠ `window.confirm` jest tu ŚWIADOMY, mimo że reszta odbudowy zastąpiła natywne dialogi
   * komponentami Radix (odstępstwo D2 sesji 7b). Ta operacja jest nieodwracalna i dotyka
   * wszystkich dostawców naraz, więc blokujący dialog przeglądarki — którego nie da się
   * kliknąć „obok" ani zamknąć Escapem bez decyzji — jest tu zaletą, nie zaniedbaniem.
   * Treść pytania dosłownie z oryginału.
   */
  async function wyczysc() {
    if (!window.confirm(TEKST_POTWIERDZENIA)) return;

    ustawCzyszczenie(true);
    try {
      await wyczyscKatalog();
      toast({
        title: "Katalog wyczyszczony",
        description: "Usunięto wszystkie pozycje z katalogu",
      });
      // Trzy klucze 1:1 z oryginałem (`:26117-26125`). Alerty i analityka liczą się
      // z katalogu, więc bez ich unieważnienia pokazywałyby dane sprzed czyszczenia.
      for (const klucz of ["/api/products", "/api/alerts", "/api/analytics"]) {
        void klientZapytan.invalidateQueries({ queryKey: [klucz] });
      }
    } catch (blad) {
      toast({
        title: "Błąd czyszczenia",
        description: blad instanceof Error ? blad.message : String(blad),
        variant: "destructive",
      });
    } finally {
      ustawCzyszczenie(false);
    }
  }

  useEffect(() => {
    void (async () => {
      const zapisane = await odczytajKV<string[]>(KLUCZ_KOLUMN_KATALOGU);
      // Warunek 1:1 z `:26026`: pusta tablica NIE nadpisuje zestawu fabrycznego —
      // inaczej ktoś, kto raz odznaczył wszystko, zostałby z tabelą bez kolumn.
      if (Array.isArray(zapisane) && zapisane.length > 0) ustawWybrane(new Set(zapisane));
      ustawWczytano(true);
    })();
  }, []);

  function przelacz(klucz: string) {
    ustawWybrane((biezace) => {
      const nowe = new Set(biezace);
      if (nowe.has(klucz)) nowe.delete(klucz);
      else nowe.add(klucz);
      return nowe;
    });
  }

  async function zapisz() {
    ustawZapisywanie(true);
    try {
      await zapiszKV(KLUCZ_KOLUMN_KATALOGU, Array.from(wybrane));
      ustawKomunikat(`${wybrane.size} kolumn będzie domyślnie pokazywanych w katalogu`);
    } finally {
      ustawZapisywanie(false);
    }
  }

  async function przywrocFabryczne() {
    ustawWybrane(new Set(KOLUMNY_DOMYSLNE));
    await zapiszKV(KLUCZ_KOLUMN_KATALOGU, KOLUMNY_DOMYSLNE);
    ustawKomunikat(`Przywrócono fabryczne: ${KOLUMNY_DOMYSLNE.length} kolumn`);
  }

  if (!wczytano) {
    return (
      <Card className="border-card-border">
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground">Wczytywanie…</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-card-border">
      <CardContent className="p-5">
        <div className="mb-4">
          <h3 className="text-sm font-medium">Domyślne kolumny katalogu</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Wybierz które kolumny mają być pokazywane domyślnie w tabeli katalogu i w przycisku
            „Domyślne" w panelu kolumn
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              Zaznaczone:{" "}
              <b className="text-foreground font-mono" data-testid="licznik-kolumn">
                {wybrane.size}
              </b>{" "}
              / {KOLUMNY.length}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-[500px] overflow-y-auto border rounded-md p-3">
            {KOLUMNY.map((kolumna) => (
              <label
                key={kolumna.key}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover-elevate cursor-pointer text-sm"
                data-testid={`row-kolumna-${kolumna.key}`}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input accent-primary"
                  checked={wybrane.has(kolumna.key)}
                  onChange={() => przelacz(kolumna.key)}
                />
                <span className="flex-1 truncate">{kolumna.label}</span>
                <span className="text-[10px] text-muted-foreground font-mono">{kolumna.key}</span>
              </label>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button
              onClick={() => void zapisz()}
              disabled={zapisywanie}
              data-testid="button-save-default-cols"
            >
              {zapisywanie ? "Zapisywanie…" : "Zapisz jako domyślne"}
            </Button>
            <Button
              variant="outline"
              onClick={() => void przywrocFabryczne()}
              disabled={zapisywanie}
              data-testid="button-restore-default-cols"
            >
              Przywróć fabryczne ({KOLUMNY_DOMYSLNE.length} kolumn)
            </Button>
          </div>

          {komunikat ? (
            <p className="text-[11px] text-muted-foreground" data-testid="komunikat-katalog">
              {komunikat}
            </p>
          ) : null}

          <div className="border-t pt-3">
            <Button
              variant="destructive"
              onClick={() => void wyczysc()}
              disabled={zapisywanie || czyszczenie}
              data-testid="button-clear-products-work"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {czyszczenie ? "Czyszczenie..." : "Usuń wszystko z katalogu"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
