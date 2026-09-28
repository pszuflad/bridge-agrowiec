/**
 * Symulator ceny — port `UT()` (`deminified/frontend-index.js:24972-25091`) wraz z wierszem
 * rozbicia `Pi()` (`:25093-25120`).
 *
 * PO CO TO ISTNIEJE: każda zmiana reguły przelicza ceny CAŁEGO katalogu, a wybór reguły nie
 * jest oczywisty — wygrywa najbardziej SZCZEGÓŁOWA, a nie ta o najwyższym priorytecie. To
 * jedyne miejsce, w którym widać, DLACZEGO konkretny produkt ma taką cenę, a nie inną.
 *
 * ⚠ Liczy silnikiem z `ceny.ts`, czyli ZGODNIE Z BACKENDEM — nie portem `Mb()`, który
 * rozjeżdża się z własnym backendem przy regułach z `warunki: "[]"` (plan.md D8).
 */
import { useQuery } from "@tanstack/react-query";
import { Calculator } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Produkt } from "@/pages/katalog/filtrowanie";
import { pobierzNarzuty, pobierzPromocje, type Narzut, type Promocja } from "./api";
import { policzCene } from "./ceny";
import { opiszWarunki, odczytajWarunki } from "./warunki";

/** Limit trafień 1:1 z oryginałem (`:24987`) — razem z notą, gdy się o niego obetrze. */
const LIMIT_TRAFIEN = 50;

const zl = (wartosc: number): string => `${wartosc.toFixed(2)} zł`;

/** Wiersz rozbicia — port `Pi()` (`:25093`). `delta` to różnica wobec kroku poprzedniego. */
function Wiersz({
  label,
  detail,
  wartosc,
  delta,
  highlight,
  testid,
}: {
  label: string;
  detail?: string | undefined;
  wartosc: number;
  delta?: number | undefined;
  highlight?: boolean | undefined;
  testid?: string | undefined;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-md border px-3 py-2",
        highlight ? "border-primary bg-primary/5" : "border-border",
      )}
      data-testid={testid}
    >
      <div className="min-w-0">
        <div className="text-sm">{label}</div>
        {detail ? <div className="text-xs text-muted-foreground">{detail}</div> : null}
      </div>
      <div className="text-right font-mono tabular-nums whitespace-nowrap">
        {delta !== undefined ? (
          <div className="text-xs text-muted-foreground">
            {delta > 0 ? "+" : ""}
            {zl(delta)}
          </div>
        ) : null}
        <div className={cn("text-sm", highlight && "font-semibold")}>{zl(wartosc)}</div>
      </div>
    </div>
  );
}

export function Symulator() {
  const [fraza, ustawFraze] = useState("");
  const [wybrany, ustawWybrany] = useState<Produkt | null>(null);

  const { data: produkty } = useQuery<Produkt[]>({ queryKey: ["/api/products"] });
  const { data: narzuty = [] } = useQuery<Narzut[]>({
    queryKey: ["/api/markups"],
    queryFn: pobierzNarzuty,
  });
  const { data: promocje = [] } = useQuery<Promocja[]>({
    queryKey: ["/api/promotions"],
    queryFn: pobierzPromocje,
  });

  /** Szukajka po pięciu polach sklejonych spacją — dosłownie jak oryginał (`:24987`). */
  const trafienia = useMemo(() => {
    const katalog = produkty ?? [];
    const szukane = fraza.trim().toLowerCase();
    if (!szukane) return [];
    return katalog
      .filter((p) =>
        [p.rozmiar ?? "", p.marka ?? "", p.model ?? "", p.nazwa ?? "", p.kod ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(szukane),
      )
      .slice(0, LIMIT_TRAFIEN);
  }, [fraza, produkty]);

  const rozbicie = wybrany ? policzCene(wybrany, narzuty, promocje) : null;
  const pusty = (produkty ?? []).length === 0;

  return (
    <Card className="border-card-border mt-4">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4" />
          <div className="text-sm font-medium">Symulator ceny</div>
        </div>

        {wybrany === null ? (
          <div className="space-y-2">
            <Label htmlFor="simulator-search">Wyszukaj produkt</Label>
            <Input
              id="simulator-search"
              value={fraza}
              onChange={(e) => ustawFraze(e.target.value)}
              placeholder={
                pusty
                  ? "— najpierw zaimportuj produkty —"
                  : "Wpisz rozmiar, markę, model lub fragment nazwy…"
              }
              data-testid="input-simulator-search"
            />

            {fraza.trim() ? (
              <div className="border border-border rounded-md divide-y divide-border max-h-64 overflow-y-auto">
                {trafienia.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-muted-foreground">
                    Brak wyników dla „{fraza.trim()}”
                  </div>
                ) : (
                  trafienia.map((p) => (
                    <button
                      key={String(p.kod)}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50"
                      onClick={() => ustawWybrany(p)}
                      data-testid={`simulator-result-${p.id}`}
                    >
                      <span className="font-mono">{p.rozmiar || "—"}</span>{" "}
                      <span className="text-muted-foreground">{p.marka || "—"}</span>{" "}
                      <span className="text-muted-foreground">{String(p.model ?? "") || "—"}</span>
                    </button>
                  ))
                )}
                {trafienia.length === LIMIT_TRAFIEN ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    Pokazane pierwsze {LIMIT_TRAFIEN} — zawęź wyszukiwanie
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm">
              <span className="font-mono">{wybrany.rozmiar || "—"}</span>{" "}
              <span className="text-muted-foreground">{wybrany.marka || "—"}</span>{" "}
              <span className="text-muted-foreground">{String(wybrany.model ?? "") || "—"}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => ustawWybrany(null)}
              data-testid="button-simulator-clear"
            >
              Zmień
            </Button>
          </div>
        )}

        {wybrany && rozbicie ? (
          <div className="space-y-2 max-w-2xl" data-testid="symulator-rozbicie">
            <Wiersz
              label="Cena zakupu (baza)"
              detail={String(wybrany.kod)}
              wartosc={rozbicie.zakup}
            />
            <Wiersz
              label={
                rozbicie.wybranyNarzut
                  ? `Narzut (${
                      rozbicie.wybranyNarzut.nazwa ??
                      opiszWarunki(odczytajWarunki(rozbicie.wybranyNarzut.warunki))
                    })`
                  : "Narzut brak — używana cena bazowa"
              }
              detail={rozbicie.narzutPct > 0 ? `+${rozbicie.narzutPct}%` : undefined}
              wartosc={rozbicie.poNarzucie}
              delta={rozbicie.poNarzucie - rozbicie.zakup}
            />
            <Wiersz
              label={
                rozbicie.wybranaPromocja
                  ? `Promocja (${rozbicie.wybranaPromocja.nazwa})`
                  : "Promocja brak"
              }
              detail={rozbicie.rabatPct > 0 ? `−${rozbicie.rabatPct}%` : undefined}
              wartosc={rozbicie.poRabacie}
              delta={rozbicie.poRabacie - rozbicie.poNarzucie}
            />
            <Wiersz
              label="VAT"
              detail={`+${rozbicie.vatPct}%`}
              wartosc={rozbicie.poRabacie * (1 + rozbicie.vatPct / 100)}
              delta={rozbicie.poRabacie * (rozbicie.vatPct / 100)}
              highlight
            />
            {/*
              WIERSZ PONAD ORYGINAŁ (plan.md D8). `UT()` kończy się na kwocie z VAT-em, ale to
              NIE jest liczba, która ląduje w katalogu: backend zaokrągla ją W DÓŁ
              (`floor`, `repos/ceny.ts`). Symulator, którego ostatnia linia różni się od
              katalogu o grosze, tłumaczyłby cenę, której tam nie ma — a to jest dokładnie ten
              problem, dla którego powstało D8.
            */}
            <Wiersz
              label="Cena sprzedaży w katalogu"
              detail="zaokrąglona w dół"
              wartosc={rozbicie.cenaSprzedazy}
              testid="symulator-cena"
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
