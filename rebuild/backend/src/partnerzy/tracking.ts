// Tracking zamówień partnerów (ticket 256): użytkownik wpisuje w panelu numer listu przewozowego, a Bridge od razu tworzy plik trackingu CSV i zapisuje go w katalogu partnera.
//
// FORMAT PLIKU to założenie użytkowniczki (brak wzoru od partnerów, 2026-10-13) — jedna linia na pozycję przesyłki, nagłówek w pierwszej linii, separator `;`, UTF-8:
//   order_id;platform_order_id;supplier_item_id;ean;carrier;tracking_number;tracking_type;quantity_shipped;shipped_at
//   order_id = nasz numer zamówienia (numer z Selly, a przed utworzeniem w Selly `ZAM-<id>`), platform_order_id = numer zamówienia partnera, supplier_item_id = kod pozycji z zamówienia,
//   ean = EAN dopasowanego produktu, carrier/tracking_number = z panelu, tracking_type = `delivery`, quantity_shipped = sztuki w tej przesyłce,
//   shipped_at = ISO 8601 z przesunięciem strefy Europe/Warsaw.
// Katalog docelowy partnera: `PARTNERZY_KATALOGI_TRACKINGU` (`Nazwa=/ścieżka;…`, tylko w `.env` produkcji — jak publikacja cenników); bez wpisu plik zostaje do pobrania w panelu.

import { renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { and, asc, eq } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { partnerWysylki, partnerZamowienia, partnerZamowieniaPozycje, partnerzy, products } from "../db/schema.js";
import { znajdzPozycjeKatalogu } from "./walidacja-zamowienia.js";

export const NAGLOWEK_TRACKINGU = ["order_id", "platform_order_id", "supplier_item_id", "ean", "carrier", "tracking_number", "tracking_type", "quantity_shipped", "shipped_at"] as const;
/** Statusy zamówienia, dla których wolno dopisywać przesyłki (zamówienie przyjęte; w Selly albo w trakcie wysyłania do Selly). */
export const STATUSY_DO_TRACKINGU: readonly string[] = ["przyjete", "wysylanie", "wyslane"];

export class BladTrackingu extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export type PozycjaPrzesylki = { pozycjaId: number; ilosc: number };

/** Czas w strefie Europe/Warsaw w formacie z przesunięciem, np. `2026-10-13T13:30:00+02:00`. */
export function czasPolski(d: Date): string {
  const czesci = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Warsaw", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const lokalnyJakoUtc = Date.UTC(Number(czesci.year), Number(czesci.month) - 1, Number(czesci.day), Number(czesci.hour), Number(czesci.minute), Number(czesci.second));
  const przesuniecieMin = Math.round((lokalnyJakoUtc - Math.floor(d.getTime() / 1000) * 1000) / 60_000);
  const znak = przesuniecieMin < 0 ? "-" : "+";
  const abs = Math.abs(przesuniecieMin);
  return `${czesci.year}-${czesci.month}-${czesci.day}T${czesci.hour}:${czesci.minute}:${czesci.second}${znak}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

/** Komórka CSV (separator `;`): cudzysłów tylko gdy trzeba. */
export const komorkaCsv = (v: string | number): string => {
  const t = String(v);
  return /[;"\r\n]/.test(t) ? `"${t.replaceAll('"', '""')}"` : t;
};

const bezpiecznaNazwa = (t: string): string => t.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "x";

function odczytajPozycje(tekst: string): PozycjaPrzesylki[] {
  try {
    const v = JSON.parse(tekst) as unknown;
    return Array.isArray(v) ? (v as PozycjaPrzesylki[]) : [];
  } catch {
    return [];
  }
}

/** Ile sztuk każdej pozycji zamówienia już wysłano w zapisanych przesyłkach (opcjonalnie z pominięciem jednej). */
export function wyslanePozycje(db: Baza, zamowienieId: number, pomin?: number): Map<number, number> {
  const m = new Map<number, number>();
  for (const w of db.select().from(partnerWysylki).where(eq(partnerWysylki.zamowienieId, zamowienieId)).all()) {
    if (w.id === pomin) continue;
    for (const p of odczytajPozycje(w.pozycje)) m.set(p.pozycjaId, (m.get(p.pozycjaId) ?? 0) + p.ilosc);
  }
  return m;
}

/** Treść i nazwa pliku trackingu jednej przesyłki. */
export function zbudujPlikTrackingu(db: Baza, wysylkaId: number): { nazwa: string; tresc: string } {
  const w = db.select().from(partnerWysylki).where(eq(partnerWysylki.id, wysylkaId)).get();
  if (!w) throw new BladTrackingu(404, "Nie ma takiej przesyłki.");
  const z = db.select().from(partnerZamowienia).where(eq(partnerZamowienia.id, w.zamowienieId)).get();
  if (!z) throw new BladTrackingu(404, "Nie ma takiego zamówienia.");
  const pozycje = db.select().from(partnerZamowieniaPozycje).where(eq(partnerZamowieniaPozycje.zamowienieId, z.id)).orderBy(asc(partnerZamowieniaPozycje.lp)).all();
  const orderId = z.numerWlasny?.trim() || `ZAM-${z.id}`;
  const linie: string[] = [NAGLOWEK_TRACKINGU.join(";")];
  for (const p of odczytajPozycje(w.pozycje)) {
    const poz = pozycje.find((x) => x.id === p.pozycjaId);
    if (!poz) continue;
    const znaleziona = znajdzPozycjeKatalogu(db, poz.kod);
    const ean = znaleziona ? (db.select({ ean: products.ean }).from(products).where(eq(products.kod, znaleziona.kod)).get()?.ean ?? "") : "";
    linie.push([orderId, z.numerPartnera, poz.kod, ean ?? "", w.przewoznik, w.numerPrzesylki, w.typ, p.ilosc, w.wyslano].map(komorkaCsv).join(";"));
  }
  const data = w.wyslano.slice(0, 19).replace(/[-:T]/g, "").replace(/^(\d{8})(\d{6})$/, "$1-$2");
  return { nazwa: `tracking_${bezpiecznaNazwa(z.numerPartnera)}_${data}_${w.id}.csv`, tresc: `${linie.join("\n")}\n` };
}

/** Typy trackingu jak w portalu partnera: `delivery` (dostawa do klienta) i `pickup` (zgłoszenie odbioru). */
export const TYPY_TRACKINGU = ["delivery", "pickup"] as const;

export type DaneNowejPrzesylki = { przewoznik: unknown; numerPrzesylki: unknown; typ?: unknown; wyslano?: unknown; pozycje?: unknown };

const tekst = (v: unknown, nazwa: string, maks = 60): string => {
  if (typeof v !== "string" || v.trim() === "" || v.trim().length > maks) throw new BladTrackingu(400, `Pole „${nazwa}” musi być niepustym tekstem (do ${maks} znaków).`);
  return v.trim();
};

/** Zapisuje przesyłkę zamówienia (walidacja, sumy sztuk ≤ zamówione, brak duplikatu numeru) — BEZ zapisu pliku; plik: `zapiszPlikTrackingu`. */
export function dodajPrzesylke(db: Baza, partnerId: number, zamowienieId: number, dane: DaneNowejPrzesylki, teraz: Date = new Date()): number {
  const z = db.select().from(partnerZamowienia).where(and(eq(partnerZamowienia.id, zamowienieId), eq(partnerZamowienia.partnerId, partnerId))).get();
  if (!z) throw new BladTrackingu(404, "Nie ma takiego zamówienia tego partnera.");
  if (!STATUSY_DO_TRACKINGU.includes(z.status)) throw new BladTrackingu(409, `Zamówienie ma status „${z.status}” — numer listu można dodać dopiero do zamówienia przyjętego.`);
  const przewoznik = tekst(dane.przewoznik, "przewoznik");
  const numer = tekst(dane.numerPrzesylki, "numerPrzesylki");
  const typ = dane.typ === undefined || dane.typ === null || dane.typ === "" ? "delivery" : dane.typ;
  if (typeof typ !== "string" || !(TYPY_TRACKINGU as readonly string[]).includes(typ)) throw new BladTrackingu(400, `Pole „typ” musi być jednym z: ${TYPY_TRACKINGU.join(", ")}.`);
  let wyslano = czasPolski(teraz);
  if (dane.wyslano !== undefined && dane.wyslano !== null && dane.wyslano !== "") {
    const t = typeof dane.wyslano === "string" ? Date.parse(dane.wyslano) : NaN;
    if (Number.isNaN(t)) throw new BladTrackingu(400, "Pole „wyslano” musi być datą i godziną (ISO 8601).");
    wyslano = czasPolski(new Date(t));
  }
  const pozycje = db.select().from(partnerZamowieniaPozycje).where(eq(partnerZamowieniaPozycje.zamowienieId, zamowienieId)).orderBy(asc(partnerZamowieniaPozycje.lp)).all();
  const juz = wyslanePozycje(db, zamowienieId);
  let wybrane: PozycjaPrzesylki[];
  if (dane.pozycje === undefined || dane.pozycje === null) {
    // Domyślnie: wszystko, co jeszcze nie zostało wysłane.
    wybrane = pozycje.map((p) => ({ pozycjaId: p.id, ilosc: p.ilosc - (juz.get(p.id) ?? 0) })).filter((p) => p.ilosc > 0);
  } else if (Array.isArray(dane.pozycje)) {
    wybrane = (dane.pozycje as { pozycjaId?: unknown; ilosc?: unknown }[]).map((p) => ({ pozycjaId: Number(p?.pozycjaId), ilosc: Number(p?.ilosc) })).filter((p) => p.ilosc !== 0);
  } else throw new BladTrackingu(400, "Pole „pozycje” musi być listą {pozycjaId, ilosc}.");
  if (wybrane.length === 0) throw new BladTrackingu(400, "Przesyłka musi zawierać przynajmniej jedną pozycję (wszystko z zamówienia jest już wysłane).");
  const widziane = new Set<number>();
  for (const p of wybrane) {
    const poz = pozycje.find((x) => x.id === p.pozycjaId);
    if (!poz || !Number.isInteger(p.ilosc) || p.ilosc < 1 || widziane.has(p.pozycjaId)) throw new BladTrackingu(400, "Niepoprawna lista pozycji przesyłki (nieznana pozycja, powtórzenie albo ilość nie jest liczbą całkowitą ≥ 1).");
    widziane.add(p.pozycjaId);
    if ((juz.get(p.pozycjaId) ?? 0) + p.ilosc > poz.ilosc) throw new BladTrackingu(409, `Pozycja ${poz.lp} (${poz.kod}): zamówiono ${poz.ilosc}, wysłano już ${juz.get(p.pozycjaId) ?? 0}, a w tej przesyłce ${p.ilosc}.`);
  }
  if (db.select({ id: partnerWysylki.id }).from(partnerWysylki).where(and(eq(partnerWysylki.zamowienieId, zamowienieId), eq(partnerWysylki.numerPrzesylki, numer))).get())
    throw new BladTrackingu(409, `Przesyłka o numerze ${numer} jest już zapisana przy tym zamówieniu.`);
  return Number(
    db
      .insert(partnerWysylki)
      .values({ zamowienieId, przewoznik, numerPrzesylki: numer, typ, wyslano, pozycje: JSON.stringify(wybrane), utworzono: teraz.toISOString() })
      .run().lastInsertRowid,
  );
}

/** Zapisuje plik trackingu w katalogu partnera (plik tymczasowy + rename) i ustawia status pliku przesyłki. Zwraca status. Nigdy nie rzuca. */
export function zapiszPlikTrackingu(db: Baza, wysylkaId: number, katalog: string | undefined): "zapisany" | "brak_katalogu" | "blad" {
  const { nazwa, tresc } = zbudujPlikTrackingu(db, wysylkaId);
  const ustaw = (status: "zapisany" | "brak_katalogu" | "blad", blad: string | null) => {
    db.update(partnerWysylki).set({ plikNazwa: nazwa, plikStatus: status, plikBlad: blad }).where(eq(partnerWysylki.id, wysylkaId)).run();
    return status;
  };
  if (!katalog) return ustaw("brak_katalogu", null);
  const plik = join(katalog, nazwa);
  const tymczasowy = `${plik}.tmp-${process.pid}`;
  try {
    if (!statSync(katalog).isDirectory()) throw new Error("to nie katalog");
    writeFileSync(tymczasowy, tresc, "utf8");
    renameSync(tymczasowy, plik);
    return ustaw("zapisany", null);
  } catch (e) {
    return ustaw("blad", `Zapis pliku trackingu do ${katalog} nie powiódł się: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    rmSync(tymczasowy, { force: true });
  }
}

/** Katalog trackingu partnera z mapy `PARTNERZY_KATALOGI_TRACKINGU` (nazwa partnera bez rozróżniania wielkości liter). */
export function katalogTrackinguPartnera(db: Baza, partnerId: number, katalogi: ReadonlyMap<string, string>): string | undefined {
  const nazwa = db.select({ nazwa: partnerzy.nazwa }).from(partnerzy).where(eq(partnerzy.id, partnerId)).get()?.nazwa ?? "";
  return katalogi.get(nazwa.toLowerCase());
}

export function listaPrzesylek(db: Baza, partnerId: number, zamowienieId: number) {
  const z = db.select({ id: partnerZamowienia.id }).from(partnerZamowienia).where(and(eq(partnerZamowienia.id, zamowienieId), eq(partnerZamowienia.partnerId, partnerId))).get();
  if (!z) return null;
  return db.select().from(partnerWysylki).where(eq(partnerWysylki.zamowienieId, zamowienieId)).orderBy(asc(partnerWysylki.id)).all().map((w) => ({ ...w, pozycje: odczytajPozycje(w.pozycje) }));
}
