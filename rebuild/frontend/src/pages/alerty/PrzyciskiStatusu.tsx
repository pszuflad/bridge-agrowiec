/**
 * Przyciski zmiany statusu alertu — wspólne dla list na `/alerty` (patrz `statusy.ts`).
 *
 * Komponent niczego nie zapisuje: podaje tylko docelowy status. Jak zapis przebiega (tu:
 * N PATCH-y po osiem naraz), decyduje lista, która go używa.
 */
import { Button, type ButtonProps } from "@/components/ui/button";
import { akcjeStatusu, type StatusAlertu } from "./statusy";

export function PrzyciskiStatusu({
  status,
  liczba,
  zablokowane,
  onZmien,
  testId,
  wariant = "outline",
}: {
  status: string;
  /** Ilu alertów dotyczy kliknięcie. Przy więcej niż jednym trafia do etykiety: „Rozwiąż (5)". */
  liczba: number;
  zablokowane: boolean;
  onZmien: (cel: StatusAlertu) => void;
  /** Sufiks `data-testid` — przycisk dostaje `button-status-<cel>-<testId>`. */
  testId: string;
  wariant?: ButtonProps["variant"];
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {akcjeStatusu(status).map(({ cel, etykieta }) => (
        <Button
          key={cel}
          size="sm"
          variant={wariant}
          disabled={zablokowane}
          data-testid={`button-status-${cel}-${testId}`}
          onClick={() => onZmien(cel)}
        >
          {liczba > 1 ? `${etykieta} (${liczba})` : etykieta}
        </Button>
      ))}
    </div>
  );
}
