/** Sekcja „Podgląd pliku” (ticket 224, PRT-5.3): pierwsze wiersze plików, które powstałyby przy generowaniu — bez zapisu. */
import { useMutation } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { komunikatBledu, pobierzPodglad, type SzczegolyPartnera, type WynikPodgladu } from "./api";

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

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">Podgląd pliku</h2>
        <p className="text-xs text-muted-foreground">Pierwsze 20 pozycji, tak jak wyglądałby plik partnera. Nic nie jest zapisywane ani wysyłane.</p>
        <Button size="sm" variant="outline" onClick={() => podglad.mutate()} disabled={podglad.isPending} data-testid="button-podglad">{podglad.isPending ? "Liczenie…" : "Pokaż podgląd"}</Button>
        {podglad.isError ? <p className="text-sm text-destructive" role="alert" data-testid="text-podglad-blad">{komunikatBledu(podglad.error)}</p> : null}
        {wynik ? (
          <div className="space-y-3" data-testid="wynik-podgladu">
            <p className="text-xs text-muted-foreground">Pozycji do eksportu: {wynik.pozycjeWybrane}.</p>
            {wynik.pliki.length === 0 ? <p className="text-sm" data-testid="text-podglad-brak-plikow">Plik nie powstałby — sprawdź błędy poniżej.</p> : null}
            {wynik.pliki.map((p) => (
              <div key={p.nazwa} data-testid={`podglad-plik-${p.nazwa}`}>
                <h3 className="text-xs font-semibold">{p.nazwa} <span className="font-normal text-muted-foreground">({p.liczbaWierszy} wierszy w podglądzie)</span></h3>
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
