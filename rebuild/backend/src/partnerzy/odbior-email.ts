// Odbiór zamówień partnerów przez e-mail (karta PARTNERZY, ticket 229 / PRT-7.3).
//
// Dla aktywnego partnera z `kanal_email` i `email_skrzynka`: czyta nieprzeczytane wiadomości, bierze załączniki XML i zapisuje je jako zamówienia
// (`zapiszZamowienie`, ticket 228 — idempotentnie po `NUMBER`). Walidacja biznesowa i Selly to kolejne tickety.
//
// SEKRETY (w `.env` serwera, nigdy w repo): host/port IMAP wspólne, hasło per partner (`PARTNERZY_IMAP_HASLO_<id>`), użytkownik = `email_skrzynka`.
// Brak hosta lub hasła → kanał partnera jest POMIJANY z wpisem w logu (raz na dobę), bez błędu i bez wywracania procesu.
//
// Każda wiadomość jest obsługiwana w izolacji (`obsluzWiadomosc`): żaden wyjątek nie przerywa pętli. Wiadomość oznaczamy jako przetworzoną po próbie,
// także gdy plik był błędny (inaczej wracałaby co kilka minut) — błąd trafia do `partner_error_log`. Wyjątek infrastruktury (np. baza) zostawia
// wiadomość nieprzeczytaną: zostanie ponowiona przy następnym odbiorze (zapis jest idempotentny).

import { and, eq, gt, isNotNull } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { partnerErrorLog, partnerzy } from "../db/schema.js";
import { zapiszZamowienie } from "../repos/partnerzy-zamowienia.js";
import { dekodujXml } from "./dekoduj-xml.js";
import { wyczyscLogi, zapiszBlad, zapiszOperacje } from "./logi.js";
import { STATUS_BLAD_IMPORTU, zwaliduj } from "./walidacja-zamowienia.js";
import type { OtworzSkrzynke, WiadomoscPoczty, ZalacznikPoczty } from "./poczta.js";
import { BladZamowienia } from "./zamowienie-xml.js";

export const OPERACJA_ODBIOR_EMAIL = "odbior-zamowien-email";

export type UstawieniaOdbioru = {
  host: string | undefined;
  port: number;
  /** Hasło skrzynki partnera (z env) albo `undefined`, gdy nie ustawione. */
  haslo: (partnerId: number) => string | undefined;
};

/** Zależności odbioru wstrzykiwane do aplikacji (trasa „Odbierz teraz”): fabryka skrzynki + ustawienia z `.env`. */
export type OdbiorEmail = { otworz: OtworzSkrzynke; ustawienia: UstawieniaOdbioru };

/** Odbiór dla tego partnera już trwa (zamek jest wspólny dla harmonogramu i ręcznego „Odbierz teraz”). */
export class OdbiorTrwaError extends Error {
  constructor(partnerId: number) {
    super(`Odbiór zamówień dla partnera ${partnerId} już trwa.`);
    this.name = "OdbiorTrwaError";
  }
}

export type WynikOdbioru = {
  /** false — kanał pominięty (brak konfiguracji) albo awaria połączenia; szczegóły w `powod` i w logach partnera. */
  polaczono: boolean;
  /** Czytelny powód, gdy nic nie odebrano (brak zmiennej w `.env`, awaria połączenia); `null`, gdy odbiór się odbył. Bez wartości sekretów. */
  powod: string | null;
  wiadomosci: number;
  nowe: number;
  duplikaty: number;
  bledy: number;
};

/**
 * Załącznik uznajemy za XML po rozszerzeniu `.xml` albo typie MIME `text/xml`, `application/xml`, `…+xml`. Typy `vnd.openxmlformats-…` (pliki .xlsx/.docx) i inne
 * zawierające „xml” tylko w nazwie NIE są XML-em zamówienia — gdyby wpadły do parsera, w error_log byłby błędny „XML” zamiast zwykłego pominięcia.
 */
export const czyXml = (z: ZalacznikPoczty): boolean => /\.xml$/i.test(z.nazwa) || /^(text|application)\/([\w.-]+\+)?xml\s*(;|$)/i.test(z.typ.trim());
const komunikat = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** Po tym czasie zamek uznajemy za porzucony (zawieszone połączenie IMAP nie może zablokować odbioru partnera do restartu). */
export const LIMIT_ZAMKA_MS = 15 * 60_000;
const trwajace = new Map<number, { token: symbol; od: number }>(); // partnerId → właściciel zamka i kiedy zajęty (ms)

/** Tylko dla testów: zamki są stanem modułu, więc zawieszony odbiór z jednego testu nie może blokować następnych. */
export function _zresetujZamkiOdbioru(): void {
  trwajace.clear();
}

/** Rzuca `OdbiorTrwaError`, gdy odbiór dla partnera już trwa (zamek w pamięci procesu — wystarczy: jeden proces backendu). */
export async function odbierzZamowieniaEmail(
  db: Baza,
  otworz: OtworzSkrzynke,
  partnerId: number,
  ustawienia: UstawieniaOdbioru,
  teraz: Date = new Date(),
): Promise<WynikOdbioru> {
  const zajety = trwajace.get(partnerId);
  if (zajety !== undefined && Date.now() - zajety.od < LIMIT_ZAMKA_MS) throw new OdbiorTrwaError(partnerId);
  const moj = Symbol("zamek-odbioru"); // unikalny token — znacznik czasu nie odróżniłby dwóch przejęć w tej samej milisekundzie
  trwajace.set(partnerId, { token: moj, od: Date.now() });
  try {
    return await odbierz(db, otworz, partnerId, ustawienia, teraz);
  } finally {
    // Nie zdejmujemy cudzego zamka: po przeterminowaniu mógł go przejąć nowszy odbiór.
    if (trwajace.get(partnerId)?.token === moj) trwajace.delete(partnerId);
  }
}

async function odbierz(
  db: Baza,
  otworz: OtworzSkrzynke,
  partnerId: number,
  ustawienia: UstawieniaOdbioru,
  teraz: Date = new Date(),
): Promise<WynikOdbioru> {
  const wynik: WynikOdbioru = { polaczono: false, powod: null, wiadomosci: 0, nowe: 0, duplikaty: 0, bledy: 0 };
  const partner = db.select().from(partnerzy).where(eq(partnerzy.id, partnerId)).get();
  if (!partner || !partner.kanalEmail || !partner.emailSkrzynka) {
    wynik.powod = "Kanał e-mail partnera nie jest włączony albo brakuje adresu skrzynki.";
    return wynik;
  }

  const haslo = ustawienia.haslo(partnerId);
  if (!ustawienia.host || !haslo) {
    const tekst = `Odbiór e-mail pominięty: brak ${!ustawienia.host ? "PARTNERZY_IMAP_HOST" : `PARTNERZY_IMAP_HASLO_${partnerId}`} w konfiguracji serwera.`;
    zapiszOstrzezenieRaz(db, partnerId, tekst, teraz);
    wynik.powod = tekst;
    return wynik;
  }

  let skrzynka;
  try {
    skrzynka = await otworz({ host: ustawienia.host, port: ustawienia.port, uzytkownik: partner.emailSkrzynka, haslo });
  } catch (e) {
    const tekst = `Nie udało się połączyć ze skrzynką ${partner.emailSkrzynka}: ${bezHasla(komunikat(e), haslo)}`;
    zapiszBlad(db, partnerId, OPERACJA_ODBIOR_EMAIL, tekst, "blad", teraz);
    wynik.powod = tekst;
    return wynik;
  }
  wynik.polaczono = true;

  try {
    const wiadomosci = await skrzynka.pobierzNieprzeczytane();
    for (const w of wiadomosci) {
      wynik.wiadomosci++;
      await obsluzWiadomosc(db, partnerId, w, wynik, haslo, teraz);
    }
    if (wynik.wiadomosci > 0) {
      zapiszOperacje(db, partnerId, OPERACJA_ODBIOR_EMAIL, `Odebrano ${wynik.wiadomosci} wiad.: ${wynik.nowe} nowych zamówień, ${wynik.duplikaty} powtórzonych, ${wynik.bledy} błędnych`, wynik.nowe, teraz);
    }
  } catch (e) {
    const tekst = `Odbiór przerwany: ${bezHasla(komunikat(e), haslo)}`;
    zapiszBlad(db, partnerId, OPERACJA_ODBIOR_EMAIL, tekst, "blad", teraz);
    wynik.powod = tekst; // połączenie było, ale odbiór się nie dokończył — wynik nie może wyglądać na sukces
    wynik.bledy++;
  } finally {
    await skrzynka.zamknij().catch(() => undefined);
  }
  return wynik;
}

/**
 * Jedna wiadomość, w pełni odizolowana — żaden wyjątek stąd nie przerywa pętli (jedna zła wiadomość nie blokuje reszty).
 * - uszkodzona lub za duża wiadomość (`wczytaj` rzuca) → błąd w logu i oznaczenie, żeby nie wracała w kółko (gdy padła sesja, oznaczenie też padnie
 *   i wiadomość zostanie ponowiona);
 * - błąd pliku XML → błąd w logu, wiadomość oznaczona;
 * - wyjątek infrastruktury (baza) po wczytaniu → błąd w logu, wiadomość ZOSTAJE nieprzeczytana.
 */
async function obsluzWiadomosc(db: Baza, partnerId: number, w: WiadomoscPoczty, wynik: WynikOdbioru, haslo: string, teraz: Date): Promise<void> {
  let opis = `wiadomość ${w.id}`;
  let wczytana = false;
  let oznaczyc = true;
  try {
    const tresc = await w.wczytaj();
    wczytana = true;
    opis = `wiadomość ${w.id} „${tresc.temat}” od ${tresc.od}`;
    const pliki = tresc.zalaczniki.filter(czyXml);
    if (pliki.length === 0) zapiszBlad(db, partnerId, OPERACJA_ODBIOR_EMAIL, `${opis}: brak załącznika XML.`, "ostrzezenie", teraz);
    for (const plik of pliki) {
      try {
        const z = zapiszZamowienie(db, partnerId, dekodujXml(plik.tresc), teraz);
        // Walidacja względem katalogu (ticket 232) po KAŻDYM zapisie, także dla powtórzonego pliku (zamówienie ze statusem `nowe` po awarii walidacji
        // zostanie dokończone, a po poprawie katalogu wróci `blad_importu`). `zachowajPrzyjete`: zamówienie już przyjęte nie jest degradowane samoczynnie.
        // Zamówienie zostaje zapisane niezależnie od wyniku; partner NIE dostaje żadnego powiadomienia.
        const walid = zwaliduj(db, z.id, { zachowajPrzyjete: true });
        if (walid?.status === STATUS_BLAD_IMPORTU && walid.zmieniony) {
          zapiszBlad(db, partnerId, OPERACJA_ODBIOR_EMAIL, `${opis}, ${plik.nazwa}: zamówienie przyjęte ze statusem „błąd importu” (${walid.bledy} poz.) — szczegóły w panelu zamówień.`, "ostrzezenie", teraz);
        }
        if (z.nowe) wynik.nowe++;
        else {
          wynik.duplikaty++;
          if (z.zmieniony) zapiszBlad(db, partnerId, OPERACJA_ODBIOR_EMAIL, `${opis}, ${plik.nazwa}: zamówienie o tym numerze już jest, ale z inną treścią — zapisanego nie nadpisano.`, "ostrzezenie", teraz);
        }
      } catch (e) {
        if (!(e instanceof BladZamowienia)) throw e;
        wynik.bledy++;
        zapiszBlad(db, partnerId, OPERACJA_ODBIOR_EMAIL, `${opis}, ${plik.nazwa}: ${e.message}`, "blad", teraz);
      }
    }
  } catch (e) {
    wynik.bledy++;
    if (wczytana) oznaczyc = false; // wyjątek infrastruktury po wczytaniu: zostaje do ponowienia
    zapiszBlad(db, partnerId, OPERACJA_ODBIOR_EMAIL, `${opis}: ${bezHasla(komunikat(e), haslo)}${oznaczyc ? "" : " (zostanie ponowiona)"}`, "blad", teraz);
  }
  if (!oznaczyc) return;
  try {
    await w.oznaczPrzetworzona();
  } catch (e) {
    zapiszBlad(db, partnerId, OPERACJA_ODBIOR_EMAIL, `${opis}: nie udało się oznaczyć jako przetworzonej (${bezHasla(komunikat(e), haslo)}) — zostanie odebrana ponownie.`, "blad", teraz);
  }
}

/** Defensywnie: hasło nigdy nie trafia do logów, nawet gdyby biblioteka wkleiła je do komunikatu błędu. */
const bezHasla = (tekst: string, haslo: string): string => (haslo ? tekst.split(haslo).join("***") : tekst);

/** Ostrzeżenie o braku konfiguracji: pomija zapis, jeśli identyczne już jest z ostatniej doby (inaczej log zalałyby setki wpisów dziennie). */
function zapiszOstrzezenieRaz(db: Baza, partnerId: number, tekst: string, teraz: Date): void {
  const doba = new Date(teraz.getTime() - 86_400_000).toISOString();
  const jest = db
    .select({ id: partnerErrorLog.id })
    .from(partnerErrorLog)
    .where(and(eq(partnerErrorLog.partnerId, partnerId), eq(partnerErrorLog.operacja, OPERACJA_ODBIOR_EMAIL), eq(partnerErrorLog.komunikat, tekst), gt(partnerErrorLog.kiedy, doba)))
    .get();
  if (!jest) zapiszBlad(db, partnerId, OPERACJA_ODBIOR_EMAIL, tekst, "ostrzezenie", teraz);
}

/** Odbiór dla wszystkich AKTYWNYCH partnerów z włączonym kanałem e-mail. Błąd jednego nie zatrzymuje pozostałych. */
export async function odbierzDlaWszystkich(db: Baza, otworz: OtworzSkrzynke, ustawienia: UstawieniaOdbioru, teraz: Date = new Date()): Promise<Map<number, WynikOdbioru>> {
  const ids = db
    .select({ id: partnerzy.id })
    .from(partnerzy)
    .where(and(eq(partnerzy.aktywny, true), eq(partnerzy.kanalEmail, true), isNotNull(partnerzy.emailSkrzynka)))
    .all()
    .map((r) => r.id);
  const wyniki = new Map<number, WynikOdbioru>();
  for (const id of ids) {
    try {
      wyniki.set(id, await odbierzZamowieniaEmail(db, otworz, id, ustawienia, teraz));
    } catch (e) {
      if (e instanceof OdbiorTrwaError) continue; // ręczne „Odbierz teraz” właśnie trwa — ten partner w tym przebiegu pomijamy
      console.error(`[partnerzy-odbior-email] partner ${id}:`, komunikat(e));
    }
  }
  try {
    wyczyscLogi(db, teraz); // retencja 30 dni także tutaj — odbiór pisze do logów częściej niż generowanie
  } catch (e) {
    console.error("[partnerzy-odbior-email] czyszczenie logów nieudane:", komunikat(e));
  }
  return wyniki;
}

export interface HarmonogramOdbioru {
  /** Jeden przebieg (wołany timerem; wystawiony dla testów). Pomija się, gdy poprzedni jeszcze trwa. Zwraca false, gdy pominięty. */
  tick(): Promise<boolean>;
  uruchom(): void;
  zatrzymaj(): void;
}

/** Cykliczny odbiór dla wszystkich aktywnych partnerów z kanałem e-mail. Wyjątek nie wywraca procesu; zawieszony przebieg zwalnia zamek po `limitMs`. */
export function stworzHarmonogramOdbioru(opcje: { db: Baza; otworz: OtworzSkrzynke; ustawienia: UstawieniaOdbioru; interwalMs: number; limitPrzebieguMs?: number }): HarmonogramOdbioru {
  let timer: NodeJS.Timeout | null = null;
  let trwa = false;
  const limit = opcje.limitPrzebieguMs ?? 10 * 60_000;
  const tick = async (): Promise<boolean> => {
    if (trwa) return false;
    trwa = true;
    let limitTimer: NodeJS.Timeout | undefined;
    try {
      const przebieg = odbierzDlaWszystkich(opcje.db, opcje.otworz, opcje.ustawienia);
      przebieg.catch(() => undefined); // spóźniony wyjątek porzuconego przebiegu nie może zostać nieobsłużony
      await Promise.race([
        przebieg,
        new Promise<never>((_, odrzuc) => {
          limitTimer = setTimeout(() => odrzuc(new Error(`przebieg trwa dłużej niż ${limit} ms — zamek zwolniony`)), limit);
        }),
      ]);
    } catch (e) {
      console.error("[partnerzy-odbior-email] przebieg nieudany:", komunikat(e));
    } finally {
      clearTimeout(limitTimer);
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
