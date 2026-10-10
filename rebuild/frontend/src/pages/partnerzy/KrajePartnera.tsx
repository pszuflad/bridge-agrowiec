/** Sekcja „Kraje” w konfiguracji partnera (ticket 222, PRT-5.2): narzut, kurs EUR, koszty dodatkowe per kraj. */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";

import { DialogPotwierdzenia } from "@/components/DialogPotwierdzenia";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { KLUCZ_PARTNERZY, komunikatBledu, liczbaZPola, usunKraj, zapiszKraj, type KrajPartnera, type SzczegolyPartnera } from "./api";

const KLASA_SELECT = "h-9 rounded-md border border-input bg-background px-2 text-sm";

function WierszKraju({ partnerId, kraj, nowy }: { partnerId: number; kraj: KrajPartnera | null; nowy: boolean }) {
  const klient = useQueryClient();
  const { toast } = useToast();
  const [kod, ustawKod] = useState(kraj?.kraj ?? "");
  const [narzut, ustawNarzut] = useState(String(kraj?.narzutProc ?? 0));
  const [zrodlo, ustawZrodlo] = useState<"nbp" | "reczny">(kraj?.kursZrodlo ?? "nbp");
  const [kurs, ustawKurs] = useState(kraj?.kursReczny === null || kraj?.kursReczny === undefined ? "" : String(kraj.kursReczny));
  const [koszty, ustawKoszty] = useState(String(kraj?.kosztyDodatkowe ?? 0));
  const [doUsuniecia, ustawDoUsuniecia] = useState(false);
  const testId = nowy ? "nowy" : (kraj?.kraj ?? "");

  const zapis = useMutation<void, Error, void>({
    mutationFn: async () => {
      const kodKraju = kod.trim().toUpperCase();
      const n = liczbaZPola(narzut) ?? 0;
      const k = liczbaZPola(kurs);
      const c = liczbaZPola(koszty) ?? 0;
      if (!/^[A-Z]{2}$/.test(kodKraju)) throw new Error("Kraj to dwuliterowy kod, np. FR.");
      if (Number.isNaN(n) || n < 0) throw new Error("Narzut musi być liczbą ≥ 0 (w procentach).");
      if (Number.isNaN(c) || c < 0) throw new Error("Koszty dodatkowe muszą być liczbą ≥ 0 (PLN).");
      if (zrodlo === "reczny" && (k === null || Number.isNaN(k) || k <= 0)) throw new Error("Kurs ręczny wymaga wartości większej od zera.");
      await zapiszKraj(partnerId, kodKraju, { narzutProc: n, kursZrodlo: zrodlo, kursReczny: zrodlo === "reczny" ? k : null, kosztyDodatkowe: c });
    },
    onSuccess: async () => {
      toast({ title: nowy ? "Dodano kraj" : "Zapisano kraj", description: kod.trim().toUpperCase() });
      if (nowy) {
        ustawKod("");
        ustawNarzut("0");
        ustawKurs("");
        ustawKoszty("0");
        ustawZrodlo("nbp");
      }
      await klient.invalidateQueries({ queryKey: [KLUCZ_PARTNERZY] });
    },
    onError: (e) => toast({ title: "Nie udało się zapisać kraju", description: komunikatBledu(e), variant: "destructive" }),
  });
  const kasowanie = useMutation<void, Error, void>({
    mutationFn: () => usunKraj(partnerId, kraj!.kraj),
    onSuccess: async () => {
      ustawDoUsuniecia(false);
      toast({ title: "Usunięto kraj", description: kraj!.kraj });
      await klient.invalidateQueries({ queryKey: [KLUCZ_PARTNERZY] });
    },
    onError: (e) => toast({ title: "Nie udało się usunąć kraju", description: komunikatBledu(e), variant: "destructive" }),
  });

  return (
    <tr className="border-b last:border-0" data-testid={`row-kraj-${testId}`}>
      <td className="px-2 py-2">
        {nowy ? <Input className="w-20 uppercase" maxLength={2} placeholder="FR" aria-label="Kod nowego kraju" value={kod} onChange={(e) => ustawKod(e.target.value)} data-testid="input-kraj-nowy-kod" /> : <span className="font-medium">{kraj!.kraj}</span>}
      </td>
      <td className="px-2 py-2"><Input className="w-24" inputMode="decimal" aria-label={`Narzut % ${testId}`} value={narzut} onChange={(e) => ustawNarzut(e.target.value)} data-testid={`input-kraj-narzut-${testId}`} /></td>
      <td className="px-2 py-2">
        <select className={KLASA_SELECT} aria-label={`Źródło kursu ${testId}`} value={zrodlo} onChange={(e) => ustawZrodlo(e.target.value as "nbp" | "reczny")} data-testid={`select-kraj-zrodlo-${testId}`}>
          <option value="nbp">NBP (tabela A)</option>
          <option value="reczny">ręczny</option>
        </select>
      </td>
      <td className="px-2 py-2"><Input className="w-24" inputMode="decimal" disabled={zrodlo !== "reczny"} aria-label={`Kurs ręczny ${testId}`} value={kurs} onChange={(e) => ustawKurs(e.target.value)} data-testid={`input-kraj-kurs-${testId}`} /></td>
      <td className="px-2 py-2"><Input className="w-28" inputMode="decimal" aria-label={`Koszty dodatkowe PLN ${testId}`} value={koszty} onChange={(e) => ustawKoszty(e.target.value)} data-testid={`input-kraj-koszty-${testId}`} /></td>
      <td className="whitespace-nowrap px-2 py-2 text-right">
        <Button size="sm" variant="outline" disabled={zapis.isPending} onClick={() => zapis.mutate()} data-testid={`button-kraj-zapisz-${testId}`}>{nowy ? "Dodaj kraj" : "Zapisz"}</Button>
        {!nowy ? (
          <>
            <Button size="icon" variant="ghost" aria-label={`Usuń kraj ${kraj!.kraj}`} onClick={() => ustawDoUsuniecia(true)} data-testid={`button-kraj-usun-${testId}`}><Trash2 className="h-4 w-4" aria-hidden /></Button>
            <DialogPotwierdzenia
              otwarty={doUsuniecia}
              tytul="Usunąć kraj?"
              tresc={`Partner przestanie dostawać ceny dla kraju ${kraj!.kraj}. Ustawienia tego kraju (narzut, kurs, koszty) zostaną skasowane.`}
              etykietaPotwierdzenia="Usuń"
              wariantPotwierdzenia="destructive"
              zajety={kasowanie.isPending}
              onPotwierdz={() => kasowanie.mutate()}
              onZamknij={() => ustawDoUsuniecia(false)}
            />
          </>
        ) : null}
      </td>
    </tr>
  );
}

export function KrajePartnera({ partner }: { partner: SzczegolyPartnera }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">Kraje, narzuty i kursy</h2>
        <p className="text-xs text-muted-foreground">
          Narzut w procentach od ceny zakupu (zakup × (1 + narzut)), nie marża. Koszty dodatkowe w PLN, doliczane do każdej opony. Kurs EUR z NBP albo ręczny.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-2 py-2 font-medium">Kraj</th>
                <th className="px-2 py-2 font-medium">Narzut %</th>
                <th className="px-2 py-2 font-medium">Kurs EUR</th>
                <th className="px-2 py-2 font-medium">Kurs ręczny</th>
                <th className="px-2 py-2 font-medium">Koszty dod. PLN</th>
                <th className="px-2 py-2" aria-label="Akcje" />
              </tr>
            </thead>
            <tbody>
              {partner.kraje.map((k) => <WierszKraju key={`${k.kraj}-${k.narzutProc}-${k.kursZrodlo}-${k.kursReczny}-${k.kosztyDodatkowe}`} partnerId={partner.id} kraj={k} nowy={false} />)}
              <WierszKraju key={`nowy-${partner.kraje.length}`} partnerId={partner.id} kraj={null} nowy />
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
