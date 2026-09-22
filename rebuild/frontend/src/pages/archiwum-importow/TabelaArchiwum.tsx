/**
 * Tabela archiwum — osiem kolumn z `archive-injection.js:179-191`.
 *
 * Bez paginacji, jak w oryginale: retencja 7 dni trzyma listę krótką.
 */
import { Download } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { sformatujDate, sformatujRozmiar, type PozycjaArchiwum } from "./dane";

/** Treść błędu parsowania pod nazwą pliku — oryginał tnie ją do 120 znaków (:186). */
const MAKS_DLUGOSC_BLEDU = 120;

export function OdznakaStatusu({ status }: { status: string }) {
  // Oryginał: wszystko poza `blad` jest „OK" (:189).
  return status === "blad" ? (
    <Badge variant="outline" className="border-red-200 bg-red-50 text-[10px] text-red-800">
      BŁĄD
    </Badge>
  ) : (
    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-800">
      OK
    </Badge>
  );
}

export type WlasciwosciTabeliArchiwum = {
  pozycje: PozycjaArchiwum[];
  onPobierz: (pozycja: PozycjaArchiwum) => void;
};

export function TabelaArchiwum({ pozycje, onPobierz }: WlasciwosciTabeliArchiwum) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">Data</th>
            <th className="px-4 py-2.5 font-medium">Dostawca</th>
            <th className="px-4 py-2.5 font-medium">Źródło</th>
            <th className="px-4 py-2.5 font-medium">Plik</th>
            <th className="px-4 py-2.5 font-medium">Rozmiar</th>
            <th className="px-4 py-2.5 font-medium">Rekordy</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">
              <span className="sr-only">Pobierz</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {pozycje.map((pozycja) => (
            <tr
              key={pozycja.id}
              className="border-t border-border hover:bg-muted/30"
              data-testid={`row-archiwum-${pozycja.id}`}
            >
              <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-muted-foreground">
                {sformatujDate(pozycja.data)}
              </td>
              <td className="px-4 py-2 font-semibold">{pozycja.dostawca || "—"}</td>
              <td className="px-4 py-2 text-xs text-muted-foreground">
                {pozycja.zrodlo || "—"}
                {pozycja.uzytkownik ? ` · ${pozycja.uzytkownik}` : ""}
              </td>
              <td className="px-4 py-2">
                <div className="break-all font-mono text-[11.5px]">{pozycja.oryginalnaNazwa || ""}</div>
                {pozycja.blad ? (
                  <div className="mt-0.5 text-[11px] text-destructive">
                    {String(pozycja.blad).slice(0, MAKS_DLUGOSC_BLEDU)}
                  </div>
                ) : null}
              </td>
              <td className="whitespace-nowrap px-4 py-2 font-mono text-xs">
                {sformatujRozmiar(pozycja.rozmiar)}
              </td>
              <td className="px-4 py-2 font-mono text-xs tabular-nums">
                {pozycja.rekordy != null ? pozycja.rekordy : "—"}
              </td>
              <td className="px-4 py-2">
                <OdznakaStatusu status={pozycja.status} />
              </td>
              <td className="px-4 py-2 text-right">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 px-2.5 text-xs"
                  data-testid={`button-archiwum-pobierz-${pozycja.id}`}
                  onClick={() => onPobierz(pozycja)}
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  Pobierz
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
