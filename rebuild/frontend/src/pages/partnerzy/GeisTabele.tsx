/**
 * Tabele transportowe GEIS (ticket 244): podgląd i edycja parametrów per kraj + import z arkusza Excel.
 * Koszt przesyłki partnera = stawka z tabeli kraju (pierwszy próg ≥ wagi rozliczeniowej = max(waga, gabaryt)) × (1 + paliwo %) + pakowanie + myto
 * (paliwo, myto i pakowanie kraju partnera edytujesz w tabeli krajów). Stawki w EUR. API: `/api/partnerzy/geis`.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { BAZA_API, naglowki, zadanie } from "@/lib/api";
import { KLUCZ_PARTNERZY, komunikatBledu, liczbaZPola, type ListaPartnerow, type SzczegolyPartnera } from "./api";

type TabelaGeis = { kraj: string; wspGabarytowy: number; kosztPakowania: number; maks: [number, number, number] | null; stawki: [number, number][] };
type ListaGeis = { kraje: TabelaGeis[] };
const KLUCZ = [KLUCZ_PARTNERZY, "geis"];

/** „próg;stawka” w wierszach (przecinek dziesiętny dozwolony) → pary liczb albo błąd. */
export function parsujStawki(tekst: string): [number, number][] {
  const wynik: [number, number][] = [];
  for (const [i, linia] of tekst.split("\n").entries()) {
    if (linia.trim() === "") continue;
    const [p, s, ...reszta] = linia.split(/[;\t]/);
    const prog = liczbaZPola(p ?? "");
    const stawka = liczbaZPola(s ?? "");
    if (reszta.length > 0 || prog === null || stawka === null || Number.isNaN(prog) || Number.isNaN(stawka) || prog <= 0 || stawka <= 0)
      throw new Error(`Wiersz ${i + 1}: oczekiwane „próg;stawka” (liczby > 0).`);
    wynik.push([prog, stawka]);
  }
  if (wynik.length === 0) throw new Error("Tabela musi mieć co najmniej jeden próg wagowy.");
  return wynik.sort((a, b) => a[0] - b[0]);
}

function Kraj({ t }: { t: TabelaGeis }) {
  const klient = useQueryClient();
  const { toast } = useToast();
  const [otwarty, ustawOtwarty] = useState(false);
  const [wsp, ustawWsp] = useState(String(t.wspGabarytowy));
  const [pak, ustawPak] = useState(String(t.kosztPakowania));
  const [maks, ustawMaks] = useState<[string, string, string]>(t.maks ? [String(t.maks[0]), String(t.maks[1]), String(t.maks[2])] : ["", "", ""]);
  const [stawki, ustawStawki] = useState(t.stawki.map(([p, s]) => `${p};${s}`).join("\n"));

  const zapis = useMutation<void, Error, void>({
    mutationFn: async () => {
      const w = liczbaZPola(wsp);
      const p = liczbaZPola(pak) ?? 0;
      if (w === null || Number.isNaN(w) || w <= 0) throw new Error("Współczynnik wagi gabarytowej musi być liczbą > 0.");
      if (Number.isNaN(p) || p < 0) throw new Error("Koszt pakowania musi być liczbą ≥ 0.");
      const m = maks.map((x) => liczbaZPola(x));
      const bezLimitu = m.every((x) => x === null);
      if (!bezLimitu && m.some((x) => x === null || Number.isNaN(x) || (x as number) <= 0)) throw new Error("Maks. wymiary: wypełnij wszystkie trzy (> 0) albo zostaw puste (brak limitu).");
      await zadanie("PUT", `${KLUCZ_PARTNERZY}/geis/${t.kraj}`, { wspGabarytowy: w, kosztPakowania: p, maks: bezLimitu ? null : m, stawki: parsujStawki(stawki) });
    },
    onSuccess: async () => {
      toast({ title: "Zapisano tabelę GEIS", description: t.kraj });
      await klient.invalidateQueries({ queryKey: KLUCZ });
    },
    onError: (e) => toast({ title: "Nie udało się zapisać tabeli GEIS", description: komunikatBledu(e), variant: "destructive" }),
  });

  const opis = `współczynnik ${t.wspGabarytowy}, pakowanie ${t.kosztPakowania} EUR, ${t.maks ? `maks. ${t.maks.join("×")} cm` : "bez limitu wymiarów"}, ${t.stawki.length} progów`;
  return (
    <div className="border-b py-2 last:border-0" data-testid={`geis-${t.kraj}`}>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="w-8 font-medium">{t.kraj}</span>
        <span className="text-xs text-muted-foreground">{opis}</span>
        <Button size="sm" variant="outline" onClick={() => ustawOtwarty((o) => !o)} data-testid={`button-geis-edytuj-${t.kraj}`}>{otwarty ? "Zwiń" : "Podgląd i edycja"}</Button>
      </div>
      {otwarty ? (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap items-end gap-3 text-xs">
            <label className="space-y-1">Współczynnik gabarytowy (kg/m³)<Input className="w-28" inputMode="decimal" value={wsp} onChange={(e) => ustawWsp(e.target.value)} data-testid={`input-geis-wsp-${t.kraj}`} /></label>
            <label className="space-y-1">Pakowanie EUR<Input className="w-24" inputMode="decimal" value={pak} onChange={(e) => ustawPak(e.target.value)} data-testid={`input-geis-pakowanie-${t.kraj}`} /></label>
            {(["Maks. długość cm", "Maks. szerokość cm", "Maks. wysokość cm"] as const).map((etykieta, i) => (
              <label key={etykieta} className="space-y-1">{etykieta}<Input className="w-24" inputMode="decimal" value={maks[i]} onChange={(e) => ustawMaks((a) => a.map((x, j) => (j === i ? e.target.value : x)) as [string, string, string])} data-testid={`input-geis-maks-${i}-${t.kraj}`} /></label>
            ))}
          </div>
          <label className="block space-y-1 text-xs">Stawki w EUR: jeden wiersz = „próg kg;stawka” (np. 100;61)
            <textarea className="min-h-40 w-full max-w-sm rounded-md border border-input bg-background p-2 font-mono text-sm" value={stawki} onChange={(e) => ustawStawki(e.target.value)} data-testid={`textarea-geis-stawki-${t.kraj}`} />
          </label>
          <Button size="sm" disabled={zapis.isPending} onClick={() => zapis.mutate()} data-testid={`button-geis-zapisz-${t.kraj}`}>Zapisz tabelę {t.kraj}</Button>
        </div>
      ) : null}
    </div>
  );
}

type PodgladPrzesylki = {
  zrodlo: "geis";
  wagaRozliczeniowa: number;
  wagaRzeczywista: number;
  wagaGabarytowa: number;
  progKg: number;
  baza: number;
  paliwoProc: number;
  paliwoEur: number;
  pakowanieGeisEur: number;
  mytoEur: number;
  pakowanieKrajuEur: number;
  razemEur: number;
};
const eur = (n: number): string => `${n.toFixed(2)} EUR`;

/** Podgląd kosztu przesyłki dla wybranej paczki i kraju partnera (ticket 246) — to samo liczenie co w cenniku, z rozbiciem na składniki. */
function PodgladKosztu() {
  const lista = useQuery<ListaPartnerow | null>({ queryKey: [KLUCZ_PARTNERZY] });
  const [partnerId, ustawPartnera] = useState("");
  const szczegoly = useQuery<SzczegolyPartnera | null>({ queryKey: [KLUCZ_PARTNERZY, partnerId], enabled: partnerId !== "" });
  const [kraj, ustawKraj] = useState("");
  const [pola, ustawPola] = useState({ waga: "", dlugosc: "", szerokosc: "", wysokosc: "" });
  const [wynik, ustawWynik] = useState<PodgladPrzesylki | null>(null);
  const [blad, ustawBlad] = useState<string | null>(null);
  const liczenie = useMutation<PodgladPrzesylki, Error, void>({
    mutationFn: async () => {
      const n = (t: string): number | null => {
        const v = liczbaZPola(t);
        return v === null || Number.isNaN(v) || v <= 0 ? null : v;
      };
      if (partnerId === "" || kraj === "") throw new Error("Wybierz partnera i kraj.");
      const odp = await zadanie("POST", `${KLUCZ_PARTNERZY}/geis/podglad-kosztu`, {
        partnerId: Number(partnerId), kraj, waga: n(pola.waga), dlugosc: n(pola.dlugosc), szerokosc: n(pola.szerokosc), wysokosc: n(pola.wysokosc),
      });
      return (await odp.json()) as PodgladPrzesylki;
    },
    onSuccess: (w) => {
      ustawBlad(null);
      ustawWynik(w);
    },
    onError: (e) => {
      ustawWynik(null);
      ustawBlad(komunikatBledu(e));
    },
  });
  const ustaw = (k: keyof typeof pola, v: string) => ustawPola((p) => ({ ...p, [k]: v }));
  const kraje = szczegoly.data?.kraje ?? [];
  return (
    <div className="space-y-2 border-t pt-3" data-testid="podglad-przesylki">
      <h3 className="text-sm font-medium">Podgląd kosztu przesyłki</h3>
      <div className="flex flex-wrap items-end gap-3 text-xs">
        <label className="space-y-1">Partner
          <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={partnerId} onChange={(e) => { ustawPartnera(e.target.value); ustawKraj(""); ustawWynik(null); }} data-testid="select-przesylka-partner">
            <option value="">— wybierz —</option>
            {(lista.data?.partnerzy ?? []).map((p) => <option key={p.id} value={p.id}>{p.nazwa}</option>)}
          </select>
        </label>
        <label className="space-y-1">Kraj
          <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={kraj} onChange={(e) => ustawKraj(e.target.value)} disabled={partnerId === ""} data-testid="select-przesylka-kraj">
            <option value="">— wybierz —</option>
            {kraje.map((k) => <option key={k.kraj} value={k.kraj}>{k.kraj}</option>)}
          </select>
        </label>
        {([["waga", "Waga kg"], ["dlugosc", "Długość cm"], ["szerokosc", "Szerokość cm"], ["wysokosc", "Wysokość cm"]] as const).map(([k, etykieta]) => (
          <label key={k} className="space-y-1">{etykieta}<Input className="w-24" inputMode="decimal" value={pola[k]} onChange={(e) => ustaw(k, e.target.value)} data-testid={`input-przesylka-${k}`} /></label>
        ))}
        <Button size="sm" variant="outline" disabled={liczenie.isPending} onClick={() => liczenie.mutate()} data-testid="button-przesylka-policz">Policz</Button>
      </div>
      {blad ? <p className="text-sm text-destructive" role="alert" data-testid="text-przesylka-blad">{blad}</p> : null}
      {wynik ? (
        <ul className="space-y-0.5 text-sm" data-testid="wynik-przesylki">
          <li>Waga rozliczeniowa {wynik.wagaRozliczeniowa.toFixed(1)} kg (rzeczywista {wynik.wagaRzeczywista.toFixed(1)}, gabarytowa {wynik.wagaGabarytowa.toFixed(1)}) → próg {wynik.progKg} kg: stawka {eur(wynik.baza)}</li>
          <li>Paliwo {wynik.paliwoProc}%: {eur(wynik.paliwoEur)}</li>
          {wynik.pakowanieGeisEur > 0 ? <li>Pakowanie z tabeli GEIS: {eur(wynik.pakowanieGeisEur)}</li> : null}
          <li>Myto: {eur(wynik.mytoEur)}</li>
          <li>Pakowanie kraju: {eur(wynik.pakowanieKrajuEur)}</li>
          <li className="font-medium" data-testid="text-przesylka-razem">Razem: {eur(wynik.razemEur)}</li>
        </ul>
      ) : null}
    </div>
  );
}

export function GeisTabele() {
  const klient = useQueryClient();
  const { toast } = useToast();
  const wejscie = useRef<HTMLInputElement>(null);
  const q = useQuery<ListaGeis | null>({ queryKey: KLUCZ, refetchOnMount: "always" });
  const import_ = useMutation<{ zaimportowano: number; kraje: string[]; ostrzezenia: string[] }, Error, File>({
    mutationFn: async (plik) => {
      const dane = new FormData();
      dane.append("plik", plik);
      const odp = await fetch(`${BAZA_API}${KLUCZ_PARTNERZY}/geis/import`, { method: "POST", body: dane, headers: naglowki(false), credentials: "include" });
      const cialo = (await odp.json().catch(() => ({}))) as { error?: string; zaimportowano: number; kraje: string[]; ostrzezenia: string[] };
      if (!odp.ok) throw new Error(cialo.error || "Import nie powiódł się.");
      return cialo;
    },
    onSuccess: async (w) => {
      toast({ title: `Zaimportowano tabele GEIS: ${w.zaimportowano}`, description: w.kraje.join(", ") + (w.ostrzezenia.length ? ` — ${w.ostrzezenia.join(" ")}` : "") });
      await klient.invalidateQueries({ queryKey: KLUCZ });
    },
    onError: (e) => toast({ title: "Nie udało się zaimportować", description: komunikatBledu(e), variant: "destructive" }),
  });
  const kraje = q.data?.kraje ?? [];
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold">Tabele transportowe GEIS</h2>
          <input ref={wejscie} type="file" accept=".xlsx" className="hidden" data-testid="input-geis-plik" onChange={(e) => { const f = e.target.files?.[0]; if (f) import_.mutate(f); e.target.value = ""; }} />
          <Button size="sm" variant="outline" disabled={import_.isPending} onClick={() => wejscie.current?.click()} data-testid="button-geis-import">{import_.isPending ? "Importowanie…" : "Importuj z Excela"}</Button>
        </div>
        <p className="text-xs text-muted-foreground">Stawka przesyłki (EUR) zależy od wagi rozliczeniowej opony i kraju; do niej doliczane jest paliwo %, myto i pakowanie z tabeli krajów partnera. Import nadpisuje tabele krajów obecnych w pliku.</p>
        {q.isError ? <p className="text-sm text-destructive" role="alert">{komunikatBledu(q.error)}</p> : null}
        {q.isSuccess && kraje.length === 0 ? <p className="text-sm text-muted-foreground" data-testid="text-geis-pusto">Brak tabel GEIS — zaimportuj plik Excel.</p> : null}
        {kraje.map((t) => <Kraj key={`${t.kraj}-${JSON.stringify(t)}`} t={t} />)}
        <PodgladKosztu />
      </CardContent>
    </Card>
  );
}
