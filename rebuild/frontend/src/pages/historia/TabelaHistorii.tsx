/**
 * Tabela historii — sześć kolumn z oryginału (`deminified/frontend-index.js:25460-25560`).
 *
 * Bez wirtualizacji i bez zaznaczania: widok jest stronicowany po stronie serwera
 * (domyślnie 25 wierszy) i wyłącznie do odczytu.
 */
import { Download, FileUp, Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { MAKS_WIDOCZNYCH_POL, sformatujDate, type WpisHistorii } from "./dane";

/** Wygląd odznaki typu — kolory i ikony 1:1 z `QT()` (`fe.js:25350-25373`). */
const WYGLAD_TYPU: Record<
  string,
  { etykieta: string; klasa: string; Ikona: typeof FileUp }
> = {
  import: {
    etykieta: "import",
    klasa: "gap-1 border-blue-200 text-[10px] text-blue-700",
    Ikona: FileUp,
  },
  eksport: {
    etykieta: "eksport",
    klasa: "gap-1 border-green-200 text-[10px] text-green-700",
    Ikona: Download,
  },
  edycja: {
    etykieta: "edycja",
    klasa: "gap-1 border-amber-200 text-[10px] text-amber-700",
    Ikona: Pencil,
  },
};

/**
 * Odznaka typu wpisu.
 *
 * ⚠ Oryginał ma tu `if import … else if eksport … else edycja`, więc KAŻDY nieznany typ
 * pokazywałby się jako „edycja". Backend dziś oddaje wyłącznie te trzy (mapowanie odsiewa
 * resztę), ale gdyby doszedł czwarty, cicha etykieta „edycja" byłaby kłamstwem — pokazujemy
 * go więc dosłownie, tak jak `OdznakaTypu` w stagingu.
 */
export function OdznakaTypu({ typ }: { typ: string }) {
  const wyglad = WYGLAD_TYPU[typ];
  if (!wyglad) return <Badge variant="outline">{typ}</Badge>;
  const { etykieta, klasa, Ikona } = wyglad;
  return (
    <Badge variant="outline" className={klasa}>
      <Ikona className="h-3 w-3" aria-hidden />
      {etykieta}
    </Badge>
  );
}

/**
 * Kolumna „Szczegóły" — treść zależy od typu wpisu (`:25523-25558`).
 *
 * ⚠ ODPORNOŚĆ NA NULL. `nazwaPliku`, `format`, `kodProduktu` i `uwagi` bywają puste,
 * a przy akcjach, których audyt nie opisał (`szczegoly_json = NULL`), puste jest wszystko.
 * Żadna gałąź nie może zakładać obiektu ani niepustej listy.
 */
function Szczegoly({ wpis }: { wpis: WpisHistorii }) {
  if (wpis.typ === "import") {
    return (
      <span className="text-muted-foreground">
        Plik: <span className="font-mono">{wpis.nazwaPliku ?? "—"}</span>
        {wpis.uwagi ? <span className="ml-2 text-amber-600">({wpis.uwagi})</span> : null}
      </span>
    );
  }

  if (wpis.typ === "eksport") {
    return (
      <span className="text-muted-foreground">
        Format: <span className="font-mono">{wpis.format ?? "—"}</span>
        {wpis.uwagi ? <span className="ml-2">{wpis.uwagi}</span> : null}
      </span>
    );
  }

  if (wpis.typ === "edycja") {
    const widoczne = wpis.zmienionePola.slice(0, MAKS_WIDOCZNYCH_POL);
    const ukryte = wpis.zmienionePola.length - widoczne.length;
    return (
      <div>
        <span className="font-mono font-medium">{wpis.kodProduktu ?? "—"}</span>
        {widoczne.length > 0 ? (
          <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
            {widoczne.map((pole) => (
              <li key={pole} className="font-mono">
                {pole}
              </li>
            ))}
            {ukryte > 0 ? <li className="italic">… i {ukryte} więcej</li> : null}
          </ul>
        ) : null}
      </div>
    );
  }

  return <span className="text-muted-foreground">—</span>;
}

export type WlasciwosciTabeli = {
  wpisy: WpisHistorii[];
  ladowanie: boolean;
};

export function TabelaHistorii({ wpisy, ladowanie }: WlasciwosciTabeli) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">Data</th>
            <th className="px-4 py-2.5 font-medium">Typ</th>
            <th className="px-4 py-2.5 font-medium">Dostawca</th>
            <th className="px-4 py-2.5 font-medium">Użytkownik</th>
            <th className="px-4 py-2.5 font-medium">Pozycji</th>
            <th className="px-4 py-2.5 font-medium">Szczegóły</th>
          </tr>
        </thead>
        <tbody>
          {/*
            Stan ładowania jest ODSTĘPSTWEM (plan.md D5): oryginał domyśla `data = {}`
            i podczas pobierania pokazuje „Brak wpisów w historii.", czyli komunikat
            nieprawdziwy. Reszta rebuildu (Staging) rozróżnia te dwa stany i my też.
          */}
          {ladowanie ? (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                Wczytywanie historii…
              </td>
            </tr>
          ) : null}

          {!ladowanie && wpisy.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                Brak wpisów w historii.
              </td>
            </tr>
          ) : null}

          {!ladowanie &&
            wpisy.map((wpis) => (
              <tr
                key={wpis.id}
                className="border-t border-border hover:bg-muted/30"
                data-testid={`row-history-${wpis.id}`}
              >
                <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-muted-foreground">
                  {sformatujDate(wpis.kiedy)}
                </td>
                <td className="px-4 py-2">
                  <OdznakaTypu typ={wpis.typ} />
                </td>
                {/*
                  `dostawca` to `encja_id` z audytu, BEZ złączenia z tabelą dostawców —
                  audyt zapisuje zamiar przed operacją, więc bywa tu kod, którego w
                  `suppliers` nie ma. Pokazujemy go dosłownie.
                */}
                <td className="px-4 py-2 font-mono text-xs">{wpis.dostawca ?? "—"}</td>
                <td className="px-4 py-2 text-xs">
                  {wpis.uzytkownik ?? <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-2 font-mono text-xs tabular-nums">
                  {wpis.liczbaPozycji ?? "—"}
                </td>
                <td className="px-4 py-2 text-xs">
                  <Szczegoly wpis={wpis} />
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
