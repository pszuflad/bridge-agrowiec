// Odbiór zamówień partnerów z plików XML na serwerze plików (karta PARTNERZY, ticket 239) — drugi kanał obok e-maila (ticket 229).
//
// Partner wrzuca plik zamówienia (np. `2026-103176690.xml`) do `…/customer/orders/` na serwerze FTP — ten sam VPS co Bridge, katalog zapisywalny dla procesu.
// Każdy `*.xml` jest parsowany i zapisywany tą samą ścieżką co zamówienie z e-maila (`zapiszZamowienie` — idempotentnie po numerze partnera),
// waliduje się go względem katalogu (informacyjnie), a potem plik trafia do podkatalogu `done/`. Błędny plik też ląduje w `done/` (z prefiksem `BLAD_`),
// żeby nie wracał co kilka minut — powód jest w `partner_error_log`. Wyjątek infrastruktury (baza) zostawia plik na miejscu do ponowienia.
// Ochrona: tylko zwykłe pliki `*.xml`, rozmiar ≤ MAKS_ROZMIAR_XML (sprawdzany PRZED odczytem), pliki młodsze niż 30 s pomijamy (partner może jeszcze wgrywać).
// Mapowanie partner → katalog `orders` w `PARTNERZY_KATALOGI_ZAMOWIEN` (`Nazwa=/ścieżka;…`); brak wpisu = partner pominięty. Bez powiadomień dla partnera.

import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";

import { and, eq, gt } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { partnerErrorLog, partnerzy } from "../db/schema.js";
import { zapiszZamowienie } from "../repos/partnerzy-zamowienia.js";
import { dekodujXml } from "./dekoduj-xml.js";
import { wyczyscLogi, zapiszBlad, zapiszOperacje } from "./logi.js";
import { STATUS_BLAD_IMPORTU, zwaliduj } from "./walidacja-zamowienia.js";
import { BladZamowienia, MAKS_ROZMIAR_XML } from "./zamowienie-xml.js";

export const OPERACJA_ODBIOR_PLIKOW = "odbior-zamowien-pliki";
/** Plik młodszy niż to (od ostatniej modyfikacji) może być jeszcze wgrywany przez FTP. */
export const MIN_WIEK_PLIKU_MS = 30_000;

export type WynikOdbioruPlikow = { plikow: number; nowe: number; duplikaty: number; bledy: number; pominiete: number };

/** Trwała awaria (nieprzenoszalny plik, brak katalogu) nie może pisać nowego wiersza co przebieg: identyczny błąd z ostatniej doby pomijamy. */
function zapiszBladRaz(db: Baza, partnerId: number, tekst: string, poziom: "blad" | "ostrzezenie", teraz: Date): void {
  const doba = new Date(teraz.getTime() - 86_400_000).toISOString();
  const jest = db
    .select({ id: partnerErrorLog.id })
    .from(partnerErrorLog)
    .where(and(eq(partnerErrorLog.partnerId, partnerId), eq(partnerErrorLog.operacja, OPERACJA_ODBIOR_PLIKOW), eq(partnerErrorLog.komunikat, tekst), gt(partnerErrorLog.kiedy, doba)))
    .get();
  if (!jest) zapiszBlad(db, partnerId, OPERACJA_ODBIOR_PLIKOW, tekst, poziom, teraz);
}

const komunikat = (e: unknown): string => (e instanceof Error ? e.message : String(e));

function przenies(katalog: string, nazwa: string, prefiks: string, teraz: Date): void {
  const done = join(katalog, "done");
  mkdirSync(done, { recursive: true });
  let cel = join(done, `${prefiks}${nazwa}`);
  if (existsSync(cel)) cel = join(done, `${prefiks}${teraz.toISOString().replace(/[-:.]/g, "")}_${nazwa}`);
  renameSync(join(katalog, nazwa), cel);
}

/** Odbiera zamówienia z katalogu `orders` jednego partnera. Żaden pojedynczy plik nie przerywa pętli. */
export function odbierzZamowieniaZPlikow(db: Baza, partnerId: number, katalog: string, teraz: Date = new Date()): WynikOdbioruPlikow {
  const wynik: WynikOdbioruPlikow = { plikow: 0, nowe: 0, duplikaty: 0, bledy: 0, pominiete: 0 };
  let nazwy: string[];
  try {
    nazwy = readdirSync(katalog).filter((n) => /\.xml$/i.test(n)).sort();
  } catch (e) {
    zapiszBladRaz(db, partnerId, `Katalog zamówień ${katalog} niedostępny: ${komunikat(e)}`, "blad", teraz);
    wynik.bledy++;
    return wynik;
  }
  for (const nazwa of nazwy) {
    const sciezka = join(katalog, nazwa);
    try {
      const st = lstatSync(sciezka); // lstat: symlink nie jest zwykłym plikiem — nie czytamy cudzych plików przez dowiązanie
      if (!st.isFile()) continue;
      if (teraz.getTime() - st.mtimeMs < MIN_WIEK_PLIKU_MS) {
        wynik.pominiete++;
        continue;
      }
      wynik.plikow++;
      if (st.size > MAKS_ROZMIAR_XML) {
        wynik.bledy++;
        zapiszBlad(db, partnerId, OPERACJA_ODBIOR_PLIKOW, `${nazwa}: plik za duży (${st.size} B, limit ${MAKS_ROZMIAR_XML}).`, "blad", teraz);
        przenies(katalog, nazwa, "BLAD_", teraz);
        continue;
      }
      try {
        const z = zapiszZamowienie(db, partnerId, dekodujXml(readFileSync(sciezka)), teraz);
        const walid = zwaliduj(db, z.id, { zachowajPrzyjete: true });
        if (walid?.status === STATUS_BLAD_IMPORTU && walid.zmieniony) {
          zapiszBlad(db, partnerId, OPERACJA_ODBIOR_PLIKOW, `${nazwa}: zamówienie przyjęte ze statusem „błąd importu” (${walid.bledy} poz.) — szczegóły w panelu zamówień.`, "ostrzezenie", teraz);
        }
        if (z.nowe) wynik.nowe++;
        else {
          wynik.duplikaty++;
          if (z.zmieniony) zapiszBlad(db, partnerId, OPERACJA_ODBIOR_PLIKOW, `${nazwa}: zamówienie o tym numerze już jest, ale z inną treścią — zapisanego nie nadpisano.`, "ostrzezenie", teraz);
        }
        przenies(katalog, nazwa, "", teraz);
      } catch (e) {
        if (!(e instanceof BladZamowienia)) throw e;
        wynik.bledy++;
        zapiszBlad(db, partnerId, OPERACJA_ODBIOR_PLIKOW, `${nazwa}: ${e.message}`, "blad", teraz);
        przenies(katalog, nazwa, "BLAD_", teraz);
      }
    } catch (e) {
      // Wyjątek infrastruktury (baza, przeniesienie pliku): plik zostaje na miejscu i zostanie ponowiony (zapis jest idempotentny).
      wynik.bledy++;
      zapiszBladRaz(db, partnerId, `${nazwa}: ${komunikat(e)} (plik zostaje, zostanie ponowiony)`, "blad", teraz);
    }
  }
  if (wynik.nowe + wynik.duplikaty > 0) {
    zapiszOperacje(db, partnerId, OPERACJA_ODBIOR_PLIKOW, `Odebrano ${wynik.plikow} plików: ${wynik.nowe} nowych zamówień, ${wynik.duplikaty} powtórzonych, ${wynik.bledy} błędnych`, wynik.nowe, teraz);
  }
  return wynik;
}

/** Odbiór dla wszystkich AKTYWNYCH partnerów z wpisem w mapowaniu katalogów. Błąd jednego nie zatrzymuje pozostałych. */
export function odbierzPlikiDlaWszystkich(db: Baza, katalogi: ReadonlyMap<string, string>, teraz: Date = new Date()): Map<number, WynikOdbioruPlikow> {
  const wyniki = new Map<number, WynikOdbioruPlikow>();
  for (const p of db.select({ id: partnerzy.id, nazwa: partnerzy.nazwa }).from(partnerzy).where(and(eq(partnerzy.aktywny, true))).all()) {
    const katalog = katalogi.get(p.nazwa.toLowerCase());
    if (!katalog) continue;
    try {
      wyniki.set(p.id, odbierzZamowieniaZPlikow(db, p.id, katalog, teraz));
    } catch (e) {
      console.error(`[partnerzy-odbior-plikow] partner ${p.id}:`, komunikat(e));
    }
  }
  try {
    wyczyscLogi(db, teraz);
  } catch (e) {
    console.error("[partnerzy-odbior-plikow] czyszczenie logów nieudane:", komunikat(e));
  }
  return wyniki;
}

export interface HarmonogramOdbioruPlikow {
  tick(): boolean;
  uruchom(): void;
  zatrzymaj(): void;
}

export function stworzHarmonogramOdbioruPlikow(opcje: { db: Baza; katalogi: ReadonlyMap<string, string>; interwalMs: number }): HarmonogramOdbioruPlikow {
  let timer: NodeJS.Timeout | null = null;
  const tick = (): boolean => {
    try {
      odbierzPlikiDlaWszystkich(opcje.db, opcje.katalogi);
    } catch (e) {
      console.error("[partnerzy-odbior-plikow] przebieg nieudany:", komunikat(e));
    }
    return true;
  };
  return {
    tick,
    uruchom() {
      if (timer) return;
      timer = setInterval(tick, opcje.interwalMs);
      timer.unref();
    },
    zatrzymaj() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}
