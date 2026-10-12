// Walidacja zamówienia partnera względem katalogu (karta PARTNERZY, ticket 232 / PRT-7.4a).
//
// Sprawdza TYLKO to, co da się rozstrzygnąć z katalogu: czy kod z zamówienia (`CODE`) wskazuje istniejącą, aktywną pozycję i czy jest jej dość na stanie.
// Wynik: status `przyjete` albo `blad_importu` z opisem (zbiorczym i per pozycja). Zamówienie ZAWSZE zostaje zapisane — nic nie ginie przed wysyłką do sklepu —
// i NIE wychodzi żadne powiadomienie do partnera (decyzja z karty). Kontrola ceny/tolerancji czeka na decyzję o wartości tolerancji (karta, „Otwarte” pkt 2).
//
// `CODE` to kod pozycji katalogu (`products.kod`, UNIKALNY) albo numer katalogowy partnera `<EAN>-<dostawca>` (decyzja z 2026-10-12) — rozstrzyga `znajdzPozycjeKatalogu`.

import { and, eq, sql } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { partnerZamowienia, partnerZamowieniaPozycje, products } from "../db/schema.js";

export const STATUS_NOWE = "nowe";
export const STATUS_PRZYJETE = "przyjete";
export const STATUS_BLAD_IMPORTU = "blad_importu";
/** Statusy, w których wolno (ponownie) walidować; późniejsze (np. wysłane do sklepu, 7.5) są nietykalne. */
const STATUSY_DO_WALIDACJI: readonly string[] = [STATUS_NOWE, STATUS_PRZYJETE, STATUS_BLAD_IMPORTU];

/** Czy zamówienie w tym statusie podlega (ponownej) walidacji — jedyne źródło prawdy dla backendu i panelu (pole `mozeWalidowac`). */
export const czyPodlegaWalidacji = (status: string): boolean => STATUSY_DO_WALIDACJI.includes(status);

export type PozycjaKatalogu = { kod: string; stan: number; status: string };

/** Baza albo transakcja Drizzle — oba mają `select`; sama transakcja nie jest typem `Baza`. */
type Czytnik = Pick<Baza, "select">;

/**
 * Jedyne miejsce, które mapuje `CODE` z zamówienia na pozycję katalogu. Najpierw dokładne `products.kod`; potem numer katalogowy partnera
 * `<EAN>-<numer dostawcy>` (dzielony na OSTATNIM `-`; dostawca bez rozróżniania wielkości liter). Gdy ten sam EAN+dostawca ma kilka pozycji
 * (np. kilka magazynów), wybieramy aktywną z największym stanem, żeby nie odrzucić zamówienia, które da się zrealizować.
 */
export function znajdzPozycjeKatalogu(db: Czytnik, kod: string): PozycjaKatalogu | null {
  const k = kod.trim();
  const pola = { kod: products.kod, stan: products.stan, status: products.status };
  const wprost = db.select(pola).from(products).where(eq(products.kod, k)).get();
  if (wprost) return wprost;
  const i = k.lastIndexOf("-");
  if (i <= 0 || i === k.length - 1) return null;
  // Porównanie po tej samej normalizacji co `numerPartnera()` (bez białych znaków); `upper()` w SQLite jest ASCII-only — numery dostawców to ASCII.
  const kandydaci = db
    .select(pola)
    .from(products)
    .where(
      and(
        sql`replace(replace(${products.ean}, ' ', ''), char(9), '') = ${k.slice(0, i).replace(/\s+/g, "")}`,
        sql`upper(replace(${products.dostawca}, ' ', '')) = ${k.slice(i + 1).replace(/\s+/g, "").toUpperCase()}`,
      ),
    )
    .all();
  if (kandydaci.length === 0) return null;
  return [...kandydaci].sort((a, b) => Number(b.status === "aktywny") - Number(a.status === "aktywny") || b.stan - a.stan || a.kod.localeCompare(b.kod))[0]!;
}

export type WynikWalidacji = { status: string; bledy: number; zmieniony: boolean };

/** Powód błędu pozycji albo `null`, gdy jest w porządku. `ilosc` to łączna zamówiona ilość tego kodu w całym zamówieniu. */
export function powodBleduPozycji(pozycja: PozycjaKatalogu | null, ilosc: number): string | null {
  if (!pozycja) return "nieznany kod";
  if (pozycja.status !== "aktywny") return `produkt nieaktywny (status: ${pozycja.status})`;
  if (pozycja.stan < ilosc) return `brak stanu (jest ${pozycja.stan}, zamówiono ${ilosc})`;
  return null;
}

/**
 * Waliduje zamówienie i zapisuje wynik. Idempotentne (można ponawiać po poprawie katalogu). Zamówienia w późniejszych statusach zostają nietknięte.
 * Stan sprawdzamy dla ŁĄCZNEJ ilości danego kodu w zamówieniu (dwie linie tego samego kodu nie mogą razem przekroczyć stanu).
 * `zachowajPrzyjete` (odbiór automatyczny): zamówienie już `przyjete` zostaje bez zmian — zmiana stanu w katalogu po odbiorze nie degraduje go samoczynnie;
 * ponowne sprawdzenie na prośbę człowieka (domyślnie) może je zdegradować, bo jest świadomą akcją. Zwraca `null`, gdy zamówienia nie ma.
 */
export function zwaliduj(db: Baza, zamowienieId: number, opcje: { zachowajPrzyjete?: boolean } = {}): WynikWalidacji | null {
  return db.transaction((tx) => {
    const z = tx.select({ id: partnerZamowienia.id, status: partnerZamowienia.status }).from(partnerZamowienia).where(eq(partnerZamowienia.id, zamowienieId)).get();
    if (!z) return null;
    if (!czyPodlegaWalidacji(z.status) || (opcje.zachowajPrzyjete && z.status === STATUS_PRZYJETE)) return { status: z.status, bledy: 0, zmieniony: false };

    const pozycje = tx.select().from(partnerZamowieniaPozycje).where(eq(partnerZamowieniaPozycje.zamowienieId, zamowienieId)).all();
    const lacznie = new Map<string, number>();
    for (const p of pozycje) lacznie.set(p.kod.trim(), (lacznie.get(p.kod.trim()) ?? 0) + p.ilosc);
    const opisy: string[] = [];
    for (const p of pozycje) {
      const powod = powodBleduPozycji(znajdzPozycjeKatalogu(tx, p.kod), lacznie.get(p.kod.trim()) ?? p.ilosc);
      if (powod !== p.blad) tx.update(partnerZamowieniaPozycje).set({ blad: powod }).where(eq(partnerZamowieniaPozycje.id, p.id)).run();
      if (powod) opisy.push(`poz. ${p.lp} (${p.kod}): ${powod}`);
    }
    const status = opisy.length > 0 ? STATUS_BLAD_IMPORTU : STATUS_PRZYJETE;
    const bladImportu = opisy.length > 0 ? opisy.join("; ") : null;
    const zmieniony = z.status !== status;
    tx.update(partnerZamowienia).set({ status, bladImportu }).where(eq(partnerZamowienia.id, zamowienieId)).run();
    return { status, bledy: opisy.length, zmieniony };
  }, { behavior: "immediate" });
}
