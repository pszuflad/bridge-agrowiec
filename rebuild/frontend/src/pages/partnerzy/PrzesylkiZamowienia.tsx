/**
 * Tracking zamówienia partnera (ticket 256): miejsce na numer listu przewozowego. Po zapisaniu Bridge sam tworzy plik trackingu (CSV, format wg założenia użytkowniczki)
 * i zapisuje go w katalogu partnera, żeby partner dostał numer przesyłki. Bez skonfigurowanego katalogu plik zostaje do podejrzenia i skopiowania tutaj.
 * Jedna przesyłka = jeden numer listu; przy kilku paczkach dodaje się każdy numer osobno z ilościami sztuk w tej paczce.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  dodajPrzesylke, komunikatBledu, kluczPlikuPrzesylki, kluczPrzesylek, ponowPlikPrzesylki,
  type ListaPrzesylek, type Przesylka, type SzczegolyZamowienia,
} from "./api";

const KLASA_SELECT = "h-9 rounded-md border border-input bg-background px-2 text-sm";
const STATUSY_PLIKU: Record<Przesylka["plikStatus"], { etykieta: string; blad: boolean }> = {
  zapisany: { etykieta: "plik zapisany u partnera", blad: false },
  brak_katalogu: { etykieta: "plik do pobrania (katalog partnera nie skonfigurowany)", blad: false },
  blad: { etykieta: "błąd zapisu pliku", blad: true },
};

function PlikPrzesylki({ partnerId, zamowienieId, wysylkaId }: { partnerId: number; zamowienieId: number; wysylkaId: number }) {
  const q = useQuery<{ nazwa: string; tresc: string } | null>({ queryKey: kluczPlikuPrzesylki(partnerId, zamowienieId, wysylkaId), retry: false });
  if (q.isError) return <p className="text-destructive" role="alert">{komunikatBledu(q.error)}</p>;
  if (!q.data) return <p className="text-muted-foreground">Ładowanie…</p>;
  return (
    <div>
      <p className="font-mono text-muted-foreground">{q.data.nazwa}</p>
      <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-muted/40 p-2" data-testid={`plik-przesylki-${wysylkaId}`}>{q.data.tresc}</pre>
    </div>
  );
}

export function PrzesylkiZamowienia({ partnerId, zamowienie }: { partnerId: number; zamowienie: SzczegolyZamowienia }) {
  const zamowienieId = zamowienie.id;
  const klient = useQueryClient();
  const { toast } = useToast();
  const [pokazPlik, ustawPokazPlik] = useState<number | null>(null);
  const [przewoznik, ustawPrzewoznik] = useState("");
  const [numer, ustawNumer] = useState("");
  const [typ, ustawTyp] = useState<"delivery" | "pickup">("delivery");
  const [ilosci, ustawIlosci] = useState<Record<number, string>>({});
  const q = useQuery<ListaPrzesylek | null>({ queryKey: kluczPrzesylek(partnerId, zamowienieId), retry: false });
  const przesylki = q.data?.przesylki ?? [];
  const mozna = ["przyjete", "wysylanie", "wyslane"].includes(zamowienie.status);

  const wyslane = new Map<number, number>();
  for (const p of przesylki) for (const x of p.pozycje) wyslane.set(x.pozycjaId, (wyslane.get(x.pozycjaId) ?? 0) + x.ilosc);
  const zostalo = (id: number, ilosc: number): number => Math.max(0, ilosc - (wyslane.get(id) ?? 0));
  const odswiez = () => klient.invalidateQueries({ queryKey: kluczPrzesylek(partnerId, zamowienieId) });

  const dodanie = useMutation<Awaited<ReturnType<typeof dodajPrzesylke>>, Error, void>({
    mutationFn: async () => {
      const pozycje = zamowienie.pozycje
        .map((p) => ({ pozycjaId: p.id, ilosc: ilosci[p.id] === undefined || ilosci[p.id] === "" ? zostalo(p.id, p.ilosc) : Number(ilosci[p.id]) }))
        .filter((p) => p.ilosc !== 0);
      if (pozycje.some((p) => !Number.isInteger(p.ilosc) || p.ilosc < 0)) throw new Error("Ilości w przesyłce muszą być liczbami całkowitymi (0 = pozycji nie ma w tej paczce).");
      return dodajPrzesylke(partnerId, zamowienieId, { przewoznik: przewoznik.trim(), numerPrzesylki: numer.trim(), typ, pozycje });
    },
    onSuccess: async (w) => {
      toast(
        w.plik === "blad"
          ? { title: "Przesyłka zapisana, ale plik trackingu nie trafił do partnera", description: "Sprawdź katalog partnera i użyj „Ponów zapis pliku”.", variant: "destructive" }
          : { title: "Numer listu zapisany", description: w.plik === "zapisany" ? "Plik trackingu został zapisany w katalogu partnera." : "Plik trackingu jest gotowy do pobrania poniżej (katalog partnera nie jest skonfigurowany)." },
      );
      ustawNumer("");
      ustawIlosci({});
      await odswiez();
    },
    onError: (e) => toast({ title: "Nie zapisano numeru listu", description: komunikatBledu(e), variant: "destructive" }),
  });
  const ponow = useMutation<Awaited<ReturnType<typeof ponowPlikPrzesylki>>, Error, number>({
    mutationFn: (id) => ponowPlikPrzesylki(partnerId, zamowienieId, id),
    onSuccess: async (w) => {
      toast(w.plik === "blad" ? { title: "Zapis pliku nadal się nie udaje", variant: "destructive" } : { title: "Plik trackingu zapisany ponownie" });
      await odswiez();
    },
    onError: (e) => toast({ title: "Nie udało się ponowić zapisu", description: komunikatBledu(e), variant: "destructive" }),
  });

  return (
    <div className="space-y-2 border-t pt-2 text-xs" data-testid={`przesylki-${zamowienieId}`}>
      <h3 className="text-sm font-medium">Numer listu przewozowego (tracking dla partnera)</h3>
      {q.isError ? <p className="text-destructive" role="alert">{komunikatBledu(q.error)}</p> : null}
      {przesylki.length > 0 ? (
        <ul className="space-y-1.5" data-testid={`lista-przesylek-${zamowienieId}`}>
          {przesylki.map((p) => (
            <li key={p.id} className="space-y-1" data-testid={`przesylka-${p.id}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono">{p.numerPrzesylki}</span>
                <span>{p.przewoznik}{p.typ === "pickup" ? " (odbiór)" : ""}</span>
                <span className="text-muted-foreground">{new Date(p.wyslano).toLocaleString("pl-PL")}</span>
                <Badge variant={STATUSY_PLIKU[p.plikStatus].blad ? "destructive" : "secondary"} data-testid={`status-pliku-${p.id}`}>{STATUSY_PLIKU[p.plikStatus].etykieta}</Badge>
                <Button size="sm" variant="outline" onClick={() => ustawPokazPlik(pokazPlik === p.id ? null : p.id)} data-testid={`button-plik-${p.id}`}>{pokazPlik === p.id ? "Ukryj plik" : "Pokaż plik"}</Button>
                {p.plikStatus === "blad" || p.plikStatus === "brak_katalogu" ? (
                  <Button size="sm" variant="outline" disabled={ponow.isPending} onClick={() => ponow.mutate(p.id)} data-testid={`button-ponow-${p.id}`}>Ponów zapis pliku</Button>
                ) : null}
              </div>
              {p.plikBlad ? <p className="text-destructive" data-testid={`blad-pliku-${p.id}`}>{p.plikBlad}</p> : null}
              {pokazPlik === p.id ? <PlikPrzesylki partnerId={partnerId} zamowienieId={zamowienieId} wysylkaId={p.id} /> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {!mozna ? (
        <p className="text-muted-foreground" data-testid={`przesylki-niedostepne-${zamowienieId}`}>Numer listu można dodać dopiero do zamówienia przyjętego (status „{zamowienie.status}”).</p>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-end gap-2">
            <label className="space-y-1">Przewoźnik<Input className="w-40" value={przewoznik} onChange={(e) => ustawPrzewoznik(e.target.value)} data-testid={`input-przewoznik-${zamowienieId}`} /></label>
            <label className="space-y-1">Numer listu<Input className="w-64" value={numer} onChange={(e) => ustawNumer(e.target.value)} data-testid={`input-numer-listu-${zamowienieId}`} /></label>
            <label className="space-y-1">Typ
              <select className={KLASA_SELECT} value={typ} onChange={(e) => ustawTyp(e.target.value as "delivery" | "pickup")} data-testid={`select-typ-trackingu-${zamowienieId}`}>
                <option value="delivery">dostawa</option>
                <option value="pickup">odbiór</option>
              </select>
            </label>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Sztuki w tej przesyłce (domyślnie wszystko, co jeszcze nie zostało wysłane; 0 = pozycji nie ma w tej paczce):</p>
            {zamowienie.pozycje.map((p) => (
              <label key={p.id} className="flex items-center gap-2">
                <Input className="w-16" inputMode="numeric" value={ilosci[p.id] ?? String(zostalo(p.id, p.ilosc))} onChange={(e) => ustawIlosci((x) => ({ ...x, [p.id]: e.target.value }))} data-testid={`input-ilosc-${zamowienieId}-${p.lp}`} />
                <span className="font-mono">{p.kod}</span><span className="text-muted-foreground">z {p.ilosc} (wysłano {wyslane.get(p.id) ?? 0})</span>
              </label>
            ))}
          </div>
          <Button size="sm" disabled={dodanie.isPending || przewoznik.trim() === "" || numer.trim() === ""} onClick={() => dodanie.mutate()} data-testid={`button-dodaj-przesylke-${zamowienieId}`}>
            {dodanie.isPending ? "Zapisywanie…" : "Zapisz i wyślij tracking do partnera"}
          </Button>
        </div>
      )}
    </div>
  );
}
