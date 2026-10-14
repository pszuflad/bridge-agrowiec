/** Sekcja „Podgląd pliku” (ticket 224, PRT-5.3): pierwsze wiersze plików, które powstałyby przy generowaniu — bez zapisu. */
import { useMutation } from "@tanstack/react-query";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { komunikatBledu, pobierzPlikPartnera, pobierzPodglad, type SzczegolyPartnera, type WynikPodgladu } from "./api";

const MAKS_POKAZANYCH = 20;

function Lista({ tytul, pozycje, testId, wariant }: { tytul: string; pozycje: string[]; testId: string; wariant: "blad" | "uwaga" }) {
  if (pozycje.length === 0) return null;
  return (
    <div data-testid={testId}>
      <h3 className={`text-xs font-semibold ${wariant === "blad" ? "text-destructive" : "text-amber-600"}`}>{tytul} ({pozycje.length})</h3>
      <ul className="list-disc pl-5 text-xs">
        {pozycje.slice(0, MAKS_POKAZANYCH).map((p, i) => <li key={i}>{p}</li>)}
      </ul>
      {pozycje.length > MAKS_POKAZANYCH ? <p className="text-xs text-muted-foreground">… i {pozycje.length - MAKS_POKAZANYCH} kolejnych.</p> : null}
    </div>
  );
}

export function PodgladPliku({ partner }: { partner: SzczegolyPartnera }) {
  const podglad = useMutation<WynikPodgladu, Error, void>({ mutationFn: () => pobierzPodglad(partner.id) });
  const wynik = podglad.data;
  const pobierz = useMutation<void, Error, string>({ mutationFn: (nazwa) => pobierzPlikPartnera(partner.id, nazwa) });

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">Podgląd pliku</h2>
        <p className="text-xs text-muted-foreground">Pierwsze 20 pozycji, tak jak wyglądałby plik partnera. „Pobierz cały plik” daje kompletny plik (wszystkie pozycje) na Twój komputer. Nic nie jest zapisywane u partnera ani wysyłane.</p>
        <Button size="sm" variant="outline" onClick={() => podglad.mutate()} disabled={podglad.isPending} data-testid="button-podglad">{podglad.isPending ? "Liczenie…" : "Pokaż podgląd"}</Button>
        {podglad.isError ? <p className="text-sm text-destructive" role="alert" data-testid="text-podglad-blad">{komunikatBledu(podglad.error)}</p> : null}
        {pobierz.isError ? <p className="text-sm text-destructive" role="alert" data-testid="text-pobierz-blad">{komunikatBledu(pobierz.error)}</p> : null}
        {wynik ? (
          <div className="space-y-3" data-testid="wynik-podgladu">
            <p className="text-xs text-muted-foreground">Pozycji do eksportu: {wynik.pozycjeWybrane}.</p>
            {wynik.pliki.length === 0 ? <p className="text-sm" data-testid="text-podglad-brak-plikow">Plik nie powstałby — sprawdź błędy poniżej.</p> : null}
            {wynik.pliki.map((p) => (
              <div key={p.nazwa} data-testid={`podglad-plik-${p.nazwa}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold">{p.nazwa} <span className="font-normal text-muted-foreground">({p.liczbaWierszy} wierszy w podglądzie)</span></h3>
                  <Button size="sm" variant="outline" onClick={() => pobierz.mutate(p.nazwa)} disabled={pobierz.isPending} data-testid={`button-pobierz-${p.nazwa}`}>
                    <Download className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                    {pobierz.isPending && pobierz.variables === p.nazwa ? "Przygotowanie…" : "Pobierz cały plik"}
                  </Button>
                </div>
                <pre className="max-h-72 overflow-auto rounded-md bg-muted p-2 text-xs">{p.tekst}</pre>
              </div>
            ))}
            <Lista tytul="Błędy" pozycje={wynik.bledy} testId="lista-podglad-bledy" wariant="blad" />
            <Lista tytul="Ostrzeżenia" pozycje={wynik.ostrzezenia} testId="lista-podglad-ostrzezenia" wariant="uwaga" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
