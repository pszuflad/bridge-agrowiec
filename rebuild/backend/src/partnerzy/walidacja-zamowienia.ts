// Walidacja zamówienia partnera względem katalogu (karta PARTNERZY, ticket 232 / PRT-7.4a).
//
// Sprawdza TYLKO to, co da się rozstrzygnąć z katalogu: czy kod z zamówienia (`CODE`) wskazuje istniejącą, aktywną pozycję i czy jest jej dość na stanie.
// Wynik: status `przyjete` albo `blad_importu` z opisem (zbiorczym i per pozycja). Zamówienie ZAWSZE zostaje zapisane — nic nie ginie przed wysyłką do sklepu —
// i NIE wychodzi żadne powiadomienie do partnera (decyzja z karty). Kontrola ceny/tolerancji czeka na decyzję o wartości tolerancji (karta, „Otwarte” pkt 2).
//
// `CODE` jest dziś kodem pozycji katalogu (`products.kod`, UNIKALNY — jednoznacznie wskazuje też magazyn). Po decyzji o numerze katalogowym `KK PP NNNNN`
// przestawia się wyłącznie `znajdzPozycjeKatalogu`.

import { eq } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { partnerZamowienia, partnerZamowieniaPozycje, products } from "../db/schema.js";

export const STATUS_NOWE = "nowe";
export const STATUS_PRZYJETE = "przyjete";
export const STATUS_BLAD_IMPORTU = "blad_importu";
/** Statusy, w których wolno (ponownie) walidować; późniejsze (np. wysłane do sklepu, 7.5) są nietykalne. */
const STATUSY_DO_WALIDACJI: readonly string[] = [STATUS_NOWE, STATUS_PRZYJETE, STATUS_BLAD_IMPORTU];

export type PozycjaKatalogu = { kod: string; stan: number; status: string };

/** Baza albo transakcja Drizzle — oba mają `select`; sama transakcja nie jest typem `Baza`. */
type Czytnik = Pick<Baza, "select">;

/** Jedyne miejsce, które mapuje `CODE` z zamówienia na pozycję katalogu (później: numer katalogowy). */
export function znajdzPozycjeKatalogu(db: Czytnik, kod: string): PozycjaKatalogu | null {
  return db.select({ kod: products.kod, stan: products.stan, status: products.status }).from(products).where(eq(products.kod, kod.trim())).get() ?? null;
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
    if (!STATUSY_DO_WALIDACJI.includes(z.status) || (opcje.zachowajPrzyjete && z.status === STATUS_PRZYJETE)) return { status: z.status, bledy: 0, zmieniony: false };

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
