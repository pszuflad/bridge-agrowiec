/**
 * Dialog edycji produktu — port `LT()` (`deminified/frontend-index.js:23909-24121`).
 *
 * ZASTĘPUJE `PodgladProduktu.tsx`, czyli modal READ-ONLY wniesiony w Iteracji 2 jako
 * świadome odstępstwo **D4**. Oryginał nie ma podglądu produktu w żadnej postaci — jedynym
 * oknem ze szczegółami jest ten formularz. Po tej sesji odstępstwo D4 znika.
 *
 * Trzy rzeczy, które wyglądają na drobiazgi, a są istotą portu:
 *  - stan trzyma WYŁĄCZNIE pola dotknięte przez użytkownika (`useState({})`), więc `PATCH`
 *    wysyła różnicę, a nie cały produkt. Trasa zapisuje `manual_overrides` dla KAŻDEGO
 *    klucza w ciele, więc wysłanie niezmienionej wartości zamroziłoby ją przed importem;
 *  - `useEffect` czyści ten stan przy zmianie `produkt.id` (port `FT`, `:24123`) — bez tego
 *    edycja jednego produktu przeciekłaby do następnego otwartego dialogu;
 *  - przycisk „override" przy polu to nie dekoracja, tylko `DELETE /api/overrides/{id}`.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { pobierzSlownik, type OdpowiedzSlownika } from "@/pages/atrybuty/api";

import { pobierzOverrides, usunOverride, type Override } from "./api";
import type { Produkt } from "./filtrowanie";
import {
  flagaNaOpcje,
  opcjaNaFlage,
  opcjeSlownika,
  parsujLiczbe,
  POLA_EDYCJI,
  PUSTA_OPCJA,
  type Kontrolka,
  type PoleEdycji,
} from "./poleEdycji";

/** Tekst 1:1 z `:23951` — bez polskich znaków, tak jak w oryginale. */
const TYTUL_OVERRIDE =
  "Recznie zmienione - import nie nadpisze. Kliknij, zeby zdjac override.";

/** Wiąże `<Label htmlFor>` z kontrolką — oryginał etykiet nie wiązał wcale. */
function idPola(klucz: string): string {
  return `pole-${klucz}`;
}

export function DialogEdycjiProduktu({
  produkt,
  onZamknij,
  onZapisz,
  zapisywanie = false,
}: {
  produkt: Produkt | null;
  onZamknij: () => void;
  /** Dostaje SAME zmienione pola. Toast i invalidacje robi `Katalog.tsx`. */
  onZapisz: (produkt: Produkt, zmiany: Record<string, unknown>) => void;
  zapisywanie?: boolean;
}) {
  const klient = useQueryClient();
  const [zmiany, ustawZmiany] = useState<Record<string, unknown>>({});

  /**
   * Ten sam klucz i ten sam `queryFn`, co w `Katalog.tsx`, `/atrybuty` i dialogu reguł
   * (domknięcie 7c). Dzięki temu otwarcie dialogu NIE dokłada zapytania sieciowego —
   * słownik jest już w cache widoku.
   */
  const { data: slownik } = useQuery<OdpowiedzSlownika>({
    queryKey: ["/api/atrybuty"],
    queryFn: pobierzSlownik,
  });
  const wartosciSlownika = useMemo(() => slownik?.wartosci ?? [], [slownik]);

  const kluczOverride = ["/api/overrides", produkt?.dostawca, produkt?.kod];
  const { data: overrides = [] } = useQuery<Override[]>({
    queryKey: kluczOverride,
    enabled: produkt !== null,
    queryFn: () => pobierzOverrides(produkt?.dostawca ?? "", produkt?.kod ?? ""),
  });

  /** `fieldName` → override. Klucze fixture'u są camelCase, patrz `api.ts`. */
  const overridePola = useMemo(() => {
    const mapa: Record<string, Override> = {};
    for (const override of overrides ?? []) mapa[override.fieldName] = override;
    return mapa;
  }, [overrides]);

  // Port `FT` (`:24123-24127`): reset przy zmianie produktu, nie przy każdym renderze.
  const idProduktu = produkt?.id;
  useEffect(() => {
    ustawZmiany({});
  }, [idProduktu]);

  if (!produkt) return null;

  function zmien(klucz: string, wartosc: unknown) {
    ustawZmiany((poprzednie) => ({ ...poprzednie, [klucz]: wartosc }));
  }

  /** Port `d` (`:23965`): stan edycji wygrywa z wartością produktu, `null`/`undefined` → "". */
  function wartosc(klucz: string): string {
    const biezaca = klucz in zmiany ? zmiany[klucz] : produkt?.[klucz];
    return biezaca === null || biezaca === undefined ? "" : String(biezaca);
  }

  function surowa(klucz: string): unknown {
    return klucz in zmiany ? zmiany[klucz] : produkt?.[klucz];
  }

  async function zdejmijOverride(klucz: string) {
    const override = overridePola[klucz];
    if (!override) return;
    await usunOverride(override.id);
    await klient.invalidateQueries({ queryKey: kluczOverride });
  }

  /** Port `u` (`:23943-23964`) — etykieta pola plus przycisk zdejmowania override'u. */
  function etykietaPola(etykieta: string, kluczOverridePola: string, id: string) {
    return (
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-xs">
          {etykieta}
        </Label>
        {overridePola[kluczOverridePola] && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-5 px-1 text-[10px] text-amber-700 hover:text-amber-800"
            title={TYTUL_OVERRIDE}
            onClick={() => void zdejmijOverride(kluczOverridePola)}
            data-testid={`button-override-${kluczOverridePola}`}
          >
            override
          </Button>
        )}
      </div>
    );
  }

  // `htmlFor` nie zwiąże etykiety z przyciskiem Radiksa (button nie jest elementem
  // etykietowalnym), więc select dostaje `aria-label` — nazwa dostępna jest ta sama.
  function selectWartosci(klucz: string, opcje: readonly string[], etykieta: string) {
    return (
      <Select
        value={wartosc(klucz) || PUSTA_OPCJA}
        onValueChange={(wybrana) => zmien(klucz, wybrana === PUSTA_OPCJA ? null : wybrana)}
      >
        <SelectTrigger id={idPola(klucz)} aria-label={etykieta}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {/* „-" jako PUSTA_OPCJA to brak wartości; „-" na liście `konstrukcja` to realna
              wartość i ma własną pozycję niżej. Oryginał ma tu tę samą dwuznaczność. */}
          <SelectItem value={PUSTA_OPCJA}>-</SelectItem>
          {opcje.map((opcja) => (
            <SelectItem key={opcja} value={opcja}>
              {opcja}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  function poleTekstowe(
    klucz: string,
    opcje: {
      mono?: boolean | undefined;
      disabled?: boolean | undefined;
      typ?: string | undefined;
      step?: string | undefined;
      calkowita?: boolean | undefined;
    },
  ) {
    const liczbowe = opcje.typ === "number";
    return (
      <Input
        id={idPola(klucz)}
        type={opcje.typ}
        step={opcje.step}
        value={wartosc(klucz)}
        disabled={opcje.disabled}
        className={opcje.mono ? "font-mono" : ""}
        onChange={(zdarzenie) =>
          liczbowe
            ? zmien(klucz, parsujLiczbe(zdarzenie.target.value, opcje.calkowita))
            : zmien(klucz, zdarzenie.target.value)
        }
      />
    );
  }

  function renderujKontrolke(pole: PoleEdycji, kontrolka: Kontrolka) {
    switch (kontrolka.typ) {
      case "tekst":
        return poleTekstowe(pole.klucz, {
          mono: kontrolka.mono,
          disabled: kontrolka.disabled,
        });
      case "liczba":
        return poleTekstowe(pole.klucz, {
          typ: "number",
          step: kontrolka.step,
          calkowita: kontrolka.calkowita,
        });
      case "select":
        return selectWartosci(pole.klucz, kontrolka.opcje, pole.etykieta);
      case "selectSlownik":
        return selectWartosci(
          pole.klucz,
          opcjeSlownika(wartosciSlownika, kontrolka.rodzajSlownika),
          pole.etykieta,
        );
      case "selectAlboTekst": {
        // Select tylko gdy słownik ma czym go wypełnić — inaczej Ania nie mogłaby wpisać
        // wartości, której jeszcze nie ma w słowniku (`:24065`).
        const opcje = opcjeSlownika(wartosciSlownika, kontrolka.rodzajSlownika);
        return opcje.length > 0
          ? selectWartosci(pole.klucz, opcje, pole.etykieta)
          : poleTekstowe(pole.klucz, {});
      }
      case "flaga":
        return (
          <Select
            value={flagaNaOpcje(surowa(pole.klucz))}
            onValueChange={(wybrana) => zmien(pole.klucz, opcjaNaFlage(wybrana))}
          >
            <SelectTrigger id={idPola(pole.klucz)} aria-label={pole.etykieta}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={PUSTA_OPCJA}>-</SelectItem>
              <SelectItem value="true">Tak</SelectItem>
              <SelectItem value="false">Nie</SelectItem>
            </SelectContent>
          </Select>
        );
      case "scalone": {
        const [pierwszy, drugi] = kontrolka.klucze;
        return (
          <Input
            id={idPola(pierwszy)}
            value={wartosc(pierwszy) || wartosc(drugi)}
            onChange={(zdarzenie) => {
              // Oba klucze naraz — oryginał trzyma je zsynchronizowane (`:24022-24028`).
              zmien(pierwszy, zdarzenie.target.value);
              zmien(drugi, zdarzenie.target.value);
            }}
          />
        );
      }
    }
  }

  function renderujPole(pole: PoleEdycji) {
    // Etykieta override'u pola scalonego czyta `model`, a gdy tam override'u nie ma —
    // `bieznik` (`:24022`). Import poprawia zwykle jedno z dwóch.
    const kluczOverridePola =
      pole.kontrolka.typ === "scalone"
        ? overridePola[pole.kontrolka.klucze[0]]
          ? pole.kontrolka.klucze[0]
          : pole.kontrolka.klucze[1]
        : pole.klucz;
    const rozciagniete = pole.kontrolka.typ === "tekst" && pole.kontrolka.span;

    return (
      <div key={pole.klucz} className={rozciagniete ? "md:col-span-2" : ""}>
        {etykietaPola(pole.etykieta, kluczOverridePola, idPola(pole.klucz))}
        {renderujKontrolke(pole, pole.kontrolka)}
      </div>
    );
  }

  return (
    <Dialog open onOpenChange={(otwarty) => !otwarty && onZamknij()}>
      <DialogContent
        className="max-w-3xl max-h-[85vh] overflow-y-auto"
        data-testid="dialog-edycja-produktu"
      >
        <DialogHeader>
          <DialogTitle>
            Edycja produktu{" "}
            <span className="font-mono text-sm text-muted-foreground">
              {/* `||`, nie `??` — 1:1 z `:24037`: pusty `kodDostawcy` ma ustąpić `kod`owi. */}
              ({String(produkt.kodDostawcy || produkt.kod)})
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          {POLA_EDYCJI.filter((pole) => pole.sekcja === "naglowek").map(renderujPole)}

          <div className="md:col-span-2 pt-2 border-t">
            <div className="text-xs text-muted-foreground mb-2 font-medium">
              Parametry techniczne
            </div>
          </div>

          {POLA_EDYCJI.filter((pole) => pole.sekcja === "techniczne").map(renderujPole)}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onZamknij}>
            Anuluj
          </Button>
          <Button
            onClick={() => onZapisz(produkt, zmiany)}
            disabled={zapisywanie}
            data-testid="button-save-edit"
          >
            Zapisz zmiany
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
