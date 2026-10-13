/**
 * Dane do faktury wg kraju dostawy (ticket 252): zamawiający w zamówieniu Selly bywa inny zależnie od kraju (np. oddzielne spółki partnera).
 * Dla zamówienia z danym krajem dostawy Bridge bierze dane z tego kraju; gdy kraj nie ma własnych (puste = nazwa firmy pusta) — dane domyślne
 * z „Ustawień” partnera. Cały komplet pochodzi z jednego źródła (pola nie mieszają się między krajem a partnerem).
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { nazwaKraju } from "@/lib/kraje";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { KLUCZ_PARTNERZY, komunikatBledu, zapiszFakturaKraju, type FakturaKraju, type KrajPartnera, type SzczegolyPartnera } from "./api";

const POLA: { klucz: keyof FakturaKraju; etykieta: string; szerokosc: string }[] = [
  { klucz: "fakturaNazwa", etykieta: "Nazwa firmy", szerokosc: "w-56" },
  { klucz: "fakturaNip", etykieta: "NIP / VAT UE", szerokosc: "w-36" },
  { klucz: "fakturaUlica", etykieta: "Ulica i numer", szerokosc: "w-48" },
  { klucz: "fakturaKod", etykieta: "Kod", szerokosc: "w-24" },
  { klucz: "fakturaMiasto", etykieta: "Miasto", szerokosc: "w-36" },
  { klucz: "fakturaKraj", etykieta: "Kraj (kod)", szerokosc: "w-20" },
];

function Wiersz({ partnerId, kraj }: { partnerId: number; kraj: KrajPartnera }) {
  const klient = useQueryClient();
  const { toast } = useToast();
  const [pola, ustawPola] = useState<Record<keyof FakturaKraju, string>>({
    fakturaNazwa: kraj.fakturaNazwa ?? "", fakturaNip: kraj.fakturaNip ?? "", fakturaUlica: kraj.fakturaUlica ?? "",
    fakturaKod: kraj.fakturaKod ?? "", fakturaMiasto: kraj.fakturaMiasto ?? "", fakturaKraj: kraj.fakturaKraj ?? "",
  });
  const zapis = useMutation<void, Error, void>({
    mutationFn: async () => {
      const dane = Object.fromEntries(Object.entries(pola).map(([k, v]) => [k, v.trim() === "" ? null : k === "fakturaKraj" ? v.trim().toUpperCase() : v.trim()])) as FakturaKraju;
      if (dane.fakturaNazwa === null && Object.values(dane).some((v) => v !== null)) throw new Error("Podaj nazwę firmy albo wyczyść wszystkie pola (puste = dane domyślne partnera).");
      await zapiszFakturaKraju(partnerId, kraj.kraj, dane);
    },
    onSuccess: async () => {
      toast({ title: `Zapisano dane do faktury (${kraj.kraj})` });
      await klient.invalidateQueries({ queryKey: [KLUCZ_PARTNERZY] });
    },
    onError: (e) => toast({ title: "Nie udało się zapisać danych do faktury", description: komunikatBledu(e), variant: "destructive" }),
  });
  return (
    <tr className="border-b last:border-0" data-testid={`row-faktura-${kraj.kraj}`}>
      <td className="px-2 py-2 font-medium">{kraj.kraj}<span className="block text-xs font-normal text-muted-foreground">{nazwaKraju(kraj.kraj) ?? ""}</span></td>
      {POLA.map((p) => (
        <td key={p.klucz} className="px-2 py-2">
          <Input className={p.szerokosc} aria-label={`${p.etykieta} ${kraj.kraj}`} maxLength={p.klucz === "fakturaKraj" ? 2 : 120} value={pola[p.klucz]} onChange={(e) => ustawPola((x) => ({ ...x, [p.klucz]: e.target.value }))} data-testid={`input-faktura-${p.klucz}-${kraj.kraj}`} />
        </td>
      ))}
      <td className="px-2 py-2 text-right">
        <Button size="sm" variant="outline" disabled={zapis.isPending} onClick={() => zapis.mutate()} data-testid={`button-faktura-zapisz-${kraj.kraj}`}>Zapisz</Button>
      </td>
    </tr>
  );
}

export function FakturyKrajow({ partner }: { partner: SzczegolyPartnera }) {
  if (partner.kraje.length === 0) return null;
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">Dane do faktury wg kraju dostawy</h2>
        <p className="text-xs text-muted-foreground">
          Zamawiający w zamówieniu Selly zależy od kraju dostawy z zamówienia. Puste pola kraju = dane domyślne z „Ustawień” partnera. Wypełniony kraj używa wyłącznie własnych danych (nazwa firmy jest wymagana).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-2 py-2 font-medium">Kraj</th>
                {POLA.map((p) => <th key={p.klucz} className="px-2 py-2 font-medium">{p.etykieta}</th>)}
                <th className="px-2 py-2" aria-label="Akcje" />
              </tr>
            </thead>
            <tbody>
              {partner.kraje.map((k) => <Wiersz key={`${k.kraj}-${k.fakturaNazwa ?? ""}-${k.fakturaNip ?? ""}-${k.fakturaUlica ?? ""}-${k.fakturaKod ?? ""}-${k.fakturaMiasto ?? ""}-${k.fakturaKraj ?? ""}`} partnerId={partner.id} kraj={k} />)}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
