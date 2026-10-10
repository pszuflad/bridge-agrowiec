/** Zamówienia odebrane od partnera — lista i szczegóły, tylko odczyt (ticket 230, PRT-7.6a). Statusy i akcje: PRT-7.4/7.5. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { Fragment, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import {
  KLUCZ_PARTNERZY, LIMIT_ZAMOWIEN, komunikatBledu, kluczZamowien, kluczZamowienia, odbierzZamowienia,
  type ListaZamowien, type SzczegolyPartnera, type SzczegolyZamowienia, type WynikOdbioru,
} from "./api";

const czas = (iso: string): string => new Date(iso).toLocaleString("pl-PL");
/** Polskie etykiety znanych pól adresu dostawy; nieznane pola partnera pokazujemy pod ich nazwą z pliku. */
const ETYKIETY_DOSTAWY: Record<string, string> = { CUSTOMERNAME: "Odbiorca", COUNTRY: "Kraj", PHONE: "Telefon", MODEOFTRANSPORT: "Sposób transportu", CODCOST: "Pobranie", DELIVERY_COST: "Koszt dostawy" };

export function ZamowieniaPartnera({ partner }: { partner: SzczegolyPartnera }) {
  const [otwarte, ustawOtwarte] = useState<number | null>(null);
  const klient = useQueryClient();
  const { toast } = useToast();
  const lista = useQuery<ListaZamowien | null>({ queryKey: kluczZamowien(partner.id), refetchOnMount: "always" });
  const odswiez = () => {
    void lista.refetch();
    // Szczegóły rozwiniętych zamówień też od nowa (inaczej zostałyby w cache ze starym stanem).
    void klient.invalidateQueries({ queryKey: [KLUCZ_PARTNERZY, String(partner.id), "zamowienia"] });
  };

  const kanalGotowy = partner.kanalEmail && !!partner.emailSkrzynka;
  const odbior = useMutation<WynikOdbioru, Error, void>({
    mutationFn: () => odbierzZamowienia(partner.id),
    onSuccess: (w) => {
      if (!w.polaczono) toast({ title: "Nie odebrano zamówień", description: w.powod ?? "Brak połączenia ze skrzynką.", variant: "destructive" });
      else if (w.powod) toast({ title: "Odbiór przerwany", description: w.powod, variant: "destructive" });
      else toast({ title: "Odebrano pocztę", description: `Wiadomości: ${w.wiadomosci}, nowych zamówień: ${w.nowe}, powtórzonych: ${w.duplikaty}, błędnych: ${w.bledy}.`, variant: w.bledy > 0 ? "destructive" : "default" });
      // Tylko to, co odbiór zmienia: lista i szczegóły zamówień oraz logi/błędy partnera (nie cała strona partnera ani podgląd pliku).
      void klient.invalidateQueries({
        predicate: ({ queryKey }) => {
          const [baza, id, sciezka] = queryKey as string[];
          return baza === KLUCZ_PARTNERZY && id === String(partner.id) && typeof sciezka === "string" && /^(zamowienia|logi|error-log)/.test(sciezka);
        },
      });
    },
    onError: (e) => toast({ title: "Odbiór zamówień nie powiódł się", description: komunikatBledu(e), variant: "destructive" }),
  });

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Zamówienia od partnera</h2>
          <div className="flex items-center gap-2">
            <Button size="sm" disabled={!kanalGotowy || odbior.isPending} onClick={() => odbior.mutate()} data-testid="button-zamowienia-odbierz">
              {odbior.isPending ? "Odbieranie…" : "Odbierz teraz"}
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={odswiez} data-testid="button-zamowienia-odswiez">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />Odśwież
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Zamówienia odebrane kanałem e-mail (tylko podgląd). Statusy i wysyłka do sklepu dojdą w kolejnych etapach.</p>
        {!kanalGotowy ? <p className="text-xs text-muted-foreground" data-testid="text-zamowienia-kanal">„Odbierz teraz” wymaga włączonego kanału e-mail i adresu skrzynki w ustawieniach partnera.</p> : null}
        {lista.isError ? <p className="text-sm text-destructive" role="alert" data-testid="text-zamowienia-blad">{komunikatBledu(lista.error)}</p> : null}
        {lista.data && lista.data.zamowienia.length === 0 ? <p className="text-sm text-muted-foreground" data-testid="text-zamowienia-pusto">Brak zamówień — nic jeszcze nie odebrano.</p> : null}
        {lista.data && lista.data.zamowienia.length >= LIMIT_ZAMOWIEN ? (
          <p className="text-xs text-muted-foreground" data-testid="text-zamowienia-obcieta">Pokazano {LIMIT_ZAMOWIEN} najnowszych zamówień — starsze nie są tu widoczne.</p>
        ) : null}
        {lista.data && lista.data.zamowienia.length > 0 ? (
          <ul className="divide-y text-sm" data-testid="lista-zamowien">
            {lista.data.zamowienia.map((z) => {
              const rozwiniete = otwarte === z.id;
              return (
                <li key={z.id} className="py-1.5" data-testid={`zamowienie-${z.id}`}>
                  <button
                    type="button"
                    className="flex w-full flex-wrap items-center gap-2 text-left"
                    aria-expanded={rozwiniete}
                    onClick={() => ustawOtwarte(rozwiniete ? null : z.id)}
                    data-testid={`button-zamowienie-${z.id}`}
                  >
                    {rozwiniete ? <ChevronDown className="h-3.5 w-3.5" aria-hidden /> : <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
                    <span className="font-medium">{z.numerPartnera}</span>
                    <Badge variant="secondary">{z.status}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {z.krajDostawy ?? "—"} · {z.liczbaPozycji} poz. · odebrano {czas(z.pobrano)}
                    </span>
                  </button>
                  {rozwiniete ? <SzczegolyZamowieniaWidok partnerId={partner.id} zamowienieId={z.id} /> : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SzczegolyZamowieniaWidok({ partnerId, zamowienieId }: { partnerId: number; zamowienieId: number }) {
  const { data, isError, error, isPending } = useQuery<SzczegolyZamowienia | null>({ queryKey: kluczZamowienia(partnerId, zamowienieId), refetchOnMount: "always" });
  if (isError) return <p className="mt-2 text-sm text-destructive" role="alert" data-testid="text-zamowienie-blad">{komunikatBledu(error)}</p>;
  if (isPending || !data) return <p className="mt-2 text-sm text-muted-foreground">Ładowanie…</p>;
  const dostawa = Object.entries(data.dostawa).filter(([, v]) => v !== "");
  return (
    <div className="mt-2 space-y-3 rounded-md bg-muted/40 p-3" data-testid={`szczegoly-zamowienia-${zamowienieId}`}>
      <p className="text-xs text-muted-foreground">
        Data zamówienia: {data.dataZamowienia ?? "—"} · dostawa: {data.dataDostawy ?? "—"} · waluta: {data.waluta ?? "—"} · koszt dostawy: {data.kosztDostawy ?? "—"}
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-muted-foreground"><th className="py-1 pr-2">Lp</th><th className="pr-2">Kod</th><th className="pr-2">Nazwa</th><th className="pr-2 text-right">Ilość</th><th className="text-right">Cena</th></tr>
        </thead>
        <tbody>
          {data.pozycje.map((p) => (
            <tr key={p.id} data-testid={`pozycja-${zamowienieId}-${p.lp}`}>
              <td className="py-0.5 pr-2">{p.lp}</td><td className="pr-2 font-mono">{p.kod}</td><td className="pr-2">{p.nazwa ?? "—"}</td>
              <td className="pr-2 text-right">{p.ilosc}</td><td className="text-right">{p.cenaSprzedazy ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {dostawa.length > 0 ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs" data-testid={`dostawa-${zamowienieId}`}>
          {dostawa.map(([k, v]) => (
            <Fragment key={k}><dt className="text-muted-foreground">{ETYKIETY_DOSTAWY[k] ?? k}</dt><dd>{v}</dd></Fragment>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
