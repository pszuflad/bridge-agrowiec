// Podgląd zamówienia partnera przed utworzeniem go w Selly (ticket 248) — TYLKO ODCZYT, nic nie wysyła do sklepu.
// Pokazuje, co poszłoby do Selly: zamawiający (dane do faktury partnera), adres dostawy z zamówienia i pozycje dopasowane do katalogu
// po `CODE` (`products.kod` albo `<EAN>-<dostawca>`). Pozycje bez dopasowania → „do ręcznej weryfikacji”.

import { eq } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { partnerzy, products } from "../db/schema.js";
import { szczegolyZamowieniaDlaPartnera } from "../repos/partnerzy-zamowienia.js";
import { znajdzPozycjeKatalogu } from "./walidacja-zamowienia.js";

export type PozycjaPodgladu = {
  lp: number;
  kodPartnera: string;
  nazwaPartnera: string | null;
  ilosc: number;
  cena: number | null;
  dopasowanie: { kod: string; nazwa: string; ean: string | null; dostawca: string | null; stan: number; status: string } | null;
};

export type PodgladSelly = {
  zamawiajacy: { nazwa: string | null; nip: string | null; ulica: string | null; kod: string | null; miasto: string | null; kraj: string | null };
  dostawa: Record<string, string>;
  waluta: string | null;
  kosztDostawy: number | null;
  pozycje: PozycjaPodgladu[];
  /** Powody, dla których zamówienia nie wolno jeszcze tworzyć w Selly (puste = można). */
  blokady: string[];
};

const BRAKUJE: Array<[keyof PodgladSelly["zamawiajacy"], string]> = [
  ["nazwa", "nazwa"], ["nip", "NIP"], ["ulica", "ulica"], ["kod", "kod pocztowy"], ["miasto", "miasto"], ["kraj", "kraj"],
];

export function podgladDlaSelly(db: Baza, partnerId: number, zamowienieId: number): PodgladSelly | null {
  const z = szczegolyZamowieniaDlaPartnera(db, partnerId, zamowienieId);
  if (!z) return null;
  const p = db.select().from(partnerzy).where(eq(partnerzy.id, partnerId)).get();
  const zamawiajacy = {
    nazwa: p?.fakturaNazwa ?? null, nip: p?.fakturaNip ?? null, ulica: p?.fakturaUlica ?? null,
    kod: p?.fakturaKod ?? null, miasto: p?.fakturaMiasto ?? null, kraj: p?.fakturaKraj ?? null,
  };
  const pozycje: PozycjaPodgladu[] = z.pozycje.map((poz) => {
    const znaleziona = znajdzPozycjeKatalogu(db, poz.kod);
    const produkt = znaleziona ? db.select({ nazwa: products.nazwa, ean: products.ean, dostawca: products.dostawca }).from(products).where(eq(products.kod, znaleziona.kod)).get() : undefined;
    return {
      lp: poz.lp, kodPartnera: poz.kod, nazwaPartnera: poz.nazwa, ilosc: poz.ilosc, cena: poz.cenaSprzedazy,
      dopasowanie: znaleziona
        ? { kod: znaleziona.kod, nazwa: produkt?.nazwa ?? "", ean: produkt?.ean ?? null, dostawca: produkt?.dostawca ?? null, stan: znaleziona.stan, status: znaleziona.status }
        : null,
    };
  });
  const blokady: string[] = [];
  const brak = BRAKUJE.filter(([k]) => !zamawiajacy[k]?.trim()).map(([, e]) => e);
  if (brak.length) blokady.push(`Brak danych do faktury partnera: ${brak.join(", ")} (uzupełnij w ustawieniach partnera).`);
  const nieznane = pozycje.filter((x) => !x.dopasowanie).length;
  if (nieznane) blokady.push(`Pozycje bez dopasowania w katalogu: ${nieznane} — do ręcznej weryfikacji.`);
  if (z.numerWlasny) blokady.push(`Zamówienie ma już numer własny (${z.numerWlasny}).`);
  return { zamawiajacy, dostawa: z.dostawa, waluta: z.waluta, kosztDostawy: z.kosztDostawy, pozycje, blokady };
}
