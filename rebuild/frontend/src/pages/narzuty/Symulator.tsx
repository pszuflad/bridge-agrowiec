/**
 * Symulator ceny — port `UT()` (`deminified/frontend-index.js:24972-25120`).
 *
 * PO CO TO ISTNIEJE: każda zmiana reguły przelicza ceny CAŁEGO katalogu, a wybór reguły nie
 * jest oczywisty — wygrywa najbardziej SZCZEGÓŁOWA, a nie ta o najwyższym priorytecie. To
 * jedyne miejsce, w którym widać, DLACZEGO konkretny produkt ma taką cenę, a nie inną.
 *
 * ⚠ Liczy silnikiem z `ceny.ts`, czyli ZGODNIE Z BACKENDEM — nie portem `Mb()`, który
 * rozjeżdża się z własnym backendem przy regułach z `warunki: "[]"` (plan.md D8). Symulator
 * tłumaczący cenę, której w katalogu nie ma, byłby gorszy niż jego brak.
 */
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Produkt } from "@/pages/katalog/filtrowanie";
import { pobierzNarzuty, pobierzPromocje, type Narzut, type Promocja } from "./api";
import { policzCene } from "./ceny";
import { opiszWarunki, odczytajWarunki } from "./warunki";

const zl = (wartosc: number): string =>
  wartosc.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function Symulator() {
  const [fraza, ustawFraze] = useState("");

  const { data: produkty } = useQuery<Produkt[]>({ queryKey: ["/api/products"] });
  const { data: narzuty = [] } = useQuery<Narzut[]>({
    queryKey: ["/api/markups"],
    queryFn: pobierzNarzuty,
  });
  const { data: promocje = [] } = useQuery<Promocja[]>({
    queryKey: ["/api/promotions"],
    queryFn: pobierzPromocje,
  });

  // Pięć trafień wystarcza — to wyszukiwarka do wskazania produktu, nie druga lista katalogu.
  const trafienia = useMemo(() => {
    const katalog = produkty ?? [];
    const szukane = fraza.trim().toLowerCase();
    if (szukane.length < 2) return [];
    return katalog
      .filter(
        (p) =>
          String(p.kod ?? "").toLowerCase().includes(szukane) ||
          String(p.nazwa ?? "").toLowerCase().includes(szukane),
      )
      .slice(0, 5);
  }, [fraza, produkty]);

  const [wybrany, ustawWybrany] = useState<Produkt | null>(null);
  const rozbicie = wybrany ? policzCene(wybrany, narzuty, promocje) : null;

  return (
    <Card className="border-card-border mt-4">
      <CardContent className="p-4 space-y-3">
        <div>
          <div className="text-sm font-medium">Symulator ceny</div>
          <div className="text-xs text-muted-foreground">
            Sprawdź, która reguła zadziała na konkretny produkt i jak powstaje jego cena.
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-8"
            value={fraza}
            onChange={(e) => {
              ustawFraze(e.target.value);
              ustawWybrany(null);
            }}
            placeholder="Kod albo nazwa produktu…"
            data-testid="input-symulator-szukaj"
          />
        </div>

        {wybrany === null && trafienia.length > 0 ? (
          <ul className="border border-border rounded-md divide-y divide-border">
            {trafienia.map((p) => (
              <li key={p.kod}>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50"
                  onClick={() => ustawWybrany(p)}
                  data-testid={`symulator-trafienie-${p.kod}`}
                >
                  <span className="font-mono text-xs text-muted-foreground">{p.kod}</span>{" "}
                  {p.nazwa}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {wybrany && rozbicie ? (
          <div className="space-y-2 text-sm" data-testid="symulator-rozbicie">
            <div className="font-medium">{wybrany.nazwa}</div>

            <dl className="space-y-1 font-mono tabular-nums text-xs">
              <div className="flex justify-between">
                <dt>Cena zakupu</dt>
                <dd>{zl(rozbicie.zakup)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>
                  Narzut +{rozbicie.narzutPct}%
                  {rozbicie.wybranyNarzut ? (
                    <span className="ml-2 font-sans text-muted-foreground">
                      {rozbicie.wybranyNarzut.nazwa ??
                        opiszWarunki(odczytajWarunki(rozbicie.wybranyNarzut.warunki))}
                    </span>
                  ) : (
                    <span className="ml-2 font-sans text-muted-foreground">brak reguły</span>
                  )}
                </dt>
                <dd>{zl(rozbicie.poNarzucie)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>
                  Rabat −{rozbicie.rabatPct}%
                  {rozbicie.wybranaPromocja ? (
                    <span className="ml-2 font-sans text-muted-foreground">
                      {rozbicie.wybranaPromocja.nazwa}
                    </span>
                  ) : (
                    <span className="ml-2 font-sans text-muted-foreground">brak promocji</span>
                  )}
                </dt>
                <dd>{zl(rozbicie.poRabacie)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>VAT +{rozbicie.vatPct}%</dt>
                <dd>{zl(rozbicie.poRabacie * (1 + rozbicie.vatPct / 100))}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-1 font-semibold">
                <dt>
                  Cena sprzedaży
                  {/* Zaokrąglenie W DÓŁ jest częścią formuły backendu, nie kosmetyką. */}
                  <span className="ml-2 font-sans text-muted-foreground">(w dół)</span>
                </dt>
                <dd data-testid="symulator-cena">{zl(rozbicie.cenaSprzedazy)}</dd>
              </div>
            </dl>

            {rozbicie.cenaSprzedazy < rozbicie.zakup ? (
              <Badge variant="destructive" className="text-[10px]">
                Cena sprzedaży poniżej ceny zakupu
              </Badge>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
