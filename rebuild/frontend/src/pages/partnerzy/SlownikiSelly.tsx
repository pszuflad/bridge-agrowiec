/**
 * Słowniki zamówień Selly (ticket 241) — statusy, formy płatności i dostawy z `GET /api/partnerzy/selly/slowniki-zamowien` (tylko odczyt).
 * Służą do wskazania identyfikatorów przed tworzeniem zamówień partnerów w Selly. Kształt kluczy odpowiedzi Selly nie jest ustalony, więc
 * tabele pokazują wszystkie klucze rekordu jak leci. Pobranie dopiero po kliknięciu (nie obciąża Selly przy każdym wejściu w widok).
 */
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { KLUCZ_PARTNERZY, komunikatBledu } from "./api";

type Rekord = Record<string, unknown>;
type Slowniki = { statusy: Rekord[]; platnosci: Rekord[]; dostawy: Rekord[] };

const tekst = (v: unknown): string => (v !== null && typeof v === "object" ? JSON.stringify(v) : String(v ?? ""));

function Tabela({ tytul, wiersze, testId }: { tytul: string; wiersze: Rekord[]; testId: string }) {
  const klucze = [...new Set(wiersze.flatMap((w) => Object.keys(w)))];
  return (
    <div className="space-y-1" data-testid={testId}>
      <h3 className="text-sm font-medium">{tytul}</h3>
      {wiersze.length === 0 ? (
        <p className="text-xs text-muted-foreground">brak pozycji</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                {klucze.map((k) => (
                  <th key={k} className="px-2 py-1 font-medium">{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {wiersze.map((w, i) => (
                <tr key={i} className="border-b last:border-0">
                  {klucze.map((k) => (
                    <td key={k} className="px-2 py-1">{tekst(w[k])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function SlownikiSelly() {
  const [pobierz, ustawPobierz] = useState(false);
  const q = useQuery<Slowniki | null>({ queryKey: [KLUCZ_PARTNERZY, "selly", "slowniki-zamowien"], enabled: pobierz, retry: false });
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant="outline" disabled={q.isFetching} onClick={() => (pobierz ? void q.refetch() : ustawPobierz(true))} data-testid="button-slowniki-selly">
            {q.isFetching ? "Pobieranie…" : "Słowniki zamówień Selly"}
          </Button>
          <span className="text-xs text-muted-foreground">Statusy, płatności i dostawy ze sklepu (tylko odczyt) — identyfikatory do tworzenia zamówień partnerów.</span>
        </div>
        {q.isError ? (
          <p className="rounded-md bg-destructive/10 px-3.5 py-3 text-sm text-destructive" role="alert" data-testid="text-slowniki-selly-blad">
            {komunikatBledu(q.error)}
          </p>
        ) : null}
        {q.data ? (
          <div className="space-y-4">
            <Tabela tytul="Statusy zamówień" wiersze={q.data.statusy} testId="tabela-selly-statusy" />
            <Tabela tytul="Formy płatności" wiersze={q.data.platnosci} testId="tabela-selly-platnosci" />
            <Tabela tytul="Formy dostawy" wiersze={q.data.dostawy} testId="tabela-selly-dostawy" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
