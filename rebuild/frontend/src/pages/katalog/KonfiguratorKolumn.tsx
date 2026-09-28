/**
 * Konfigurator widocznych kolumn — 1:1 z oryginałem
 * (`deminified/frontend-index.js:23321-23383`).
 *
 * Wybór zapisuje się w IndexedDB pod kluczem `konfig-domyslne-kolumny` (`lib/magazynKV`),
 * więc przeżywa odświeżenie strony, ale jest lokalny dla przeglądarki — tak samo jak
 * w produkcji.
 *
 * Opis w menu wspomina eksport CSV, bo tak brzmi w oryginale. Sam eksport należy do
 * późniejszej iteracji (wymaga `GET /api/config`) — tekst zostaje, żeby nie rozjechać
 * się z tym, co Ania zna.
 */
import { Columns3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { KOLUMNY, KOLUMNY_DOMYSLNE } from "./kolumny";

export function KonfiguratorKolumn({
  wybrane,
  onZmiana,
}: {
  wybrane: Set<string>;
  onZmiana: (nowe: Set<string>) => void;
}) {
  const przelacz = (klucz: string): void => {
    const nowe = new Set(wybrane);
    if (nowe.has(klucz)) nowe.delete(klucz);
    else nowe.add(klucz);
    onZmiana(nowe);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" data-testid="button-columns">
          <Columns3 className="w-4 h-4 mr-2" />
          Kolumny
          <Badge variant="secondary" className="ml-2 h-5 font-mono text-[10px]">
            {wybrane.size}/{KOLUMNY.length}
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 max-h-[70vh] overflow-y-auto">
        <DropdownMenuLabel className="text-xs">
          Widoczne kolumny w tabeli i eksporcie CSV
        </DropdownMenuLabel>
        <div className="px-2 py-1.5 text-[11px] text-muted-foreground leading-snug">
          Te same kolumny pojawią się w tabeli i w pliku CSV. Pusta lista → eksport
          w formacie Shopera.
        </div>
        <DropdownMenuSeparator />
        <div className="flex gap-1 px-2 py-1">
          <Button
            size="sm"
            variant="ghost"
            className="text-[10px] h-7"
            onClick={() => onZmiana(new Set(KOLUMNY.map((k) => k.key)))}
          >
            Wszystkie
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-[10px] h-7"
            onClick={() => onZmiana(new Set(KOLUMNY_DOMYSLNE))}
          >
            Domyślne
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-[10px] h-7"
            onClick={() => onZmiana(new Set())}
          >
            Żadna
          </Button>
        </div>
        <DropdownMenuSeparator />
        {KOLUMNY.map((kolumna) => (
          <DropdownMenuCheckboxItem
            key={kolumna.key}
            checked={wybrane.has(kolumna.key)}
            onCheckedChange={() => przelacz(kolumna.key)}
            onSelect={(zdarzenie) => zdarzenie.preventDefault()}
            className="text-xs font-mono"
          >
            {kolumna.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
