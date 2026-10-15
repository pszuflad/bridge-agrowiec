/** Symulacja ceny (ticket 273): prawdziwe produkty partnera dla wybranego kraju z rozbiciem składników ceny — zakup, narzut, przesyłka GEIS, kurs, cena końcowa. Tylko odczyt. */
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { komunikatBledu, symulujCene, type SzczegolyPartnera, type WierszSymulacji, type WynikSymulacji } from "./api";

const eur = (v: number): string => v.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const proc = (v: number): string => `${v.toLocaleString("pl-PL", { maximumFractionDigits: 2 })} %`;

function Przesylka({ w }: { w: WierszSymulacji }) {
  const p = w.przesylka;
  if (!p) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="space-y-0.5">
      <div className="font-medium">{eur(p.razemEur)} EUR</div>
      <div className="text-muted-foreground">
        {p.wymiaryZPaleta ? `wymiary z paletą ${p.wymiaryZPaleta}, ` : ""}waga rozl. {p.wagaRozliczeniowa.toLocaleString("pl-PL", { maximumFractionDigits: 1 })} kg → próg {p.progKg} kg, stawka {eur(p.stawkaEur)}; paliwo {proc(p.paliwoProc)} ({eur(p.paliwoEur)}); pakowanie GEIS {eur(p.pakowanieGeisEur)}; myto {eur(p.mytoEur)}; pakowanie kraju {eur(p.pakowanieKrajuEur)}
      </div>
    </div>
  );
}

export function SymulacjaCeny({ partner }: { partner: SzczegolyPartnera }) {
  const [kraj, ustawKraj] = useState(partner.kraje[0]?.kraj ?? "");
  const [kody, ustawKody] = useState("");
  const [limit, ustawLimit] = useState("10");
  const symulacja = useMutation<WynikSymulacji, Error, void>({
    mutationFn: () =>
      symulujCene(partner.id, {
        kraj,
        kody: kody.split(/[\s,;]+/).map((k) => k.trim()).filter(Boolean),
        limit: Number(limit) || undefined,
      }),
  });
  const wynik = symulacja.data;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">Symulacja ceny (prawdziwe produkty)</h2>
        <p className="text-xs text-muted-foreground">Wybierz kraj i (opcjonalnie) wpisz kody produktów albo numery katalogowe. Bez kodów pokazuję próbkę równomiernie rozłożoną po całej ofercie. To ta sama wycena co w pliku dla partnera; nic nie jest zapisywane ani wysyłane.</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs">
            <span className="block text-muted-foreground">Kraj</span>
            <select className="h-9 rounded-md border bg-background px-2 text-sm" value={kraj} onChange={(e) => ustawKraj(e.target.value)} data-testid="select-symulacja-kraj">
              {partner.kraje.map((k) => <option key={k.kraj} value={k.kraj}>{k.kraj}</option>)}
            </select>
          </label>
          <label className="text-xs">
            <span className="block text-muted-foreground">Kody / numery katalogowe (po przecinku)</span>
            <input className="h-9 w-72 rounded-md border bg-background px-2 text-sm" value={kody} onChange={(e) => ustawKody(e.target.value)} data-testid="input-symulacja-kody" />
          </label>
          <label className="text-xs">
            <span className="block text-muted-foreground">Ile pozycji (bez kodów)</span>
            <input className="h-9 w-20 rounded-md border bg-background px-2 text-sm" inputMode="numeric" value={limit} onChange={(e) => ustawLimit(e.target.value)} data-testid="input-symulacja-limit" />
          </label>
          <Button size="sm" variant="outline" onClick={() => symulacja.mutate()} disabled={symulacja.isPending || !kraj} data-testid="button-symulacja">{symulacja.isPending ? "Liczenie…" : "Symuluj"}</Button>
        </div>
        {partner.kraje.length === 0 ? <p className="text-xs text-muted-foreground">Partner nie ma jeszcze żadnego kraju.</p> : null}
        {symulacja.isError ? <p className="text-sm text-destructive" role="alert" data-testid="text-symulacja-blad">{komunikatBledu(symulacja.error)}</p> : null}
        {wynik ? (
          <div className="space-y-2" data-testid="wynik-symulacji">
            <p className="text-xs text-muted-foreground" data-testid="symulacja-naglowek">
              Kraj {wynik.kraj}; kurs EUR {wynik.kurs ? `${wynik.kurs.kurs.toLocaleString("pl-PL", { maximumFractionDigits: 4 })} (${wynik.kurs.zrodlo}${wynik.kurs.dataTabeli ? `, tabela NBP z ${wynik.kurs.dataTabeli}` : ""})` : "— brak"}; pozycji w ofercie: {wynik.pozycjeWybrane}.
              Formuła: <code>{wynik.formula}</code> (zakup w PLN, narzut = marża sklepu + dopłata kraju/reguły).
            </p>
            {wynik.ostrzezenia.map((o) => <p key={o} className="text-xs text-amber-600">{o}</p>)}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs" data-testid="tabela-symulacji">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="p-1.5">Produkt</th>
                    <th className="p-1.5 text-right">Zakup (PLN)</th>
                    <th className="p-1.5">Narzut</th>
                    <th className="p-1.5">Przesyłka (GEIS)</th>
                    <th className="p-1.5 text-right">Koszty dod. (EUR)</th>
                    <th className="p-1.5 text-right">Cena (EUR)</th>
                  </tr>
                </thead>
                <tbody>
                  {wynik.wiersze.map((w) => (
                    <tr key={w.kod} className="border-t align-top" data-testid={`symulacja-wiersz-${w.kod}`}>
                      <td className="p-1.5">
                        <div className="font-mono">{w.kod}</div>
                        <div>{w.nazwa}</div>
                        <div className="text-muted-foreground">{w.dostawca}, stan {w.stan}{w.waga ? `, ${w.waga} kg` : ", brak wagi"}{w.wymiary ? `, ${w.wymiary}` : ""}</div>
                      </td>
                      <td className="p-1.5 text-right">{eur(w.zakupPln)}</td>
                      <td className="p-1.5">
                        <div className="font-medium">{proc(w.narzutLacznyProc)}</div>
                        <div className="text-muted-foreground">marża sklepu {proc(w.marzaSklepuProc)} + dopłata {proc(w.doplataProc)} ({w.zrodloDoplaty})</div>
                      </td>
                      <td className="p-1.5"><Przesylka w={w} /></td>
                      <td className="p-1.5 text-right">{eur(w.kosztyDodatkoweEur)}</td>
                      <td className="p-1.5 text-right">
                        {w.cenaEur !== null ? <span className="font-semibold" data-testid={`symulacja-cena-${w.kod}`}>{eur(w.cenaEur)}</span> : <span className="text-destructive" data-testid={`symulacja-blad-${w.kod}`}>{w.blad ?? "brak ceny"}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {wynik.wiersze.length === 0 ? <p className="text-xs text-muted-foreground" data-testid="symulacja-pusto">Brak pozycji do pokazania (zły kod albo partner nie ma pozycji w ofercie).</p> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
