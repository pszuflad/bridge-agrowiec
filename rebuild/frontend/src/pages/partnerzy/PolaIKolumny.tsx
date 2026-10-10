/** Sekcje „Pola obliczeniowe” i „Kolumny pliku” w konfiguracji partnera (ticket 224, PRT-5.3). Kolejność zapisu: pola → kolumny. */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  KLUCZ_PARTNERZY, POLA_KATALOGU, ZMIENNE_POL, bledyPol, komunikatBledu, zapiszKolumny, zapiszPola,
  type BladPola, type KolumnaDoZapisu, type SzczegolyPartnera,
} from "./api";

const KLASA_SELECT = "h-9 rounded-md border border-input bg-background px-2 text-sm";

export function PolaObliczeniowe({ partner }: { partner: SzczegolyPartnera }) {
  const klient = useQueryClient();
  const { toast } = useToast();
  const [pola, ustawPola] = useState(partner.polaObliczeniowe.map((p) => ({ nazwa: p.nazwa, formula: p.formula })));
  const [bledy, ustawBledy] = useState<BladPola[]>([]);
  const zmienne = [...ZMIENNE_POL, ...partner.kraje.map((k) => `cena_${k.kraj}`)];

  const zmien = (i: number, zmiany: Partial<{ nazwa: string; formula: string }>) => {
    ustawPola((p) => p.map((x, j) => (j === i ? { ...x, ...zmiany } : x)));
    ustawBledy([]);
  };
  const zapis = useMutation<void, Error, void>({
    mutationFn: () => zapiszPola(partner.id, pola),
    onSuccess: async () => {
      ustawBledy([]);
      toast({ title: "Zapisano pola obliczeniowe" });
      await klient.invalidateQueries({ queryKey: [KLUCZ_PARTNERZY] });
    },
    onError: (e) => {
      const b = bledyPol(e);
      ustawBledy(b);
      toast({ title: "Nie udało się zapisać pól", description: b.length ? "Formuły zawierają błędy — szczegóły przy polach." : komunikatBledu(e), variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">Pola obliczeniowe</h2>
        <p className="text-xs text-muted-foreground">
          Własne kolumny liczone z danych katalogu, np. <code>cena_FR + 10</code>. Operatory: + − × ÷, nawiasy, funkcje <code>zaokr(x, n)</code>, <code>min</code>, <code>max</code>, <code>abs</code>;
          separator dziesiętny to kropka. Zmienne: <code>{zmienne.join(", ")}</code>. Najpierw zapisz pola, potem użyj ich w kolumnach.
        </p>
        {pola.map((p, i) => {
          const blad = bledy.find((b) => b.indeks === i);
          return (
            <div key={i} className="space-y-1" data-testid={`row-pole-${i}`}>
              <div className="flex flex-wrap items-center gap-2">
                <Input className="w-44" placeholder="Nazwa pola" aria-label={`Nazwa pola ${i + 1}`} value={p.nazwa} onChange={(e) => zmien(i, { nazwa: e.target.value })} data-testid={`input-pole-nazwa-${i}`} />
                <Input className="min-w-64 flex-1 font-mono" placeholder="Formuła" aria-label={`Formuła pola ${i + 1}`} value={p.formula} onChange={(e) => zmien(i, { formula: e.target.value })} data-testid={`input-pole-formula-${i}`} />
                <Button size="icon" variant="ghost" aria-label={`Usuń pole ${i + 1}`} onClick={() => { ustawPola((x) => x.filter((_, j) => j !== i)); ustawBledy([]); }} data-testid={`button-pole-usun-${i}`}><Trash2 className="h-4 w-4" aria-hidden /></Button>
              </div>
              {blad ? (
                <p className="text-xs text-destructive" role="alert" data-testid={`text-pole-blad-${i}`}>
                  {blad.komunikat}{blad.pozycja !== null ? ` (znak ${blad.pozycja + 1})` : ""}
                </p>
              ) : null}
            </div>
          );
        })}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => ustawPola((p) => [...p, { nazwa: "", formula: "" }])} data-testid="button-pole-dodaj"><Plus className="h-3.5 w-3.5" aria-hidden />Dodaj pole</Button>
          <Button size="sm" onClick={() => zapis.mutate()} disabled={zapis.isPending} data-testid="button-pola-zapisz">Zapisz pola</Button>
        </div>
      </CardContent>
    </Card>
  );
}

const PUSTA_KOLUMNA: KolumnaDoZapisu = { nazwaWPliku: "", zrodloTyp: "katalog", zrodlo: "kod" };

export function KolumnyPliku({ partner }: { partner: SzczegolyPartnera }) {
  const klient = useQueryClient();
  const { toast } = useToast();
  const [kolumny, ustawKolumny] = useState<KolumnaDoZapisu[]>(partner.kolumny.map((k) => ({ nazwaWPliku: k.nazwaWPliku, zrodloTyp: k.zrodloTyp, zrodlo: k.zrodlo })));
  const kraje = partner.kraje.map((k) => k.kraj);
  const pola = partner.polaObliczeniowe.map((p) => p.nazwa);

  const opcje = (typ: KolumnaDoZapisu["zrodloTyp"]): { wartosc: string; etykieta: string }[] =>
    typ === "katalog" ? POLA_KATALOGU.map((p) => ({ wartosc: p.pole, etykieta: p.etykieta })) : typ === "cena" ? kraje.map((k) => ({ wartosc: k, etykieta: `cena EUR — ${k}` })) : pola.map((n) => ({ wartosc: n, etykieta: n }));
  const istnieje = (k: KolumnaDoZapisu): boolean => opcje(k.zrodloTyp).some((o) => o.wartosc === k.zrodlo);
  const zmien = (i: number, zmiany: Partial<KolumnaDoZapisu>) => ustawKolumny((a) => a.map((k, j) => (j === i ? { ...k, ...zmiany } : k)));
  const przesun = (i: number, o: -1 | 1) =>
    ustawKolumny((a) => {
      const b = [...a];
      const [x] = b.splice(i, 1);
      b.splice(i + o, 0, x!);
      return b;
    });

  const zapis = useMutation<void, Error, void>({
    mutationFn: () => zapiszKolumny(partner.id, kolumny),
    onSuccess: async () => {
      toast({ title: "Zapisano kolumny pliku" });
      await klient.invalidateQueries({ queryKey: [KLUCZ_PARTNERZY] });
    },
    onError: (e) => toast({ title: "Nie udało się zapisać kolumn", description: komunikatBledu(e), variant: "destructive" }),
  });

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">Kolumny pliku</h2>
        <p className="text-xs text-muted-foreground">
          Kolejność kolumn w pliku partnera. Dwie lub więcej kolumn z cenami różnych krajów daje jeden plik z kolumnami krajów; jedna kolumna z ceną — osobny plik na kraj.
        </p>
        {kolumny.length === 0 ? <p className="text-sm text-muted-foreground" data-testid="text-kolumny-pusto">Brak kolumn — plik nie powstanie.</p> : null}
        {kolumny.map((k, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2" data-testid={`row-kolumna-${i}`}>
            <Input className="w-44" placeholder="Nazwa w pliku" aria-label={`Nazwa kolumny ${i + 1}`} value={k.nazwaWPliku} onChange={(e) => zmien(i, { nazwaWPliku: e.target.value })} data-testid={`input-kolumna-nazwa-${i}`} />
            <select className={KLASA_SELECT} aria-label={`Typ źródła kolumny ${i + 1}`} value={k.zrodloTyp} onChange={(e) => { const typ = e.target.value as KolumnaDoZapisu["zrodloTyp"]; zmien(i, { zrodloTyp: typ, zrodlo: opcje(typ)[0]?.wartosc ?? "" }); }} data-testid={`select-kolumna-typ-${i}`}>
              <option value="katalog">pole katalogu</option>
              <option value="cena">cena kraju</option>
              <option value="pole">pole obliczeniowe</option>
            </select>
            <select className={KLASA_SELECT} aria-label={`Źródło kolumny ${i + 1}`} value={k.zrodlo} onChange={(e) => zmien(i, { zrodlo: e.target.value })} data-testid={`select-kolumna-zrodlo-${i}`}>
              {!istnieje(k) ? <option value={k.zrodlo}>{k.zrodlo || "—"} (nie istnieje)</option> : null}
              {opcje(k.zrodloTyp).map((o) => <option key={o.wartosc} value={o.wartosc}>{o.etykieta}</option>)}
            </select>
            {!istnieje(k) ? <span className="text-xs text-destructive" data-testid={`text-kolumna-brak-${i}`}>źródło nie istnieje — wybierz inne</span> : null}
            <Button size="icon" variant="ghost" aria-label={`Przesuń kolumnę ${i + 1} w górę`} disabled={i === 0} onClick={() => przesun(i, -1)} data-testid={`button-kolumna-gora-${i}`}><ArrowUp className="h-4 w-4" aria-hidden /></Button>
            <Button size="icon" variant="ghost" aria-label={`Przesuń kolumnę ${i + 1} w dół`} disabled={i === kolumny.length - 1} onClick={() => przesun(i, 1)} data-testid={`button-kolumna-dol-${i}`}><ArrowDown className="h-4 w-4" aria-hidden /></Button>
            <Button size="icon" variant="ghost" aria-label={`Usuń kolumnę ${i + 1}`} onClick={() => ustawKolumny((a) => a.filter((_, j) => j !== i))} data-testid={`button-kolumna-usun-${i}`}><Trash2 className="h-4 w-4" aria-hidden /></Button>
          </div>
        ))}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => ustawKolumny((a) => [...a, { ...PUSTA_KOLUMNA }])} data-testid="button-kolumna-dodaj"><Plus className="h-3.5 w-3.5" aria-hidden />Dodaj kolumnę</Button>
          <Button size="sm" onClick={() => zapis.mutate()} disabled={zapis.isPending} data-testid="button-kolumny-zapisz">Zapisz kolumny</Button>
        </div>
      </CardContent>
    </Card>
  );
}
