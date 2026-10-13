/**
 * Reguły narzutów partnera (ticket 247) — zasada jak w „narzutach i promocjach” sklepu, ale osobne dane tego partnera.
 * Reguła z warunkami (marka, kategoria, dostawca, rozmiar… — koniunkcja) bije regułę bez warunków (globalną), niezależnie od priorytetu; między regułami
 * z warunkami wygrywa wyższy priorytet; remis: reguła zawężona do kraju, potem starsza. Brak pasującej reguły = narzut kraju z tabeli krajów.
 * Zmiana reguły nic nie przelicza od razu — ceny powstają przy generowaniu pliku (podgląd pliku pokazuje je od razu).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { DialogPotwierdzenia } from "@/components/DialogPotwierdzenia";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { zadanie } from "@/lib/api";
import { kodZNazwa } from "@/lib/kraje";
import { KLUCZ_PARTNERZY, komunikatBledu, liczbaZPola, type SzczegolyPartnera } from "./api";

type Warunek = { typ: string; wartosc: string };
type Regula = { id: number; kraj: string | null; nazwa: string; warunki: Warunek[]; wartosc: number; priorytet: number; status: string };

/** Typy i etykiety jak w sekcji „Narzuty” sklepu (`pages/narzuty/warunki.ts`). */
const TYPY: { value: string; label: string }[] = [
  { value: "dostawca", label: "Dostawca (dokładnie, np. MO1)" },
  { value: "kategoria", label: "Kategoria (fragment tekstu)" },
  { value: "marka", label: "Marka (fragment tekstu)" },
  { value: "rozmiar", label: "Rozmiar (fragment tekstu)" },
  { value: "bieznik", label: "Bieżnik (fragment tekstu)" },
  { value: "produkt", label: "Konkretny produkt (kod lub nazwa)" },
  { value: "konstrukcja", label: "Konstrukcja (fragment tekstu)" },
  { value: "srednica", label: "Średnica (dokładna)" },
  { value: "vfIf", label: "VF / IF (fragment tekstu)" },
];
const KLASA_SELECT = "h-9 rounded-md border border-input bg-background px-2 text-sm";
const opisWarunkow = (w: Warunek[]): string => (w.length === 0 ? "wszystkie opony (globalna)" : w.map((x) => `${TYPY.find((t) => t.value === x.typ)?.label.split(" (")[0] ?? x.typ}: ${x.wartosc}`).join(" i "));

type Formularz = { id: number | null; nazwa: string; wartosc: string; kraj: string; priorytet: string; status: string; warunki: Warunek[] };
const PUSTY: Formularz = { id: null, nazwa: "", wartosc: "", kraj: "", priorytet: "50", status: "aktywny", warunki: [] };

export function NarzutyPartnera({ partner }: { partner: SzczegolyPartnera }) {
  const klient = useQueryClient();
  const { toast } = useToast();
  const klucz = [KLUCZ_PARTNERZY, String(partner.id), "narzuty"];
  const q = useQuery<{ reguly: Regula[] } | null>({ queryKey: klucz, refetchOnMount: "always" });
  const [f, ustawF] = useState<Formularz | null>(null);
  const [doUsuniecia, ustawDoUsuniecia] = useState<Regula | null>(null);

  const zapis = useMutation<void, Error, Formularz>({
    mutationFn: async (x) => {
      const w = liczbaZPola(x.wartosc);
      const p = liczbaZPola(x.priorytet);
      if (x.nazwa.trim() === "") throw new Error("Nazwa reguły jest wymagana.");
      if (w === null || Number.isNaN(w) || w <= 0) throw new Error("Narzut musi być liczbą większą od zera (w procentach).");
      if (p === null || Number.isNaN(p) || !Number.isInteger(p) || p < 0 || p > 1000) throw new Error("Priorytet to liczba całkowita 0–1000.");
      if (x.warunki.some((c) => c.wartosc.trim() === "")) throw new Error("Każdy warunek musi mieć wartość (albo go usuń).");
      const cialo = { nazwa: x.nazwa.trim(), wartosc: w, kraj: x.kraj === "" ? null : x.kraj, priorytet: p, status: x.status, warunki: x.warunki.map((c) => ({ typ: c.typ, wartosc: c.wartosc.trim() })) };
      await zadanie(x.id === null ? "POST" : "PATCH", `${KLUCZ_PARTNERZY}/${partner.id}/narzuty${x.id === null ? "" : `/${x.id}`}`, cialo);
    },
    onSuccess: async () => {
      toast({ title: "Zapisano regułę narzutu" });
      ustawF(null);
      await klient.invalidateQueries({ queryKey: klucz });
    },
    onError: (e) => toast({ title: "Nie udało się zapisać reguły", description: komunikatBledu(e), variant: "destructive" }),
  });
  const kasowanie = useMutation<void, Error, number>({
    mutationFn: async (id) => void (await zadanie("DELETE", `${KLUCZ_PARTNERZY}/${partner.id}/narzuty/${id}`)),
    onSuccess: async () => {
      ustawDoUsuniecia(null);
      toast({ title: "Usunięto regułę" });
      await klient.invalidateQueries({ queryKey: klucz });
    },
    onError: (e) => toast({ title: "Nie udało się usunąć reguły", description: komunikatBledu(e), variant: "destructive" }),
  });

  const reguly = q.data?.reguly ?? [];
  const ustawPole = (pole: keyof Formularz, v: string) => ustawF((x) => (x ? { ...x, [pole]: v } : x));
  const ustawWarunek = (i: number, zmiana: Partial<Warunek>) => ustawF((x) => (x ? { ...x, warunki: x.warunki.map((c, j) => (j === i ? { ...c, ...zmiana } : c)) } : x));

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold">Reguły narzutów</h2>
          <Button size="sm" onClick={() => ustawF({ ...PUSTY })} data-testid="button-regula-dodaj">Dodaj regułę</Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Narzut w % od ceny zakupu, osobny dla tego partnera. Reguła z warunkami (np. marka) bije regułę globalną niezależnie od priorytetu; między regułami z warunkami wygrywa wyższy priorytet
          (remis: reguła dla jednego kraju, potem starsza). Brak pasującej reguły = narzut kraju z tabeli krajów powyżej. Uwaga: reguła globalna (bez warunków) obejmuje wszystkie opony i przesłania narzut kraju.
        </p>
        {q.isError ? <p className="text-sm text-destructive" role="alert">{komunikatBledu(q.error)}</p> : null}
        {q.isSuccess && reguly.length === 0 ? <p className="text-sm text-muted-foreground" data-testid="text-reguly-pusto">Brak reguł — obowiązuje narzut kraju.</p> : null}
        {reguly.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Nazwa</th>
                  <th className="px-2 py-2 font-medium">Warunki</th>
                  <th className="px-2 py-2 font-medium">Kraj</th>
                  <th className="px-2 py-2 font-medium">Narzut %</th>
                  <th className="px-2 py-2 font-medium">Priorytet</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2" aria-label="Akcje" />
                </tr>
              </thead>
              <tbody>
                {reguly.map((r) => (
                  <tr key={r.id} className="border-b last:border-0" data-testid={`row-regula-${r.id}`}>
                    <td className="px-2 py-2 font-medium">{r.nazwa}</td>
                    <td className="px-2 py-2">{opisWarunkow(r.warunki)}</td>
                    <td className="px-2 py-2">{r.kraj ? kodZNazwa(r.kraj) : "wszystkie"}</td>
                    <td className="px-2 py-2">{r.wartosc}</td>
                    <td className="px-2 py-2">{r.priorytet}</td>
                    <td className="px-2 py-2">{r.status}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-right">
                      <Button size="sm" variant="outline" onClick={() => ustawF({ id: r.id, nazwa: r.nazwa, wartosc: String(r.wartosc), kraj: r.kraj ?? "", priorytet: String(r.priorytet), status: r.status, warunki: r.warunki })} data-testid={`button-regula-edytuj-${r.id}`}>Edytuj</Button>
                      <Button size="sm" variant="ghost" onClick={() => ustawDoUsuniecia(r)} data-testid={`button-regula-usun-${r.id}`}>Usuń</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {f ? (
          <div className="space-y-3 rounded-md border p-3" data-testid="formularz-reguly">
            <div className="flex flex-wrap items-end gap-3 text-xs">
              <label className="space-y-1">Nazwa<Input className="w-56" value={f.nazwa} onChange={(e) => ustawPole("nazwa", e.target.value)} data-testid="input-regula-nazwa" /></label>
              <label className="space-y-1">Narzut %<Input className="w-24" inputMode="decimal" value={f.wartosc} onChange={(e) => ustawPole("wartosc", e.target.value)} data-testid="input-regula-wartosc" /></label>
              <label className="space-y-1">Kraj
                <select className={KLASA_SELECT} value={f.kraj} onChange={(e) => ustawPole("kraj", e.target.value)} data-testid="select-regula-kraj">
                  <option value="">wszystkie kraje</option>
                  {partner.kraje.map((k) => <option key={k.kraj} value={k.kraj}>{kodZNazwa(k.kraj)}</option>)}
                </select>
              </label>
              <label className="space-y-1">Priorytet (0–1000)<Input className="w-24" inputMode="numeric" value={f.priorytet} onChange={(e) => ustawPole("priorytet", e.target.value)} data-testid="input-regula-priorytet" /></label>
              <label className="space-y-1">Status
                <select className={KLASA_SELECT} value={f.status} onChange={(e) => ustawPole("status", e.target.value)} data-testid="select-regula-status">
                  <option value="aktywny">aktywny</option>
                  <option value="nieaktywny">nieaktywny</option>
                </select>
              </label>
            </div>
            <div className="space-y-2 text-xs">
              <div>Warunki (wszystkie naraz); bez warunków = reguła globalna:</div>
              {f.warunki.map((c, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <select className={KLASA_SELECT} value={c.typ} onChange={(e) => ustawWarunek(i, { typ: e.target.value })} aria-label={`Typ warunku ${i + 1}`} data-testid={`select-warunek-typ-${i}`}>
                    {TYPY.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <Input className="w-48" value={c.wartosc} onChange={(e) => ustawWarunek(i, { wartosc: e.target.value })} aria-label={`Wartość warunku ${i + 1}`} data-testid={`input-warunek-wartosc-${i}`} />
                  <Button size="sm" variant="ghost" onClick={() => ustawF((x) => (x ? { ...x, warunki: x.warunki.filter((_, j) => j !== i) } : x))} data-testid={`button-warunek-usun-${i}`}>Usuń warunek</Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => ustawF((x) => (x ? { ...x, warunki: [...x.warunki, { typ: "marka", wartosc: "" }] } : x))} data-testid="button-warunek-dodaj">Dodaj warunek</Button>
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={zapis.isPending} onClick={() => zapis.mutate(f)} data-testid="button-regula-zapisz">{f.id === null ? "Dodaj regułę" : "Zapisz regułę"}</Button>
              <Button size="sm" variant="outline" onClick={() => ustawF(null)} data-testid="button-regula-anuluj">Anuluj</Button>
            </div>
          </div>
        ) : null}
        <DialogPotwierdzenia
          otwarty={doUsuniecia !== null}
          tytul="Usunąć regułę?"
          tresc={doUsuniecia ? `Reguła „${doUsuniecia.nazwa}” przestanie obowiązywać; pozycje wrócą do innych reguł albo do narzutu kraju.` : ""}
          etykietaPotwierdzenia="Usuń"
          wariantPotwierdzenia="destructive"
          zajety={kasowanie.isPending}
          onPotwierdz={() => doUsuniecia && kasowanie.mutate(doUsuniecia.id)}
          onZamknij={() => ustawDoUsuniecia(null)}
        />
      </CardContent>
    </Card>
  );
}
