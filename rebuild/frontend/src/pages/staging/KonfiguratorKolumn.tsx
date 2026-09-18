/**
 * Przycisk „Kolumny" i jego popover — wchłonięty enhancer kolumn stagingu
 * (`deminified/frontend-index.js:29176-29335`).
 *
 * Wygląd bierzemy z komponentów odbudowy (`ui/dropdown-menu`), a nie z inline'owego CSS-u
 * oryginału — tak samo, jak 3f-2 wchłonęło `freq-injection.js`: nośnik się zmienia, UKŁAD,
 * TEKSTY i SEMANTYKA zostają 1:1. Oryginał budował `<div>` ręcznie tylko dlatego, że działał
 * z ZEWNĄTRZ Reacta i nie miał do czego się podpiąć.
 *
 * ⚠ GDZIE TEN PRZYCISK STOI — czytaj z kodu, nie z nazwy. Oryginał wstrzykuje go przed
 * `button[data-testid="button-accept-all"]` (`fe.js:29317-29331`), ale w oryginale ten
 * `data-testid` wisi na „Akceptuj widoczne" w PASKU, a nie na „Akceptuj wszystkie"
 * w nagłówku — testidy są tam semantycznie zamienione względem odbudowy. Przycisk ląduje
 * więc w pasku, przed „Akceptuj widoczne", i tak go tu stawiamy (ustalenie F1 przy 14b).
 *
 * Wariant `ghost`/`sm` też nie jest wyborem estetycznym: oryginał robi dosłownie
 * `btn.className = acceptBtn.className` (`fe.js:29325`), czyli dziedziczy wygląd
 * sąsiedniego „Akceptuj widoczne".
 */
import { Columns3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { KOLUMNY_STAGINGU, type WidocznoscKolumn } from "./kolumny";

export function KonfiguratorKolumn({
  widoczne,
  onZmiana,
}: {
  widoczne: WidocznoscKolumn;
  onZmiana: (nowe: WidocznoscKolumn) => void;
}) {
  const przelacz = (klucz: string): void =>
    onZmiana({ ...widoczne, [klucz]: !widoczne[klucz] });

  /*
    Trzy skróty mają w oryginale RÓŻNY zasięg i to nie jest niedoróbka (`fe.js:29196-29212`):
      • „Wszystkie" i „Żadna" ruszają WYŁĄCZNIE kolumny tabeli (`if (!c.extra)`),
      • „Domyślne" resetuje WSZYSTKO, z sekcją „Dodatkowe" włącznie.
    Odtwarzamy dokładnie ten podział.
  */
  const wszystkie = (): void => {
    const nowe = { ...widoczne };
    for (const k of KOLUMNY_STAGINGU) if (!k.dodatkowa) nowe[k.klucz] = true;
    onZmiana(nowe);
  };

  const domyslne = (): void => {
    const nowe = { ...widoczne };
    for (const k of KOLUMNY_STAGINGU) nowe[k.klucz] = !!(k.zablokowana || k.domyslna);
    onZmiana(nowe);
  };

  const zadna = (): void => {
    const nowe = { ...widoczne };
    for (const k of KOLUMNY_STAGINGU) if (!k.dodatkowa) nowe[k.klucz] = !!k.zablokowana;
    onZmiana(nowe);
  };

  // Kolumny `locked` (`checkbox`, `akcje`) nie mają w oryginale przełącznika — popover po
  // prostu je pomija (`if (c.locked || c.extra) return`, `fe.js:29218`).
  const wTabeli = KOLUMNY_STAGINGU.filter((k) => !k.zablokowana && !k.dodatkowa);
  const dodatkowe = KOLUMNY_STAGINGU.filter((k) => k.dodatkowa);

  return (
    /*
      `modal={false}` nie jest ustępstwem na rzecz testów — to wierność. Popover oryginału
      był zwykłym `<div>` doklejonym do `body` (`fe.js:29176`); nie blokował strony, nie
      chował jej przed czytnikiem ekranu i zamykał się kliknięciem na zewnątrz
      (`fe.js:29294-29301`). Domyślny, modalny tryb Radiksa oznaczałby `aria-hidden` na całej
      reszcie widoku i zablokowany scroll tabeli — czyli zachowanie, którego enhancer nie miał.
    */
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" data-testid="button-staging-columns">
          <Columns3 className="mr-1.5 h-3.5 w-3.5" />
          Kolumny
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-[70vh] w-[260px] overflow-y-auto"
        data-testid="popover-staging-columns"
      >
        <DropdownMenuLabel className="text-[11px] text-muted-foreground">
          Widoczne kolumny (staging)
        </DropdownMenuLabel>
        <div className="flex gap-1 px-2 py-1">
          <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={wszystkie}>
            Wszystkie
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={domyslne}>
            Domyślne
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={zadna}>
            Żadna
          </Button>
        </div>
        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
          W tabeli stagingu
        </DropdownMenuLabel>
        {wTabeli.map((kolumna) => (
          <DropdownMenuCheckboxItem
            key={kolumna.klucz}
            checked={!!widoczne[kolumna.klucz]}
            onCheckedChange={() => przelacz(kolumna.klucz)}
            onSelect={(zdarzenie) => zdarzenie.preventDefault()}
            className="text-xs"
            data-testid={`kolumna-staging-${kolumna.klucz}`}
          >
            {kolumna.etykieta}
          </DropdownMenuCheckboxItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Dodatkowe (z katalogu)
        </DropdownMenuLabel>
        {/*
          Zdanie oryginału, przepisane dosłownie (`fe.js:29249`). Mówi użytkownikowi wprost,
          że te przełączniki niczego nie pokazują — i tak ma zostać (decyzja D3 przy 14b).
        */}
        <div className="px-2 py-1.5 text-[10px] leading-snug text-muted-foreground">
          Te kolumny nie są jeszcze wyświetlane w tabeli stagingu.
        </div>
        {dodatkowe.map((kolumna) => (
          <DropdownMenuCheckboxItem
            key={kolumna.klucz}
            checked={!!widoczne[kolumna.klucz]}
            onCheckedChange={() => przelacz(kolumna.klucz)}
            onSelect={(zdarzenie) => zdarzenie.preventDefault()}
            className="text-xs opacity-75"
            data-testid={`kolumna-staging-${kolumna.klucz}`}
          >
            {kolumna.etykieta}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
