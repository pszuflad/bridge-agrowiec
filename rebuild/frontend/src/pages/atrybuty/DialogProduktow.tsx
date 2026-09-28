/**
 * Modal „Produkty używające atrybutu” — port `openProductsModal()`
 * (`mirror/frontend/assets/pending-injection.js:1299-1372`).
 *
 * ⚠ W ORYGINALE TEN MODAL ISTNIEJE DWA RAZY, prawie identycznie: raz w skrypcie injection
 * (przycisk „Podgląd” przy wartości i licznik wystąpień w kolejce), raz WBUDOWANY W BAZOWY
 * BUNDLE (`deminified/frontend-index.js:29404-29469`, IIFE „ATRYBUTY: LICZNIK UŻYCIA + MODAL
 * PODGLĄDU”). To trzecia warstwa produkcyjnego ekranu, której nie wymienia mapa kodu.
 * Tu jest to JEDEN komponent wołany z obu miejsc — duplikat nie miał powodu poza tym,
 * że dwa kawałki kodu nie mogły się nawzajem widzieć.
 *
 * NIE PORTUJEMY linku „Katalog →”: w oryginale ustawia `sessionStorage.katalog_prefilter`
 * i wstrzykuje wartość do inputa wyszukiwania natywnym setterem + `dispatchEvent`, żeby obejść
 * kontrolowany input Reacta (`:1362-1367` + `:1374-1400`). To obejście istnieje wyłącznie
 * dlatego, że injection stoi poza Reactem — w natywnym porcie nie ma czego obchodzić,
 * a samo przejście do katalogu z prefiltrem to zadanie sesji 7c (`/katalog`).
 */
import { useQuery } from "@tanstack/react-query";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { komunikatBledu, pobierzUzycie, type OdpowiedzUzycia } from "./api";

export function DialogProduktow({
  rodzaj,
  wartosc,
  onZamknij,
}: {
  /** `null` = modal zamknięty. Para (rodzaj, wartość) jest kluczem zapytania. */
  rodzaj: string | null;
  wartosc: string | null;
  onZamknij: () => void;
}) {
  const otwarty = rodzaj !== null && wartosc !== null;

  const { data, error, isPending } = useQuery<OdpowiedzUzycia>({
    queryKey: ["/api/atrybuty/uzycie", rodzaj ?? "", wartosc ?? ""],
    queryFn: () => pobierzUzycie(rodzaj ?? "", wartosc ?? ""),
    enabled: otwarty,
  });

  const produkty = data?.products ?? [];
  const ile = data?.count ?? 0;

  return (
    <Dialog open={otwarty} onOpenChange={(stan) => !stan && onZamknij()}>
      <DialogContent className="max-w-4xl" data-testid="dialog-produkty-atrybutu">
        <DialogHeader>
          <DialogTitle>Produkty używające atrybutu</DialogTitle>
          <DialogDescription>
            {rodzaj} = <strong className="text-foreground">{wartosc}</strong>
          </DialogDescription>
        </DialogHeader>

        {isPending && otwarty ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Ładowanie produktów...
          </div>
        ) : error ? (
          <div className="py-5 text-sm text-destructive" data-testid="text-blad-produktow">
            Błąd: {komunikatBledu(error)}
          </div>
        ) : ile === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Żaden produkt w katalogu nie używa tej wartości atrybutu.
          </div>
        ) : (
          <>
            {/*
             * ⚠ `count` idzie z osobnego `COUNT(*)` BEZ limitu, a lista jest ucięta do 200
             * (`repos/atrybuty.ts:302-311`) — stąd dopisek o pokazanej części.
             */}
            <div className="mb-3 text-sm text-muted-foreground" data-testid="text-liczba-produktow">
              Znaleziono <strong className="text-foreground">{ile}</strong> produkt(ów)
              {ile > produkty.length ? ` (pokazano pierwsze ${produkty.length})` : ""}
            </div>
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Dostawca</th>
                    <th className="px-3 py-2 font-medium">Kod</th>
                    <th className="px-3 py-2 font-medium">Nazwa</th>
                    <th className="px-3 py-2 font-medium">Marka</th>
                    <th className="px-3 py-2 font-medium">Rozmiar</th>
                    <th className="px-3 py-2 font-medium text-right">Stan</th>
                  </tr>
                </thead>
                <tbody>
                  {produkty.map((produkt, indeks) => (
                    <tr
                      key={`${produkt.kod ?? ""}-${indeks}`}
                      className="border-t border-border hover:bg-muted/30"
                    >
                      <td className="px-3 py-2">{produkt.dostawca ?? ""}</td>
                      <td className="px-3 py-2 font-mono text-xs">{produkt.kod ?? ""}</td>
                      <td className="px-3 py-2">{produkt.nazwa ?? ""}</td>
                      <td className="px-3 py-2">{produkt.marka ?? ""}</td>
                      <td className="px-3 py-2">{produkt.rozmiar ?? ""}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {produkt.stan != null ? produkt.stan : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
