/**
 * Zakładka „Nieobecne w imporcie” w Katalogu — ticket 207 (decyzja użytkowniczki 2026-10-10). NOWY ekran, spoza produkcji.
 *
 * Pozycje wstrzymane automatycznie, bo zniknęły z kompletnego cennika dostawcy, po progu dni od wstrzymania (7; dla
 * Nokiana MO7 i Trelleborga MO8 bez bufora). Decyzja człowieka: „Usuń” (karta trafia do archiwum, można ją odtworzyć)
 * albo „Przywróć jako aktywne”. Widoczne dla każdego zalogowanego.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DialogPotwierdzenia } from "@/components/DialogPotwierdzenia";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { zadanie } from "@/lib/api";

export const KLUCZ_NIEOBECNE = ["/api/nieobecne"] as const;

export type PozycjaNieobecna = {
  id: number;
  kod: string;
  nazwa: string | null;
  dostawca: string;
  marka: string | null;
  rozmiar: string | null;
  ean: string | null;
  stan: number | null;
  cenaZakupu: number | null;
  wstrzymanoO: string;
  dniNieobecnosci: number;
  powod: string;
};

type Odpowiedz = { progDniDomyslny: number; progDniDostawcow: Record<string, number>; items: PozycjaNieobecna[] };

const formatData = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("pl-PL");
};

export function NieobecneWImporcie() {
  const klient = useQueryClient();
  const { data, isLoading, isError } = useQuery<Odpowiedz>({ queryKey: KLUCZ_NIEOBECNE });
  const pozycje = data?.items ?? [];
  const [zaznaczone, ustawZaznaczone] = useState<Set<number>>(new Set());
  const [pytanie, ustawPytanie] = useState<"usun" | "przywroc" | null>(null);
  const [komunikat, ustawKomunikat] = useState<string | null>(null);

  const idy = [...zaznaczone].filter((id) => pozycje.some((p) => p.id === id));
  const wszystkieZaznaczone = pozycje.length > 0 && idy.length === pozycje.length;

  const akcja = useMutation({
    mutationFn: async ({ rodzaj, ids }: { rodzaj: "usun" | "przywroc"; ids: number[] }) => {
      const odp = await zadanie("POST", `/api/nieobecne/${rodzaj}`, { ids });
      return { rodzaj, wynik: (await odp.json()) as { usuniete?: number; przywrocone?: number } };
    },
    onSuccess: async ({ rodzaj, wynik }) => {
      ustawKomunikat(
        rodzaj === "usun"
          ? `Usunięto pozycji: ${wynik.usuniete ?? 0} (karty zapisane w archiwum)`
          : `Przywrócono jako aktywne: ${wynik.przywrocone ?? 0}`,
      );
      ustawZaznaczone(new Set());
      await klient.invalidateQueries({ queryKey: KLUCZ_NIEOBECNE });
      await klient.invalidateQueries({ queryKey: ["/api/products"] });
    },
    onError: (e: Error) => ustawKomunikat(`Błąd: ${e.message}`),
  });

  const przelacz = (id: number) =>
    ustawZaznaczone((poprzednie) => {
      const nowe = new Set(poprzednie);
      if (nowe.has(id)) nowe.delete(id);
      else nowe.add(id);
      return nowe;
    });

  return (
    <div data-testid="zakladka-nieobecne">
      <Card className="border-card-border mb-4">
        <CardContent className="p-4 text-sm text-muted-foreground">
          Pozycje, których nie ma już w cenniku dostawcy (system wstrzymał je automatycznie) — od{" "}
          {data?.progDniDomyslny ?? 7} dni, a dla dostawców z rocznym cennikiem ({Object.keys(data?.progDniDostawcow ?? {}).join(", ") || "—"}) od razu.
          Usunięcie zapisuje kartę w archiwum. „Przywróć jako aktywne” działa do następnego importu: jeśli pozycji nadal nie ma w pliku,
          system wstrzyma ją ponownie i wróci tu po upływie progu.
        </CardContent>
      </Card>

      {komunikat ? (
        <p className="mb-2 text-sm text-muted-foreground" role="status" data-testid="komunikat-nieobecne">
          {komunikat}
        </p>
      ) : null}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={idy.length === 0 || akcja.isPending}
          onClick={() => ustawPytanie("przywroc")}
          data-testid="button-nieobecne-przywroc"
        >
          Przywróć jako aktywne ({idy.length})
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={idy.length === 0 || akcja.isPending}
          onClick={() => ustawPytanie("usun")}
          data-testid="button-nieobecne-usun"
        >
          Usuń ({idy.length})
        </Button>
      </div>

      <Card className="border-card-border">
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Ładowanie…</div>
          ) : isError ? (
            <div className="p-8 text-center text-sm text-red-600">Nie udało się pobrać listy.</div>
          ) : pozycje.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground" data-testid="nieobecne-puste">
              Brak pozycji do decyzji.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="p-2 w-8">
                    <input
                      type="checkbox"
                      aria-label="Zaznacz wszystkie"
                      checked={wszystkieZaznaczone}
                      onChange={() => ustawZaznaczone(wszystkieZaznaczone ? new Set() : new Set(pozycje.map((p) => p.id)))}
                      data-testid="checkbox-nieobecne-wszystkie"
                    />
                  </th>
                  <th className="p-2">Dostawca</th>
                  <th className="p-2">Kod</th>
                  <th className="p-2">Nazwa</th>
                  <th className="p-2">EAN</th>
                  <th className="p-2 text-right">Wstrzymano</th>
                  <th className="p-2 text-right">Dni bez pozycji w pliku</th>
                </tr>
              </thead>
              <tbody>
                {pozycje.map((p) => (
                  <tr key={p.id} className="border-b last:border-0" data-testid={`wiersz-nieobecne-${p.kod}`}>
                    <td className="p-2">
                      <input
                        type="checkbox"
                        aria-label={`Zaznacz ${p.kod}`}
                        checked={zaznaczone.has(p.id)}
                        onChange={() => przelacz(p.id)}
                      />
                    </td>
                    <td className="p-2 font-mono">{p.dostawca}</td>
                    <td className="p-2 font-mono text-xs">{p.kod}</td>
                    <td className="p-2">{p.nazwa ?? "—"}</td>
                    <td className="p-2 font-mono text-xs">{p.ean ?? "—"}</td>
                    <td className="p-2 text-right">{formatData(p.wstrzymanoO)}</td>
                    <td className="p-2 text-right font-mono">{p.dniNieobecnosci}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <DialogPotwierdzenia
        otwarty={pytanie === "usun"}
        tytul="Usunięcie pozycji"
        tresc={`Usunąć ${idy.length} pozycji z katalogu? Każda karta zostanie zapisana w archiwum. Jeśli pozycja jest w Selly, jej produkt trafi do usunięcia po kontroli tożsamości.`}
        etykietaPotwierdzenia="Usuń"
        wariantPotwierdzenia="destructive"
        zajety={akcja.isPending}
        onPotwierdz={() => {
          ustawPytanie(null);
          akcja.mutate({ rodzaj: "usun", ids: idy });
        }}
        onZamknij={() => ustawPytanie(null)}
        testId="dialog-nieobecne-usun"
      />
      <DialogPotwierdzenia
        otwarty={pytanie === "przywroc"}
        tytul="Przywrócenie pozycji"
        tresc={`Przywrócić ${idy.length} pozycji jako aktywne? Jeśli ich nadal nie ma w pliku dostawcy, następny import wstrzyma je ponownie.`}
        etykietaPotwierdzenia="Przywróć"
        zajety={akcja.isPending}
        onPotwierdz={() => {
          ustawPytanie(null);
          akcja.mutate({ rodzaj: "przywroc", ids: idy });
        }}
        onZamknij={() => ustawPytanie(null)}
        testId="dialog-nieobecne-przywroc"
      />
    </div>
  );
}
