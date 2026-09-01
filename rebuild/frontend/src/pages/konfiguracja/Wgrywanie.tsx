/**
 * Zakładka „Wgrywanie ręczne" — odtworzenie `JT()` + `Cd()`
 * (`deminified/frontend-index.js:18848-19180`, `:26147-26200`).
 *
 * Przepływ jak w oryginale: wybór plików → detekcja dostawcy w przeglądarce
 * (`przeanalizujPlik`) → możliwość nadpisania dostawcy z listy → wysłanie ORYGINALNYCH
 * plików przez `FormData`. Przeglądarka niczego nie przepisuje; backend parsuje od zera.
 *
 * ⚠ Podgląd pozycji pochodzi z ODPOWIEDZI backendu (`podglad`, 5 rekordów), nie z parsowania
 * w przeglądarce — decyzja sesji 3f-1, uzasadnienie w `konfiguracja/detekcja.ts`.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { przeanalizujPlik, wymusDostawce, type AnalizaPliku } from "./detekcja";
import { wgrajPlik, type WynikUploadu } from "./wgrywanie";

type Dostawca = {
  kod: string;
  nazwa: string;
  email: string | null;
  formatPliku: string;
  status: string;
};

/** Stan jednej pozycji na liście do wgrania. */
type PozycjaKolejki = {
  id: string;
  analiza: AnalizaPliku;
  stan: "oczekuje" | "wysylanie" | "gotowe" | "blad";
  wynik?: WynikUploadu;
  blad?: string;
};

const ETYKIETY_PEWNOSCI: Record<string, string> = {
  wysoka: "wysoka pewność",
  srednia: "średnia pewność",
  brak: "nie rozpoznano",
  wymuszona: "wybrane ręcznie",
};

function formatujRozmiar(bajty: number): string {
  if (bajty < 1024) return `${bajty} B`;
  if (bajty < 1024 * 1024) return `${Math.round(bajty / 1024)} KB`;
  return `${(bajty / (1024 * 1024)).toFixed(1)} MB`;
}

export function Wgrywanie() {
  const klient = useQueryClient();
  const { data: dostawcy = [] } = useQuery<Dostawca[]>({ queryKey: ["/api/dostawcy"] });
  const [kolejka, ustawKolejke] = useState<PozycjaKolejki[]>([]);
  const [wysylanie, ustawWysylanie] = useState(false);
  const [bledyWczytania, ustawBledyWczytania] = useState<string[]>([]);
  const wejscie = useRef<HTMLInputElement>(null);

  const dodajPliki = async (pliki: FileList | null) => {
    if (!pliki || pliki.length === 0) return;
    const nowe: PozycjaKolejki[] = [];
    const bledy: string[] = [];

    for (const plik of Array.from(pliki)) {
      try {
        const analiza = await przeanalizujPlik(plik);
        nowe.push({
          id: `${plik.name}-${plik.size}-${Date.now()}-${nowe.length}`,
          analiza,
          stan: "oczekuje",
        });
      } catch (e) {
        // Oryginał pokazywał to toastem „Błąd pliku <nazwa>" (`:18876`); nie mamy jeszcze
        // Toastera (wchodzi z iteracją, która go pierwsza użyje), więc lista na miejscu.
        bledy.push(`${plik.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    ustawBledyWczytania(bledy);
    ustawKolejke((poprzednia) => [...poprzednia, ...nowe]);
  };

  const zmienDostawce = (id: string, kod: string) => {
    ustawKolejke((poprzednia) =>
      poprzednia.map((p) => (p.id === id ? { ...p, analiza: wymusDostawce(p.analiza, kod) } : p)),
    );
  };

  const usun = (id: string) => {
    ustawKolejke((poprzednia) => poprzednia.filter((p) => p.id !== id));
  };

  const wyczysc = () => {
    ustawKolejke([]);
    ustawBledyWczytania([]);
    if (wejscie.current) wejscie.current.value = "";
  };

  const wyslij = async () => {
    ustawWysylanie(true);
    // Sekwencyjnie, nie równolegle: import jednego dostawcy pisze do stagingu i przelicza
    // `tk()`, a dwa naraz nie dają nic poza trudniejszym do odczytania błędem.
    for (const pozycja of kolejka) {
      const kod = pozycja.analiza.detekcja.kod;
      if (!kod || pozycja.stan === "gotowe") continue;

      ustawKolejke((p) =>
        p.map((x) => (x.id === pozycja.id ? { ...x, stan: "wysylanie" as const } : x)),
      );
      try {
        const wynik = await wgrajPlik(kod, pozycja.analiza.plik);
        ustawKolejke((p) =>
          p.map((x) => (x.id === pozycja.id ? { ...x, stan: "gotowe" as const, wynik } : x)),
        );
      } catch (e) {
        // GATE 3f-1: nieudany parse MUSI być widoczny. Komunikat backendu idzie wprost
        // na ekran, pozycja zostaje w kolejce oznaczona jako błędna.
        ustawKolejke((p) =>
          p.map((x) =>
            x.id === pozycja.id
              ? { ...x, stan: "blad" as const, blad: e instanceof Error ? e.message : String(e) }
              : x,
          ),
        );
      }
    }
    ustawWysylanie(false);

    // Te same unieważnienia co w oryginale (`sP()`, `:18838-18842`).
    void klient.invalidateQueries({ queryKey: ["/api/staging"] });
    void klient.invalidateQueries({ queryKey: ["/api/products"] });
    void klient.invalidateQueries({ queryKey: ["/api/dostawcy"] });
    void klient.invalidateQueries({ queryKey: ["/api/suppliers"] });
  };

  const doWyslania = kolejka.filter((p) => p.analiza.detekcja.kod && p.stan !== "gotowe").length;

  return (
    <div className="space-y-4" data-testid="zakladka-wgrywanie">
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div>
            <h2 className="font-medium">Wgraj pliki — auto-detekcja dostawcy</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Bridge rozpozna dostawcę po nazwie pliku i nagłówkach. Możesz wgrać wiele plików
              naraz. Pozycje trafiają do stagingu — po zatwierdzeniu pojawiają się w katalogu.
              Obsługiwane są pliki CSV oraz XLSX (MO8, MO10), do 50 MB.
            </p>
          </div>

          <input
            ref={wejscie}
            type="file"
            multiple
            accept=".csv,.txt,.xlsx,.xls"
            data-testid="input-pliki"
            aria-label="Pliki cennika"
            onChange={(e) => void dodajPliki(e.target.files)}
            className="block text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium"
          />

          {bledyWczytania.length > 0 && (
            <ul className="text-sm text-destructive space-y-1" data-testid="bledy-wczytania">
              {bledyWczytania.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {kolejka.length > 0 && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-medium">Do wgrania ({kolejka.length})</h2>
              <div className="flex gap-2">
                <Button variant="outline" onClick={wyczysc} disabled={wysylanie}>
                  Wyczyść listę
                </Button>
                <Button
                  onClick={() => void wyslij()}
                  disabled={wysylanie || doWyslania === 0}
                  data-testid="button-wyslij"
                >
                  {wysylanie ? "Wgrywanie…" : `Wgraj (${doWyslania})`}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {kolejka.map((pozycja) => (
                <PozycjaListy
                  key={pozycja.id}
                  pozycja={pozycja}
                  dostawcy={dostawcy}
                  zablokowane={wysylanie}
                  onZmienDostawce={(kod) => zmienDostawce(pozycja.id, kod)}
                  onUsun={() => usun(pozycja.id)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PozycjaListy({
  pozycja,
  dostawcy,
  zablokowane,
  onZmienDostawce,
  onUsun,
}: {
  pozycja: PozycjaKolejki;
  dostawcy: Dostawca[];
  zablokowane: boolean;
  onZmienDostawce: (kod: string) => void;
  onUsun: () => void;
}) {
  const { analiza, stan, wynik, blad } = pozycja;
  const { detekcja } = analiza;

  return (
    <div
      className="border border-border rounded-md p-3 bg-card space-y-2"
      data-testid={`pozycja-${analiza.nazwaPliku}`}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-mono text-sm font-medium">{analiza.nazwaPliku}</span>
        <span className="text-xs text-muted-foreground">{formatujRozmiar(analiza.rozmiar)}</span>
        {analiza.arkusz && <span className="text-xs text-muted-foreground">arkusz XLSX</span>}
        {analiza.liczbaWierszy !== null && (
          <span className="text-xs text-muted-foreground">{analiza.liczbaWierszy} wierszy</span>
        )}
      </div>

      <p className="text-xs text-muted-foreground" data-testid="powod-detekcji">
        {detekcja.kod ? `${detekcja.kod} · ${ETYKIETY_PEWNOSCI[detekcja.pewnosc]}` : "—"} ·{" "}
        {detekcja.powod}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={detekcja.kod}
          onValueChange={onZmienDostawce}
          disabled={zablokowane || stan === "gotowe"}
        >
          <SelectTrigger className="w-56" aria-label={`Dostawca dla ${analiza.nazwaPliku}`}>
            <SelectValue placeholder="Wybierz dostawcę" />
          </SelectTrigger>
          <SelectContent>
            {dostawcy.map((d) => (
              <SelectItem key={d.kod} value={d.kod}>
                {d.kod} — {d.nazwa}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="ghost" onClick={onUsun} disabled={zablokowane}>
          Usuń
        </Button>
      </div>

      {stan === "gotowe" && wynik && (
        <div className="text-sm space-y-2" data-testid="wynik-uploadu">
          <p className="text-foreground">
            Wczytano {wynik.liczbaProduktow} pozycji · do stagingu: {wynik.doStagingu} · nowe:{" "}
            {wynik.nowe} · zmienione: {wynik.zmienione} · wycofane: {wynik.wycofane} ·
            auto-zatwierdzone: {wynik.autoZatwierdzone}
          </p>
          {wynik.podglad?.length > 0 && (
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead>
                  <tr className="text-muted-foreground text-left">
                    <th className="pr-3 font-medium">Kod</th>
                    <th className="pr-3 font-medium">Nazwa</th>
                    <th className="pr-3 font-medium">Rozmiar</th>
                    <th className="pr-3 font-medium">Cena zakupu</th>
                    <th className="font-medium">Stan</th>
                  </tr>
                </thead>
                <tbody>
                  {wynik.podglad.map((r, i) => (
                    <tr key={`${r.kod ?? ""}-${i}`}>
                      <td className="pr-3 font-mono">{r.kod ?? "—"}</td>
                      <td className="pr-3">{r.nazwa ?? "—"}</td>
                      <td className="pr-3">{r.rozmiar ?? "—"}</td>
                      <td className="pr-3">{r.cenaZakupu ?? "—"}</td>
                      <td>{r.stan ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {stan === "blad" && (
        <p className="text-sm text-destructive" data-testid="blad-uploadu">
          Nie udało się wgrać: {blad}
        </p>
      )}
      {stan === "wysylanie" && <p className="text-sm text-muted-foreground">Wgrywanie…</p>}
    </div>
  );
}
