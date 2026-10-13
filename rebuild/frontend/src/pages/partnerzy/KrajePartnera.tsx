/** Sekcja „Kraje” w konfiguracji partnera (ticket 222, PRT-5.2): narzut, kurs EUR, koszty dodatkowe per kraj. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";

import { DialogPotwierdzenia } from "@/components/DialogPotwierdzenia";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { nazwaKraju } from "@/lib/kraje";
import { KLUCZ_PARTNERZY, kluczKursuNbp, komunikatBledu, liczbaZPola, usunKraj, zapiszKraj, type KrajPartnera, type KursNbpPodglad, type SzczegolyPartnera } from "./api";

const KLASA_SELECT = "h-9 rounded-md border border-input bg-background px-2 text-sm";

/** Kurs, którego system używa dla kraju: ręczny z formularza albo ostatnio użyty (NBP) w wygenerowanym pliku. */
function opisKursu(kraj: KrajPartnera | null, zrodlo: "nbp" | "reczny", kursReczny: string, nbp: KursNbpPodglad | null | undefined): string {
  if (zrodlo === "reczny") return kursReczny.trim() === "" ? "ręczny — brak wartości" : `${kursReczny} (ręczny)`;
  // Kurs NBP „na teraz” (ticket 250): ten, który dostanie najbliższy generowany plik; „ostatnio w pliku” to kurs faktycznie użyty wcześniej.
  const teraz = nbp ? `NBP teraz: ${nbp.kurs} (tabela z ${nbp.dataTabeli ?? "?"}${nbp.zrodlo === "nbp-zapisany" ? ", zapisany — NBP nie odpowiada" : ""})` : null;
  if (!kraj?.ostatniKurs) return teraz ? `${teraz} · jeszcze nie użyto w pliku` : "NBP — jeszcze nie użyto";
  const ostatnio = `${kraj.ostatniKurs.kurs} (${kraj.ostatniKurs.zrodlo}, ${kraj.ostatniKurs.zapisano.slice(0, 16).replace("T", " ")})`;
  return teraz ? `${teraz} · ostatnio w pliku: ${ostatnio}` : ostatnio;
}

function WierszKraju({ partnerId, kraj, nowy, kursNbp }: { partnerId: number; kraj: KrajPartnera | null; nowy: boolean; kursNbp: KursNbpPodglad | null | undefined }) {
  const klient = useQueryClient();
  const { toast } = useToast();
  const [kod, ustawKod] = useState(kraj?.kraj ?? "");
  const [narzut, ustawNarzut] = useState(String(kraj?.narzutProc ?? 0));
  const [zrodlo, ustawZrodlo] = useState<"nbp" | "reczny">(kraj?.kursZrodlo ?? "nbp");
  const [kurs, ustawKurs] = useState(kraj?.kursReczny === null || kraj?.kursReczny === undefined ? "" : String(kraj.kursReczny));
  const [koszty, ustawKoszty] = useState(String(kraj?.kosztyDodatkowe ?? 0));
  const [przesylka, ustawPrzesylke] = useState(kraj?.przesylkaStalaEur == null ? "" : String(kraj.przesylkaStalaEur));
  const [paliwo, ustawPaliwo] = useState(kraj?.paliwoProc === undefined ? "" : String(kraj.paliwoProc));
  const [myto, ustawMyto] = useState(String(kraj?.mytoEur ?? 0));
  const [pakowanie, ustawPakowanie] = useState(String(kraj?.pakowanieEur ?? 0));
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
      const p = liczbaZPola(przesylka);
      const pal = liczbaZPola(paliwo);
      const my = liczbaZPola(myto) ?? 0;
      const pak = liczbaZPola(pakowanie) ?? 0;
      if (pal !== null && (Number.isNaN(pal) || pal < 0 || pal > 1000)) throw new Error("Opłata paliwowa to liczba od 0 do 1000 (%).");
      if (Number.isNaN(my) || my < 0) throw new Error("Myto musi być liczbą ≥ 0 (EUR).");
      if (Number.isNaN(pak) || pak < 0) throw new Error("Pakowanie musi być liczbą ≥ 0 (EUR).");
      if (Number.isNaN(c) || c < 0) throw new Error("Koszty dodatkowe muszą być liczbą ≥ 0 (EUR).");
      if (p !== null && (Number.isNaN(p) || p < 0)) throw new Error("Koszt przesyłki musi być liczbą ≥ 0 (EUR) albo pusty (wtedy tabele GEIS).");
      if (zrodlo === "reczny" && (k === null || Number.isNaN(k) || k <= 0)) throw new Error("Kurs ręczny wymaga wartości większej od zera.");
      await zapiszKraj(partnerId, kodKraju, { narzutProc: n, kursZrodlo: zrodlo, kursReczny: zrodlo === "reczny" ? k : null, kosztyDodatkowe: c, przesylkaStalaEur: p, mytoEur: my, pakowanieEur: pak, paliwoProc: pal });
    },
    onSuccess: async () => {
      toast({ title: nowy ? "Dodano kraj" : "Zapisano kraj", description: kod.trim().toUpperCase() });
      if (nowy) {
        ustawKod("");
        ustawNarzut("0");
        ustawKurs("");
        ustawKoszty("0");
        ustawPrzesylke("");
        ustawPaliwo("");
        ustawMyto("0");
        ustawPakowanie("0");
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
        {nowy ? (
          <div>
            <Input className="w-20 uppercase" maxLength={2} placeholder="FR" aria-label="Kod nowego kraju" value={kod} onChange={(e) => ustawKod(e.target.value)} data-testid="input-kraj-nowy-kod" />
            <span className="block text-xs text-muted-foreground" data-testid="nazwa-kraju-nowy">{nazwaKraju(kod) ?? ""}</span>
          </div>
        ) : <span className="font-medium">{kraj!.kraj}<span className="block text-xs font-normal text-muted-foreground" data-testid={`nazwa-kraju-${kraj!.kraj}`}>{nazwaKraju(kraj!.kraj) ?? ""}</span></span>}
      </td>
      <td className="px-2 py-2"><Input className="w-24" inputMode="decimal" aria-label={`Narzut % ${testId}`} value={narzut} onChange={(e) => ustawNarzut(e.target.value)} data-testid={`input-kraj-narzut-${testId}`} /></td>
      <td className="px-2 py-2">
        <select className={KLASA_SELECT} aria-label={`Źródło kursu ${testId}`} value={zrodlo} onChange={(e) => ustawZrodlo(e.target.value as "nbp" | "reczny")} data-testid={`select-kraj-zrodlo-${testId}`}>
          <option value="nbp">NBP (tabela A)</option>
          <option value="reczny">ręczny</option>
        </select>
      </td>
      <td className="px-2 py-2"><Input className="w-24" inputMode="decimal" disabled={zrodlo !== "reczny"} aria-label={`Kurs ręczny ${testId}`} value={kurs} onChange={(e) => ustawKurs(e.target.value)} data-testid={`input-kraj-kurs-${testId}`} /></td>
      <td className="px-2 py-2"><Input className="w-28" inputMode="decimal" aria-label={`Koszty dodatkowe EUR ${testId}`} value={koszty} onChange={(e) => ustawKoszty(e.target.value)} data-testid={`input-kraj-koszty-${testId}`} /></td>
      <td className="px-2 py-2"><Input className="w-28" inputMode="decimal" placeholder="GEIS" aria-label={`Przesyłka stała EUR ${testId}`} value={przesylka} onChange={(e) => ustawPrzesylke(e.target.value)} data-testid={`input-kraj-przesylka-${testId}`} /></td>
      <td className="px-2 py-2"><Input className="w-20" inputMode="decimal" aria-label={`Paliwo % ${testId}`} value={paliwo} onChange={(e) => ustawPaliwo(e.target.value)} data-testid={`input-kraj-paliwo-${testId}`} /></td>
      <td className="px-2 py-2"><Input className="w-24" inputMode="decimal" aria-label={`Myto EUR ${testId}`} value={myto} onChange={(e) => ustawMyto(e.target.value)} data-testid={`input-kraj-myto-${testId}`} /></td>
      <td className="px-2 py-2"><Input className="w-24" inputMode="decimal" aria-label={`Pakowanie EUR ${testId}`} value={pakowanie} onChange={(e) => ustawPakowanie(e.target.value)} data-testid={`input-kraj-pakowanie-${testId}`} /></td>
      <td className="px-2 py-2 text-xs text-muted-foreground" data-testid={`kurs-uzywany-${testId}`}>{opisKursu(kraj, zrodlo, kurs, kursNbp)}</td>
      <td className="whitespace-nowrap px-2 py-2 text-right">
        <Button size="sm" variant={nowy ? "default" : "outline"} disabled={zapis.isPending} onClick={() => zapis.mutate()} data-testid={`button-kraj-zapisz-${testId}`}>{nowy ? "Dodaj kraj" : "Zapisz"}</Button>
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
  const nbp = useQuery<KursNbpPodglad | null>({ queryKey: kluczKursuNbp, retry: false, staleTime: 5 * 60_000 });
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">Kraje, narzuty i kursy</h2>
        <p className="text-xs text-muted-foreground">
          Narzut w procentach od ceny zakupu (zakup × (1 + narzut)), nie marża. Koszty dodatkowe w EUR, doliczane do każdej opony. Przesyłka = baza kraju (EUR) × (1 + paliwo %) + myto + pakowanie; puste = stawki z tabel GEIS. Zmiana paliwa obowiązuje od dziś i nie przelicza wstecz. Narzut 0 % = ceny dla kraju nie są publikowane. Kurs EUR z NBP albo ręczny.
        </p>
        <div className="flex flex-wrap items-center gap-3 rounded-md bg-muted/40 px-3 py-2 text-sm" data-testid="kurs-nbp-teraz">
          {nbp.isPending ? (
            <span className="text-muted-foreground">Pobieranie aktualnego kursu NBP…</span>
          ) : nbp.isError ? (
            <span className="text-destructive" role="alert" data-testid="kurs-nbp-blad">Nie udało się pobrać kursu NBP: {komunikatBledu(nbp.error)}</span>
          ) : (
            <>
              <span>Aktualny kurs NBP (tabela A): <strong data-testid="kurs-nbp-wartosc">1 EUR = {nbp.data?.kurs} PLN</strong>, tabela z {nbp.data?.dataTabeli ?? "?"}</span>
              {nbp.data?.ostrzezenie ? <span className="text-xs text-destructive" data-testid="kurs-nbp-ostrzezenie">{nbp.data.ostrzezenie}</span> : null}
            </>
          )}
          <Button size="sm" variant="outline" disabled={nbp.isFetching} onClick={() => void nbp.refetch()} data-testid="button-kurs-nbp-odswiez">{nbp.isFetching ? "Pobieranie…" : "Odśwież kurs"}</Button>
          <span className="text-xs text-muted-foreground" data-testid="kurs-nbp-wyjasnienie">To kurs, którego użyje najbliższy wygenerowany cennik (wiersze z „NBP”). NBP publikuje tabelę A w dni robocze ok. 11:45–12:15 — przed publikacją obowiązuje kurs z poprzedniego dnia roboczego. Ręczny kurs ustawiasz w wierszu kraju.</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-2 py-2 font-medium">Kraj</th>
                <th className="px-2 py-2 font-medium">Narzut %</th>
                <th className="px-2 py-2 font-medium">Kurs EUR</th>
                <th className="px-2 py-2 font-medium">Kurs ręczny</th>
                <th className="px-2 py-2 font-medium">Koszty dod. EUR</th>
                <th className="px-2 py-2 font-medium">Przesyłka bazowa EUR</th>
                <th className="px-2 py-2 font-medium">Paliwo %</th>
                <th className="px-2 py-2 font-medium">Myto EUR</th>
                <th className="px-2 py-2 font-medium">Pakowanie EUR</th>
                <th className="px-2 py-2 font-medium">Używany kurs</th>
                <th className="px-2 py-2" aria-label="Akcje" />
              </tr>
            </thead>
            <tbody>
              {partner.kraje.map((k) => <WierszKraju key={`${k.kraj}-${k.narzutProc}-${k.kursZrodlo}-${k.kursReczny}-${k.kosztyDodatkowe}-${k.przesylkaStalaEur}`} partnerId={partner.id} kraj={k} nowy={false} kursNbp={nbp.data} />)}
              <WierszKraju key={`nowy-${partner.kraje.length}`} partnerId={partner.id} kraj={null} nowy kursNbp={nbp.data} />
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
