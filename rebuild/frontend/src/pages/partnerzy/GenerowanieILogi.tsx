/** Akcje partnera (aktywność, „Generuj teraz”) oraz logi operacji i błędów (ticket 225, PRT-5.4). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import {
  KLUCZ_PARTNERZY, generujTeraz, komunikatBledu, kluczBledow, kluczLogow, ustawAktywnosc,
  type FiltrPoziomu, type ListaBledow, type ListaLogow, type SzczegolyPartnera, type WynikGenerowania,
} from "./api";

const czas = (iso: string): string => new Date(iso).toLocaleString("pl-PL");

export function AkcjePartnera({ partner }: { partner: SzczegolyPartnera }) {
  const klient = useQueryClient();
  const { toast } = useToast();
  const odswiez = () => klient.invalidateQueries({ queryKey: [KLUCZ_PARTNERZY] });

  const aktywacja = useMutation<void, Error, void>({
    mutationFn: () => ustawAktywnosc(partner.id, !partner.aktywny),
    onSuccess: async () => {
      toast({ title: partner.aktywny ? "Partner dezaktywowany" : "Partner aktywowany", description: partner.nazwa });
      await odswiez();
    },
    onError: (e) => toast({ title: "Nie udało się zmienić aktywności", description: komunikatBledu(e), variant: "destructive" }),
  });
  const generowanie = useMutation<WynikGenerowania, Error, void>({
    mutationFn: () => generujTeraz(partner.id),
    onSuccess: async (w) => {
      const zapisane = w.pliki.filter((p) => p.zapisany).length;
      toast({
        title: zapisane > 0 ? "Wygenerowano pliki" : "Nie zapisano żadnego pliku",
        description: `Plików: ${zapisane}, błędów: ${w.bledy.length}, ostrzeżeń: ${w.ostrzezenia.length}.`,
        variant: zapisane > 0 ? "default" : "destructive",
      });
      await odswiez();
    },
    onError: (e) => toast({ title: "Generowanie nie powiodło się", description: komunikatBledu(e), variant: "destructive" }),
  });
  const wynik = generowanie.data;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={partner.aktywny ? "default" : "secondary"} data-testid="badge-partner-szczegoly-status">{partner.aktywny ? "Aktywny" : "Nieaktywny"}</Badge>
          <Button size="sm" variant="outline" disabled={aktywacja.isPending} onClick={() => aktywacja.mutate()} data-testid="button-szczegoly-aktywnosc">{partner.aktywny ? "Dezaktywuj" : "Aktywuj"}</Button>
          <Button size="sm" disabled={generowanie.isPending} onClick={() => generowanie.mutate()} data-testid="button-generuj-teraz">{generowanie.isPending ? "Generowanie…" : "Generuj teraz"}</Button>
          <span className="text-xs text-muted-foreground">Generowanie działa też dla partnera nieaktywnego; pliki trafiają do katalogu serwera, nie do partnera.</span>
        </div>
        {wynik ? (
          <div className="space-y-1 text-sm" data-testid="wynik-generowania">
            <p className="text-xs text-muted-foreground">Pozycji do eksportu: {wynik.pozycjeWybrane}.</p>
            {wynik.pliki.length === 0 ? <p>Nie powstał żaden plik — szczegóły w błędach poniżej.</p> : null}
            <ul className="list-disc pl-5">
              {wynik.pliki.map((p) => (
                <li key={p.nazwa} data-testid={`wynik-plik-${p.nazwa}`}>
                  {p.nazwa}: {p.zapisany ? `zapisano (${p.liczbaWierszy} pozycji${p.pominiete ? `, pominięto ${p.pominiete}` : ""})` : "NIE zapisano — poprzedni cennik zostaje"}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function LogiPartnera({ partner }: { partner: SzczegolyPartnera }) {
  const [poziom, ustawPoziom] = useState<FiltrPoziomu>("wszystkie");
  const logi = useQuery<ListaLogow | null>({ queryKey: kluczLogow(partner.id), refetchOnMount: "always" });
  const bledy = useQuery<ListaBledow | null>({ queryKey: kluczBledow(partner.id, poziom), refetchOnMount: "always" });
  const odswiez = () => {
    void logi.refetch();
    void bledy.refetch();
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Logi operacji</h2>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={odswiez} data-testid="button-logi-odswiez"><RefreshCw className="h-3.5 w-3.5" aria-hidden />Odśwież</Button>
        </div>
        <p className="text-xs text-muted-foreground">Jedna linia na operację; wpisy starsze niż 30 dni są usuwane.</p>
        {logi.isError ? <p className="text-sm text-destructive" role="alert" data-testid="text-logi-blad">{komunikatBledu(logi.error)}</p> : null}
        {logi.data && logi.data.logi.length === 0 ? <p className="text-sm text-muted-foreground" data-testid="text-logi-pusto">Brak wpisów — nic jeszcze nie generowano.</p> : null}
        {logi.data && logi.data.logi.length > 0 ? (
          <ul className="divide-y text-sm" data-testid="lista-logow">
            {logi.data.logi.map((l) => (
              <li key={l.id} className="py-1.5" data-testid={`log-${l.id}`}>
                <span className="text-xs text-muted-foreground">{czas(l.kiedy)}</span> — {l.opis}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <h2 className="text-sm font-semibold">Błędy i ostrzeżenia</h2>
          <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" aria-label="Poziom wpisów" value={poziom} onChange={(e) => ustawPoziom(e.target.value as FiltrPoziomu)} data-testid="select-bledy-poziom">
            <option value="wszystkie">wszystkie</option>
            <option value="blad">tylko błędy</option>
            <option value="ostrzezenie">tylko ostrzeżenia</option>
          </select>
        </div>
        {bledy.isError ? <p className="text-sm text-destructive" role="alert" data-testid="text-bledy-blad">{komunikatBledu(bledy.error)}</p> : null}
        {bledy.data && bledy.data.bledy.length === 0 ? <p className="text-sm text-muted-foreground" data-testid="text-bledy-pusto">Brak wpisów.</p> : null}
        {bledy.data && bledy.data.bledy.length > 0 ? (
          <ul className="divide-y text-sm" data-testid="lista-bledow">
            {bledy.data.bledy.map((b) => (
              <li key={b.id} className="flex flex-wrap items-baseline gap-2 py-1.5" data-testid={`blad-${b.id}`}>
                <Badge variant={b.poziom === "blad" ? "destructive" : "secondary"}>{b.poziom === "blad" ? "błąd" : "ostrzeżenie"}</Badge>
                <span className="text-xs text-muted-foreground">{czas(b.kiedy)}</span>
                <span>{b.komunikat}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
