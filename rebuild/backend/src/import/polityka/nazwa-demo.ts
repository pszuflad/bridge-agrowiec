// Nazwa opony z kodem dostawcy „demo" kończy się słowem „DEMO".
//
// ⭐ ŚWIADOME ODSTĘPSTWO OD PRODUKCJI (decyzja Anny, 2026-09-30). Produkcja dopisuje „demo"
// do nazwy tylko wtedy, gdy słowo jest w samej nazwie z cennika (`dopisek` w `tyre_params.cjs`).
// Cenniki, w których „demo" jest wyłącznie w kodzie dostawcy (np. `M036506034TRdemo`),
// dawały nazwę bez oznaczenia. Kod legacy zostaje nietknięty (test integralności portu),
// dlatego korekta idzie tu — za adapterem, w `parsujPlik()`.

import type { RekordSurowy } from "../typy.js";

const KOD_Z_DEMO = /demo/i;
const SLOWO_DEMO = /\bDEMO\b/gi;

/** Nazwa z „DEMO" na końcu (jednym), gdy kod dostawcy zawiera „demo"; inaczej bez zmian. */
export function nazwaZDemo(nazwa: string | null, kodDostawcy: string | null): string | null {
  if (!nazwa || !kodDostawcy || !KOD_Z_DEMO.test(kodDostawcy)) return nazwa;
  const bezDemo = nazwa.replace(SLOWO_DEMO, "").replace(/\s+/g, " ").trim();
  return bezDemo ? `${bezDemo} DEMO` : "DEMO";
}

export function zastosujDemoWNazwie(rekordy: RekordSurowy[]): RekordSurowy[] {
  return rekordy.map((r) => {
    const nazwa = nazwaZDemo(r.nazwa, r.kodDostawcy);
    return nazwa === r.nazwa ? r : { ...r, nazwa };
  });
}
