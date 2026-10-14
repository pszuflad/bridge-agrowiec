// Narzuty startowe partnerów B2B (ticket 258) — krok wdrożenia `2026-10-13-partnerzy-narzuty-startowe`.
//
// Źródło: odczyt starego panelu narzutów partnerów (v2.agroopony.eu, „narzut STD [%]”) z 2026-10-13 — wartości domyślne i wszystkie reguły marek
// dla Adtyres i Fuhrmann (= TyreWorld, spółka B. Fuhrmann). Wartości wchodzą jako DOPŁATA w p.p. do marży sklepu produktu (decyzja: wariant B, ticket 255).
// Zasada jak w `dane-partnerow.ts`: UZUPEŁNIA tylko to, czego nie ma — niczego nie nadpisuje.
//   • Narzut domyślny: stary panel miał 5 % dla KAŻDEGO z 7 dostawców i każdego kraju (u obu partnerów), więc w nowym modelu to jedna wartość na kraj
//     (`partner_kraje.narzut_proc`) — ustawiana tylko tam, gdzie wynosi 0 (kraj nieskonfigurowany). Kraje, których partner nie ma, nie są zakładane
//     (TyreWorld ma 6 krajów w pliku, stary panel miał 13 — pozostałe 7 wymaga decyzji o kolumnach cen w pliku).
//   • Reguły marek: 7 wpisów (Niemcy, kategoria Rolnicze). Dostawca w regule to KOD (`products.dostawca`, np. MO2), a stary panel podawał nazwę —
//     kod wyszukujemy w tabeli `suppliers` po nazwie. Gdy którejś nazwy nie da się jednoznacznie przypisać, krok jest odkładany PRZED zapisem czegokolwiek.

import { and, eq } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { partnerKraje, partnerNarzuty, partnerzy, suppliers } from "../db/schema.js";
import { dodajRegule } from "../repos/partnerzy-narzuty.js";

export const NARZUT_DOMYSLNY_PROC = 5;
/** Kraje ze starego panelu (13) — dla każdego z nich narzut domyślny był 5 %. */
export const KRAJE_STAREGO_PANELU = ["FR", "DE", "NL", "BE", "AT", "CZ", "SK", "LT", "LV", "RO", "HU", "IT", "LU"] as const;

type RegulaMarki = { kraj: string; dostawca: string; kategoria: string; marka: string; wartosc: number };

const ALLIANCE_CEAT: RegulaMarki[] = [
  { kraj: "DE", dostawca: "JMK", kategoria: "Rolnicze", marka: "ALLIANCE", wartosc: 2 },
  { kraj: "DE", dostawca: "Bohnenkamp", kategoria: "Rolnicze", marka: "ALLIANCE", wartosc: 2 },
  { kraj: "DE", dostawca: "Bohnenkamp", kategoria: "Rolnicze", marka: "CEAT", wartosc: 2 },
];

/** Reguły marek wg partnera (nazwa w Bridge). Adtyres: 3 reguły; Fuhrmann/TyreWorld: te same + Vredestein z Handlopex Rzeszów (3 %). */
export const REGULY_MAREK: Record<string, RegulaMarki[]> = {
  adtyres: ALLIANCE_CEAT,
  tyreworld: [...ALLIANCE_CEAT, { kraj: "DE", dostawca: "Handlopex Rzeszów", kategoria: "Rolnicze", marka: "VREDESTEIN", wartosc: 3 }],
};

const nazwaReguly = (r: RegulaMarki): string => `${r.kraj} ${r.dostawca} ${r.kategoria} ${r.marka}`;

/** Kod dostawcy dla nazwy ze starego panelu: nazwa równa albo zaczynająca się od niej („Grasdorf (kolarolnicze.pl)”); `null` przy braku lub niejednoznaczności. */
function kodDostawcy(wszyscy: { kod: string; nazwa: string }[], nazwa: string): string | null {
  const n = nazwa.trim().toLowerCase();
  const rowne = wszyscy.filter((s) => s.nazwa.trim().toLowerCase() === n);
  const trafienia = rowne.length ? rowne : wszyscy.filter((s) => s.nazwa.trim().toLowerCase().startsWith(`${n} `) || s.nazwa.trim().toLowerCase().startsWith(`${n}(`));
  return trafienia.length === 1 ? trafienia[0]!.kod : null;
}

export function ustawNarzutyStartowe(db: Baza): string | { odloz: string } {
  const wszyscy = db.select({ kod: suppliers.kod, nazwa: suppliers.nazwa }).from(suppliers).all();
  const partnerzyDocelowi = db.select().from(partnerzy).all().filter((p) => p.nazwa.toLowerCase() in REGULY_MAREK);
  if (partnerzyDocelowi.length === 0) return "brak partnerów TyreWorld/Adtyres — nic do uzupełnienia";

  // Najpierw rozwiązujemy wszystkie nazwy dostawców — brak któregoś = odłożenie bez zapisu (kroku nie da się zrobić „w połowie”).
  const nierozpoznani = new Set<string>();
  for (const p of partnerzyDocelowi) for (const r of REGULY_MAREK[p.nazwa.toLowerCase()]!) if (kodDostawcy(wszyscy, r.dostawca) === null) nierozpoznani.add(r.dostawca);
  if (nierozpoznani.size) return { odloz: `nie rozpoznano jednoznacznie dostawców w tabeli dostawców: ${[...nierozpoznani].join(", ")}` };

  const opisy: string[] = [];
  for (const p of partnerzyDocelowi) {
    let kraje = 0;
    for (const kraj of KRAJE_STAREGO_PANELU) {
      kraje += db
        .update(partnerKraje)
        .set({ narzutProc: NARZUT_DOMYSLNY_PROC })
        .where(and(eq(partnerKraje.partnerId, p.id), eq(partnerKraje.kraj, kraj), eq(partnerKraje.narzutProc, 0)))
        .run().changes;
    }
    const istniejace = db.select().from(partnerNarzuty).where(eq(partnerNarzuty.partnerId, p.id)).all();
    let reguly = 0;
    for (const r of REGULY_MAREK[p.nazwa.toLowerCase()]!) {
      const kod = kodDostawcy(wszyscy, r.dostawca)!;
      const warunki = [
        { typ: "dostawca", wartosc: kod },
        { typ: "kategoria", wartosc: r.kategoria },
        { typ: "marka", wartosc: r.marka },
      ];
      // Ta sama reguła (kraj + komplet warunków) już jest — także ręczna, o innej nazwie lub wartości: nie dublujemy i nie nadpisujemy.
      const klucz = JSON.stringify(warunki);
      if (istniejace.some((x) => x.kraj === r.kraj && JSON.stringify(JSON.parse(x.warunki) as unknown) === klucz)) continue;
      dodajRegule(db, p.id, { nazwa: nazwaReguly(r), wartosc: r.wartosc, kraj: r.kraj, priorytet: 50, status: "aktywny", warunki });
      reguly += 1;
    }
    opisy.push(`${p.nazwa}: narzut ${NARZUT_DOMYSLNY_PROC} % ustawiony w krajach: ${kraje}, dodanych reguł marek: ${reguly}`);
  }
  return opisy.join("; ");
}
