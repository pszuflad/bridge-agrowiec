// Odbiór zamówień partnerów przez e-mail (karta PARTNERZY, ticket 229 / PRT-7.3).
//
// Dla aktywnego partnera z `kanal_email` i `email_skrzynka`: czyta nieprzeczytane wiadomości, bierze załączniki XML i zapisuje je jako zamówienia
// (`zapiszZamowienie`, ticket 228 — idempotentnie po `NUMBER`). Walidacja biznesowa i Selly to kolejne tickety.
//
// SEKRETY (w `.env` serwera, nigdy w repo): host/port IMAP wspólne, hasło per partner (`PARTNERZY_IMAP_HASLO_<id>`), użytkownik = `email_skrzynka`.
// Brak hosta lub hasła → kanał partnera jest POMIJANY z wpisem w logu, bez błędu i bez wywracania procesu.
//
// Wiadomość oznaczamy jako przetworzoną po próbie przetworzenia, także gdy plik był błędny (inaczej wracałaby co kilka minut) — błąd trafia do
// `partner_error_log`. Wyjątek infrastrukturalny (np. baza) zostawia wiadomość nieprzeczytaną: zostanie ponowiona przy następnym odbiorze.

import { and, eq, isNotNull } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { partnerzy } from "../db/schema.js";
import { zapiszZamowienie } from "../repos/partnerzy-zamowienia.js";
import { zapiszBlad, zapiszOperacje } from "./logi.js";
import type { OtworzSkrzynke, WiadomoscPoczty, ZalacznikPoczty } from "./poczta.js";
import { BladZamowienia } from "./zamowienie-xml.js";

export const OPERACJA_ODBIOR_EMAIL = "odbior-zamowien-email";

export type UstawieniaOdbioru = {
  host: string | undefined;
  port: number;
  /** Hasło skrzynki partnera (z env) albo `undefined`, gdy nie ustawione. */
  haslo: (partnerId: number) => string | undefined;
};

export type WynikOdbioru = {
  /** false — kanał pominięty (brak konfiguracji) albo awaria połączenia; powód w logach partnera. */
  polaczono: boolean;
  wiadomosci: number;
  nowe: number;
  duplikaty: number;
  bledy: number;
};

const czyXml = (z: ZalacznikPoczty): boolean => /\.xml$/i.test(z.nazwa) || /xml/i.test(z.typ);
const pusty = (): WynikOdbioru => ({ polaczono: false, wiadomosci: 0, nowe: 0, duplikaty: 0, bledy: 0 });

export async function odbierzZamowieniaEmail(
  db: Baza,
  otworz: OtworzSkrzynke,
  partnerId: number,
  ustawienia: UstawieniaOdbioru,
  teraz: Date = new Date(),
): Promise<WynikOdbioru> {
  const wynik = pusty();
  const partner = db.select().from(partnerzy).where(eq(partnerzy.id, partnerId)).get();
  if (!partner || !partner.kanalEmail || !partner.emailSkrzynka) return wynik;

  const haslo = ustawienia.haslo(partnerId);
  if (!ustawienia.host || !haslo) {
    zapiszBlad(db, partnerId, OPERACJA_ODBIOR_EMAIL, `Odbiór e-mail pominięty: brak ${!ustawienia.host ? "PARTNERZY_IMAP_HOST" : `PARTNERZY_IMAP_HASLO_${partnerId}`} w konfiguracji serwera.`, "ostrzezenie", teraz);
    return wynik;
  }

  let skrzynka;
  try {
    skrzynka = await otworz({ host: ustawienia.host, port: ustawienia.port, uzytkownik: partner.emailSkrzynka, haslo });
  } catch (e) {
    zapiszBlad(db, partnerId, OPERACJA_ODBIOR_EMAIL, `Nie udało się połączyć ze skrzynką ${partner.emailSkrzynka}: ${komunikat(e)}`, "blad", teraz);
    return wynik;
  }
  wynik.polaczono = true;

  try {
    const wiadomosci = await skrzynka.pobierzNieprzeczytane();
    for (const w of wiadomosci) {
      wynik.wiadomosci++;
      await przetworz(db, partnerId, w, wynik, teraz);
      await w.oznaczPrzetworzona();
    }
    if (wynik.wiadomosci > 0) {
      zapiszOperacje(db, partnerId, OPERACJA_ODBIOR_EMAIL, `Odebrano ${wynik.wiadomosci} wiad.: ${wynik.nowe} nowych zamówień, ${wynik.duplikaty} powtórzonych, ${wynik.bledy} błędnych`, wynik.nowe, teraz);
    }
  } catch (e) {
    zapiszBlad(db, partnerId, OPERACJA_ODBIOR_EMAIL, `Odbiór przerwany: ${komunikat(e)}`, "blad", teraz);
  } finally {
    await skrzynka.zamknij().catch(() => undefined);
  }
  return wynik;
}

async function przetworz(db: Baza, partnerId: number, w: WiadomoscPoczty, wynik: WynikOdbioru, teraz: Date): Promise<void> {
  const opis = `wiadomość ${w.id} „${w.temat}” od ${w.od}`;
  const pliki = w.zalaczniki.filter(czyXml);
  if (pliki.length === 0) {
    zapiszBlad(db, partnerId, OPERACJA_ODBIOR_EMAIL, `${opis}: brak załącznika XML.`, "ostrzezenie", teraz);
    return;
  }
  for (const plik of pliki) {
    try {
      const z = zapiszZamowienie(db, partnerId, plik.tresc.toString("utf-8"), teraz);
      if (z.nowe) wynik.nowe++;
      else {
        wynik.duplikaty++;
        if (z.zmieniony) zapiszBlad(db, partnerId, OPERACJA_ODBIOR_EMAIL, `${opis}, ${plik.nazwa}: zamówienie o tym numerze już jest, ale z inną treścią — zapisanego nie nadpisano.`, "ostrzezenie", teraz);
      }
    } catch (e) {
      if (!(e instanceof BladZamowienia)) throw e; // awaria infrastruktury: wiadomość zostaje nieprzeczytana
      wynik.bledy++;
      zapiszBlad(db, partnerId, OPERACJA_ODBIOR_EMAIL, `${opis}, ${plik.nazwa}: ${e.message}`, "blad", teraz);
    }
  }
}

const komunikat = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** Odbiór dla wszystkich AKTYWNYCH partnerów z włączonym kanałem e-mail. Błąd jednego nie zatrzymuje pozostałych. */
export async function odbierzDlaWszystkich(db: Baza, otworz: OtworzSkrzynke, ustawienia: UstawieniaOdbioru, teraz: Date = new Date()): Promise<Map<number, WynikOdbioru>> {
  const ids = db
    .select({ id: partnerzy.id })
    .from(partnerzy)
    .where(and(eq(partnerzy.aktywny, true), eq(partnerzy.kanalEmail, true), isNotNull(partnerzy.emailSkrzynka)))
    .all()
    .map((r) => r.id);
  const wyniki = new Map<number, WynikOdbioru>();
  for (const id of ids) wyniki.set(id, await odbierzZamowieniaEmail(db, otworz, id, ustawienia, teraz));
  return wyniki;
}

export interface HarmonogramOdbioru {
  /** Jeden przebieg (wołany timerem; wystawiony dla testów). Pomija się, gdy poprzedni jeszcze trwa. Zwraca false, gdy pominięty. */
  tick(): Promise<boolean>;
  uruchom(): void;
  zatrzymaj(): void;
}

/** Cykliczny odbiór dla wszystkich aktywnych partnerów z kanałem e-mail. Wyjątek nie wywraca procesu. */
export function stworzHarmonogramOdbioru(opcje: { db: Baza; otworz: OtworzSkrzynke; ustawienia: UstawieniaOdbioru; interwalMs: number }): HarmonogramOdbioru {
  let timer: NodeJS.Timeout | null = null;
  let trwa = false;
  const tick = async (): Promise<boolean> => {
    if (trwa) return false;
    trwa = true;
    try {
      await odbierzDlaWszystkich(opcje.db, opcje.otworz, opcje.ustawienia);
    } catch (e) {
      console.error("[partnerzy-odbior-email] przebieg nieudany:", komunikat(e));
    } finally {
      trwa = false;
    }
    return true;
  };
  return {
    tick,
    uruchom() {
      if (timer) return;
      timer = setInterval(() => void tick(), opcje.interwalMs);
      timer.unref();
    },
    zatrzymaj() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}
