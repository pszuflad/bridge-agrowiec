/** Sekcje „Magazyny” i „Wykluczone produkty” w konfiguracji partnera (ticket 222, PRT-5.2). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { KLUCZ_PARTNERZY, komunikatBledu, zapiszMagazyny, zapiszWykluczenia, type MagazynKatalogu, type SzczegolyPartnera } from "./api";

export function MagazynyPartnera({ partner }: { partner: SzczegolyPartnera }) {
  const klient = useQueryClient();
  const { toast } = useToast();
  const { data } = useQuery<{ magazyny: MagazynKatalogu[] } | null>({ queryKey: [KLUCZ_PARTNERZY, "magazyny"] });
  const [wybrane, ustawWybrane] = useState<string[]>(partner.magazyny);

  // magazyny partnera, których (już) nie ma w katalogu, zostają widoczne — żeby dało się je odznaczyć
  const nazwy = [...new Set([...(data?.magazyny.map((m) => m.magazyn) ?? []), ...partner.magazyny])].sort();
  const liczby = new Map(data?.magazyny.map((m) => [m.magazyn, m.liczbaPozycji]) ?? []);
  const przelacz = (m: string) => ustawWybrane((a) => (a.includes(m) ? a.filter((x) => x !== m) : [...a, m]));

  const zapis = useMutation<void, Error, void>({
    mutationFn: () => zapiszMagazyny(partner.id, wybrane),
    onSuccess: async () => {
      toast({ title: "Zapisano magazyny partnera" });
      await klient.invalidateQueries({ queryKey: [KLUCZ_PARTNERZY] });
    },
    onError: (e) => toast({ title: "Nie udało się zapisać magazynów", description: komunikatBledu(e), variant: "destructive" }),
  });

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">Magazyny, z których eksportujemy</h2>
        <p className="text-xs text-muted-foreground">Bez wybranego magazynu plik partnera będzie pusty.</p>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm" data-testid="lista-magazynow">
          {nazwy.map((m) => (
            <label key={m} className="flex items-center gap-2">
              <input type="checkbox" checked={wybrane.includes(m)} onChange={() => przelacz(m)} data-testid={`checkbox-magazyn-${m}`} />
              {m}
              {!data ? null : liczby.has(m) ? <span className="text-xs text-muted-foreground">({liczby.get(m)})</span> : <span className="text-xs text-destructive">(brak w katalogu)</span>}
            </label>
          ))}
        </div>
        <Button size="sm" onClick={() => zapis.mutate()} disabled={zapis.isPending} data-testid="button-magazyny-zapisz">Zapisz magazyny</Button>
      </CardContent>
    </Card>
  );
}

export function WykluczeniaPartnera({ partner }: { partner: SzczegolyPartnera }) {
  const klient = useQueryClient();
  const { toast } = useToast();
  const [tekst, ustawTekst] = useState(partner.wykluczenia.join("\n"));

  const zapis = useMutation<void, Error, void>({
    mutationFn: () => zapiszWykluczenia(partner.id, [...new Set(tekst.split(/[\n,;]+/).map((k) => k.trim()).filter(Boolean))]),
    onSuccess: async () => {
      toast({ title: "Zapisano wykluczenia" });
      await klient.invalidateQueries({ queryKey: [KLUCZ_PARTNERZY] });
    },
    onError: (e) => toast({ title: "Nie udało się zapisać wykluczeń", description: komunikatBledu(e), variant: "destructive" }),
  });

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">Wykluczone produkty</h2>
        <p className="text-xs text-muted-foreground">Numery katalogowe (kod pozycji), jeden w wierszu. Te pozycje nie trafią do pliku partnera.</p>
        <textarea
          className="min-h-24 w-full rounded-md border border-input bg-background p-2 font-mono text-sm"
          value={tekst}
          onChange={(e) => ustawTekst(e.target.value)}
          aria-label="Wykluczone produkty"
          data-testid="textarea-wykluczenia"
        />
        <Button size="sm" onClick={() => zapis.mutate()} disabled={zapis.isPending} data-testid="button-wykluczenia-zapisz">Zapisz wykluczenia</Button>
      </CardContent>
    </Card>
  );
}
