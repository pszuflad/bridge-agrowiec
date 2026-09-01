/**
 * Tabela pozycji stagingu — jedenaście kolumn z oryginału
 * (`deminified/frontend-index.js:20610-21100`).
 *
 * Bez wirtualizacji, w odróżnieniu od katalogu: staging jest STRONICOWANY po stronie
 * serwera (`/paged`, domyślnie 25 wierszy), więc nie ma czego wirtualizować.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WYGLAD_TYPU, type PozycjaStagingu } from "./dane";

/** Odznaka typu zmiany — etykiety i kolory 1:1 z `XP` (`fe.js:597593`). */
export function OdznakaTypu({ typ }: { typ: string }) {
  const wyglad = WYGLAD_TYPU[typ];
  // Typ spoza mapy pokazujemy DOSŁOWNIE, zamiast go ukrywać — gdyby backend zaczął
  // produkować nowy rodzaj pozycji, ma to być widoczne, a nie zamiecione pod dywan.
  if (!wyglad) return <Badge variant="outline">{typ}</Badge>;
  return <Badge className={wyglad.klasa}>{wyglad.etykieta}</Badge>;
}

/** Liczba w formacie PL albo „—", gdy jej nie ma. */
function liczba(wartosc: number | null, ulamki = 2): string {
  if (wartosc == null) return "—";
  return wartosc.toLocaleString("pl-PL", {
    minimumFractionDigits: ulamki,
    maximumFractionDigits: ulamki,
  });
}

/** Zmiana procentowa ze znakiem i kolorem — rośnie na czerwono, spada na zielono. */
function ZmianaProcentowa({ wartosc }: { wartosc: number | null }) {
  if (wartosc == null) return <span className="text-muted-foreground">—</span>;
  const rosnie = wartosc > 0;
  return (
    <span className={cn("tabular-nums", rosnie ? "text-red-600" : "text-emerald-600")}>
      {rosnie ? "+" : ""}
      {wartosc.toLocaleString("pl-PL", { maximumFractionDigits: 1 })}%
    </span>
  );
}

export type WlasciwosciTabeli = {
  pozycje: PozycjaStagingu[];
  zaznaczone: Set<number>;
  przelaczZaznaczenie: (id: number) => void;
  przelaczWszystkie: () => void;
  otworzSzczegoly: (id: number) => void;
  ladowanie: boolean;
};

export function TabelaStagingu({
  pozycje,
  zaznaczone,
  przelaczZaznaczenie,
  przelaczWszystkie,
  otworzSzczegoly,
  ladowanie,
}: WlasciwosciTabeli) {
  const wszystkieZaznaczone = pozycje.length > 0 && pozycje.every((p) => zaznaczone.has(p.id));

  if (ladowanie) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground" role="status">
        Ładowanie…
      </div>
    );
  }

  if (pozycje.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Brak elementów do wyświetlenia
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50">
          <tr className="text-left">
            <th className="w-10 p-2">
              <input
                type="checkbox"
                aria-label="Zaznacz wszystkie widoczne"
                data-testid="checkbox-select-all"
                checked={wszystkieZaznaczone}
                onChange={przelaczWszystkie}
              />
            </th>
            <th className="p-2 font-medium">Typ</th>
            <th className="p-2 font-medium">Kod</th>
            <th className="p-2 font-medium">Nazwa</th>
            <th className="p-2 font-medium">Dostawca</th>
            <th className="p-2 font-medium text-right">Stan</th>
            <th className="p-2 font-medium text-right">Cena zakupu</th>
            <th className="p-2 font-medium text-right">Cena sprzedaży</th>
            <th className="p-2 font-medium">Magazyn</th>
            <th className="p-2 font-medium text-right">Zmiana</th>
            <th className="p-2 font-medium">Powód / co sprawdzić</th>
            <th className="p-2 font-medium">Akcje</th>
          </tr>
        </thead>
        <tbody>
          {pozycje.map((pozycja) => (
            <tr key={pozycja.id} className="border-b hover:bg-muted/30" data-testid={`row-staging-${pozycja.id}`}>
              <td className="p-2">
                <input
                  type="checkbox"
                  aria-label={`Zaznacz ${pozycja.kod}`}
                  data-testid={`checkbox-staging-${pozycja.id}`}
                  checked={zaznaczone.has(pozycja.id)}
                  onChange={() => przelaczZaznaczenie(pozycja.id)}
                />
              </td>
              <td className="p-2">
                <OdznakaTypu typ={pozycja.typZmiany} />
              </td>
              <td className="p-2 font-mono text-xs">{pozycja.kod}</td>
              <td className="p-2 max-w-xs truncate" title={pozycja.nazwa}>
                {pozycja.nazwa}
              </td>
              <td className="p-2">{pozycja.dostawca}</td>
              <td className="p-2 text-right tabular-nums">
                {/* Stary → nowy, bo to właśnie różnica jest tu informacją. */}
                {pozycja.stanStary != null && pozycja.stanStary !== pozycja.stanNowy ? (
                  <>
                    <span className="text-muted-foreground">{pozycja.stanStary}</span>
                    {" → "}
                  </>
                ) : null}
                {pozycja.stanNowy ?? "—"}
              </td>
              <td className="p-2 text-right tabular-nums">
                {pozycja.cenaZakupuStara != null &&
                pozycja.cenaZakupuStara !== pozycja.cenaZakupuNowa ? (
                  <>
                    <span className="text-muted-foreground">
                      {liczba(pozycja.cenaZakupuStara)}
                    </span>
                    {" → "}
                  </>
                ) : null}
                {liczba(pozycja.cenaZakupuNowa)}
              </td>
              <td className="p-2 text-right tabular-nums">{liczba(pozycja.cenaSprzedazyNowa)}</td>
              <td className="p-2">{pozycja.magazyn ?? "—"}</td>
              <td className="p-2 text-right">
                <ZmianaProcentowa wartosc={pozycja.zmianaPct} />
              </td>
              <td className="p-2 max-w-md">
                {/*
                  `powod` i `ostrzezenie` to komunikaty PISANE DLA CZŁOWIEKA — łącznie
                  z odtworzonym błędem produkcji „zapis naukowy ma tylko null cyfr
                  znaczących" (backlog #11). Ustalenie z 3b: UI ma je POKAZYWAĆ, nie filtrować.
                */}
                <div className="text-xs text-muted-foreground line-clamp-2" title={pozycja.powod ?? ""}>
                  {pozycja.powod ?? "—"}
                </div>
                {pozycja.ostrzezenie ? (
                  <div
                    className="mt-0.5 text-xs text-amber-700 line-clamp-2"
                    title={pozycja.ostrzezenie}
                    data-testid={`ostrzezenie-${pozycja.id}`}
                  >
                    {pozycja.ostrzezenie}
                  </div>
                ) : null}
              </td>
              <td className="p-2">
                <Button
                  variant="outline"
                  size="sm"
                  data-testid={`button-details-${pozycja.id}`}
                  onClick={() => otworzSzczegoly(pozycja.id)}
                >
                  Szczegóły
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
