/**
 * Multi-select w rozwijanym menu — wspólny kształt filtrów „Marka" i „Kategoria"
 * z oryginału (`deminified/frontend-index.js:23490-23577`).
 *
 * Oba filtry mają w bundlu identyczną strukturę skopiowaną dwa razy: etykieta, separator,
 * para skrótów „Wszystkie"/„Żadna", separator i lista pozycji z checkboxem. Składamy to
 * w jeden komponent (DRY), zachowując klasy i teksty 1:1. Konfigurator kolumn ma inny
 * zestaw skrótów i własny opis, więc ma osobny komponent.
 */
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function WyborWielokrotny({
  etykieta,
  opcje,
  wybrane,
  onZmiana,
  tekstPusty,
  formatujLicznik,
  szerokoscPrzycisku,
  testId,
}: {
  etykieta: string;
  opcje: string[];
  wybrane: Set<string>;
  onZmiana: (nowe: Set<string>) => void;
  /** Napis, gdy nic nie wybrano (np. „Wszystkie marki"). */
  tekstPusty: string;
  /** Napis przy 2+ zaznaczeniach (np. `(n) => \`${n} marek\``). */
  formatujLicznik: (ile: number) => string;
  szerokoscPrzycisku: string;
  testId: string;
}) {
  const podsumowanie =
    wybrane.size === 0
      ? tekstPusty
      : wybrane.size === 1
        ? (Array.from(wybrane)[0] ?? tekstPusty)
        : formatujLicznik(wybrane.size);

  const przelacz = (wartosc: string): void => {
    const nowe = new Set(wybrane);
    if (nowe.has(wartosc)) nowe.delete(wartosc);
    else nowe.add(wartosc);
    onZmiana(nowe);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          data-testid={testId}
          className={`${szerokoscPrzycisku} justify-between font-mono text-xs`}
        >
          {podsumowanie}
          <span className="ml-2 opacity-50">▾</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 max-h-[60vh] overflow-y-auto">
        <DropdownMenuLabel className="text-xs">{etykieta}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="flex gap-1 px-2 py-1">
          <Button
            size="sm"
            variant="ghost"
            className="text-[10px] h-7"
            onClick={() => onZmiana(new Set(opcje))}
          >
            Wszystkie
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
        {opcje.map((opcja) => (
          <DropdownMenuCheckboxItem
            key={opcja}
            checked={wybrane.has(opcja)}
            onCheckedChange={() => przelacz(opcja)}
            // Bez tego menu zamyka się po pierwszym kliknięciu — a to filtr wielokrotny.
            onSelect={(zdarzenie) => zdarzenie.preventDefault()}
            className="text-xs font-mono"
          >
            {opcja}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
