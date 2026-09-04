/**
 * Zakładka „Dziennik" w `/konfiguracja` — SUROWY audyt z `GET /api/audit-log`.
 *
 * ⚠ TO NIE JEST `/historia`. Tamten widok (Iteracja 5) pokazuje tylko PIĘĆ rozpoznawanych
 * akcji (`upload_pliku`, `import_cennika`, `eksport_csv`, `eksport_shoper`, `edycja_produktu`)
 * i mapuje je na własny kształt. Tutaj idzie wszystko, co zapisał audyt — łącznie z akcjami,
 * których tamten widok nigdy nie pokaże: `synchronizacja_reczna`, `edycja_konfiguracji`
 * i `edycja_spedycji` (I11), `zmiana_hasla`, `edit_supplier_config`, `czyszczenie_katalogu`,
 * `maintenance_usun_nieopony` (ta sesja). To był powód przeniesienia tej trasy do I12.
 *
 * ⚠ Widok MUSI znieść dwa kształty, które w bazie realnie występują: `szczegoly_json = NULL`
 * i `encja_id` niezłączalny z `suppliers`. Nie łączymy się z niczym, a parsowanie idzie przez
 * `parsujSzczegoly` (`try/catch` → `{}`), więc oba przechodzą bez wyjątku — pilnują tego
 * testy w `test/konfiguracja.dziennik.test.tsx` i `dziennik.parser.test.ts`.
 *
 * ⚠ Ta zakładka nie istnieje w oryginale (plan.md D3, świadome odstępstwo).
 */
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { pobierzAudyt } from "./admin";
import {
  BRAK_WARTOSCI,
  FILTRY_POCZATKOWE,
  filtrujWpisy,
  streszczSzczegoly,
  wartosciFiltrow,
  type FiltryDziennika,
} from "./dziennik";

const WSZYSTKIE = "all";

/** ISO 8601 → czytelna data; wartość nieparsowalna zostaje jak jest. */
function sformatujDate(iso: string): string {
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? iso : data.toLocaleString("pl-PL");
}

export function Dziennik() {
  const [filtry, ustawFiltry] = useState<FiltryDziennika>(FILTRY_POCZATKOWE);
  const audyt = useQuery({ queryKey: ["/api/audit-log"], queryFn: pobierzAudyt });

  const wpisy = useMemo(() => audyt.data ?? [], [audyt.data]);
  const dostepne = useMemo(() => wartosciFiltrow(wpisy), [wpisy]);
  const widoczne = useMemo(() => filtrujWpisy(wpisy, filtry), [wpisy, filtry]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2.5 p-4">
          <Select
            value={filtry.akcja}
            onValueChange={(akcja) => ustawFiltry((p) => ({ ...p, akcja }))}
          >
            <SelectTrigger className="w-56" data-testid="select-dziennik-akcja" aria-label="Akcja">
              <SelectValue placeholder="Akcja" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={WSZYSTKIE}>Wszystkie akcje</SelectItem>
              {dostepne.akcje.map((akcja) => (
                <SelectItem key={akcja} value={akcja}>
                  {akcja}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filtry.encjaTyp}
            onValueChange={(encjaTyp) => ustawFiltry((p) => ({ ...p, encjaTyp }))}
          >
            <SelectTrigger className="w-44" data-testid="select-dziennik-encja" aria-label="Encja">
              <SelectValue placeholder="Encja" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={WSZYSTKIE}>Wszystkie encje</SelectItem>
              {dostepne.encje.map((encja) => (
                <SelectItem key={encja} value={encja}>
                  {encja}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            className="w-64"
            placeholder="Szukaj w akcji, encji, szczegółach…"
            value={filtry.szukaj}
            onChange={(e) => ustawFiltry((p) => ({ ...p, szukaj: e.target.value }))}
            data-testid="input-dziennik-szukaj"
            aria-label="Szukaj"
          />

          <span className="text-xs text-muted-foreground ml-auto" data-testid="dziennik-licznik">
            {widoczne.length} z {wpisy.length}
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          {audyt.isLoading ? (
            <p className="text-sm text-muted-foreground" data-testid="dziennik-ladowanie">
              Wczytywanie…
            </p>
          ) : audyt.isError ? (
            <p className="text-sm text-destructive" data-testid="dziennik-blad">
              Nie udało się wczytać dziennika.
            </p>
          ) : widoczne.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="dziennik-pusty">
              Brak wpisów spełniających filtry.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="py-2 pr-3">Data</th>
                    <th className="py-2 pr-3">Użytkownik</th>
                    <th className="py-2 pr-3">Akcja</th>
                    <th className="py-2 pr-3">Encja</th>
                    <th className="py-2">Szczegóły</th>
                  </tr>
                </thead>
                <tbody>
                  {widoczne.map((wpis) => (
                    <tr
                      key={wpis.id}
                      className="border-b last:border-0 align-top"
                      data-testid={`row-audyt-${wpis.id}`}
                    >
                      <td className="py-2 pr-3 whitespace-nowrap text-xs">
                        {sformatujDate(wpis.kiedy)}
                      </td>
                      <td className="py-2 pr-3">{wpis.uzytkownikImie ?? "—"}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{wpis.akcja}</td>
                      <td className="py-2 pr-3 text-xs">
                        {wpis.encjaTyp ?? BRAK_WARTOSCI}
                        {wpis.encjaId ? (
                          <span className="text-muted-foreground"> / {wpis.encjaId}</span>
                        ) : null}
                      </td>
                      {/*
                        `streszczSzczegoly` przechodzi przez `parsujSzczegoly`, więc NULL
                        i zepsuty JSON dają pusty string, a nie wyjątek — komórka zostaje pusta.
                      */}
                      <td
                        className="py-2 text-xs text-muted-foreground break-all"
                        data-testid={`szczegoly-audyt-${wpis.id}`}
                      >
                        {streszczSzczegoly(wpis.szczegolyJson)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
