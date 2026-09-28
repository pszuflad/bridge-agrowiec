/**
 * Kafel KPI Pulpitu — port `Si()` (`deminified/frontend-index.js:16794-16836`).
 *
 * ⚠ TO NIE JEST `Kafel` Z `pages/analityka/NaglowekKpi.tsx` i nie da się ich scalić.
 * Tamten ma etykietę i wartość; ten dokłada trzy rzeczy, których tamten nie zna i mieć
 * nie powinien: IKONĘ w prawym górnym rogu, LINK (cała karta jest klikalna) i TREND
 * — zielony ze strzałką w górę, czerwony w dół, szary bez strzałki. Nagłówek analityki
 * jest zresztą sam w sobie odstępstwem (O-10a-1) i ma inne cztery liczby.
 *
 * FORMA (skill `dataviz`, „Stat tile"): etykieta wersalikami bez dwukropka, wartość większa
 * i wyróżniona, kolor niesie kierunek zmiany — nigdy tożsamość serii.
 */
import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Link } from "wouter";

import { Card, CardContent } from "@/components/ui/card";

/** Kierunek zmiany — `none` znaczy „bez strzałki i bez koloru", nie „zero". */
export type KierunekZmiany = "up" | "down" | "none";

export type Zmiana = { kierunek: KierunekZmiany; text: string };

const KLASA_TRENDU: Record<KierunekZmiany, string> = {
  up: "text-emerald-600 dark:text-emerald-400",
  down: "text-red-600 dark:text-red-400",
  none: "text-muted-foreground",
};

export function KafelKpi({
  ikona: Ikona,
  label,
  wartosc,
  zmiana,
  testId,
  href,
}: {
  ikona: LucideIcon;
  label: string;
  wartosc: string | number;
  zmiana?: Zmiana;
  testId: string;
  href?: string;
}) {
  const karta = (
    <Card
      className={`border-card-border ${
        href ? "cursor-pointer transition-colors hover:border-primary/50 hover:bg-accent/30" : ""
      }`}
      data-testid={testId}
    >
      <CardContent className="p-5">
        <div className="mb-3 flex items-start justify-between">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <Ikona className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="font-mono text-2xl font-semibold tabular-nums" data-testid={`${testId}-value`}>
          {wartosc}
        </div>
        {zmiana && (
          <div className={`mt-2 flex items-center gap-1 font-mono text-xs ${KLASA_TRENDU[zmiana.kierunek]}`}>
            {zmiana.kierunek === "up" && <ArrowUp className="h-3 w-3" />}
            {zmiana.kierunek === "down" && <ArrowDown className="h-3 w-3" />}
            {zmiana.text}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return href ? (
    <Link href={href} data-testid={`${testId}-link`}>
      {karta}
    </Link>
  ) : (
    karta
  );
}
