/**
 * Klient `/api/partnerzy` — moduł partnerów B2B (karta PARTNERZY, ticket 221 / PRT-5.1).
 *
 * ⚠ NOWA funkcjonalność, trasy backendu poza `contract/openapi.yaml` (jak `/api/ean-pary`): kształty poniżej pochodzą z kodu
 * `rebuild/backend/src/repos/partnerzy.ts` i `partnerzy/logi.ts`, nie z nagrań fixtures.
 */
import { zadanie } from "@/lib/api";

export type PartnerNaLiscie = {
  id: number;
  nazwa: string;
  aktywny: boolean;
  stanMin: number;
  zaokraglanie: string;
  harmonogramMinuty: number | null;
  formatPliku: string;
  liczbaMagazynow: number;
  liczbaWykluczen: number;
  liczbaKrajow: number;
};

export type ListaPartnerow = { partnerzy: PartnerNaLiscie[] };
export type WpisLogu = { id: number; partnerId: number; kiedy: string; operacja: string; opis: string; liczbaPozycji: number | null };
export type ListaLogow = { logi: WpisLogu[] };

export const KLUCZ_PARTNERZY = "/api/partnerzy";

export async function dodajPartnera(nazwa: string): Promise<void> {
  await zadanie("POST", KLUCZ_PARTNERZY, { nazwa });
}

export async function ustawAktywnosc(id: number, aktywny: boolean): Promise<void> {
  await zadanie("PUT", `${KLUCZ_PARTNERZY}/${id}/aktywny`, { aktywny });
}

/** Komunikat z odpowiedzi błędu (`"409: {\"error\":\"…\"}"` → treść pola `error`). */
export function komunikatBledu(e: unknown): string {
  const tekst = e instanceof Error ? e.message : String(e);
  const m = /^\d{3}: (.*)$/s.exec(tekst);
  if (!m) return tekst;
  try {
    const json = JSON.parse(m[1]!) as { error?: unknown };
    return typeof json.error === "string" ? json.error : m[1]!;
  } catch {
    return m[1]!;
  }
}

/** „co 30 min", „co 2 h", „co 1 dzień" albo „—" (bez harmonogramu). */
export function opisHarmonogramu(minuty: number | null): string {
  if (minuty === null) return "—";
  if (minuty % 1440 === 0) return minuty === 1440 ? "co 1 dzień" : `co ${minuty / 1440} dni`;
  if (minuty % 60 === 0) return `co ${minuty / 60} h`;
  return `co ${minuty} min`;
}

export type KrajPartnera = {
  id: number;
  partnerId: number;
  kraj: string;
  /** PROCENT (12 = 12 %). */
  narzutProc: number;
  kursZrodlo: "nbp" | "reczny";
  kursReczny: number | null;
  /** PLN. */
  kosztyDodatkowe: number;
};

export type SzczegolyPartnera = {
  id: number;
  nazwa: string;
  aktywny: boolean;
  stanMin: number;
  zaokraglanie: string;
  harmonogramMinuty: number | null;
  tolerancjaCenyProc: number | null;
  formatPliku: string;
  csvSeparator: string;
  kanalFtp: boolean;
  kanalEmail: boolean;
  emailSkrzynka: string | null;
  zmieniono: string;
  magazyny: string[];
  wykluczenia: string[];
  kraje: KrajPartnera[];
};

export type UstawieniaDoZapisu = Pick<
  SzczegolyPartnera,
  "nazwa" | "stanMin" | "zaokraglanie" | "harmonogramMinuty" | "tolerancjaCenyProc" | "formatPliku" | "csvSeparator" | "kanalFtp" | "kanalEmail" | "emailSkrzynka"
>;
export type UstawieniaKraju = Pick<KrajPartnera, "narzutProc" | "kursZrodlo" | "kursReczny" | "kosztyDodatkowe">;
export type MagazynKatalogu = { magazyn: string; liczbaPozycji: number };

export const ZAOKRAGLANIA: { wartosc: string; etykieta: string }[] = [
  { wartosc: "grosz", etykieta: "do 2 miejsc po przecinku" },
  { wartosc: "euro", etykieta: "do pełnego EUR" },
  { wartosc: "gora5", etykieta: "w górę do 5 EUR" },
  { wartosc: "gora10", etykieta: "w górę do 10 EUR" },
];

export const zapiszUstawienia = async (id: number, c: UstawieniaDoZapisu): Promise<void> => void (await zadanie("PUT", `${KLUCZ_PARTNERZY}/${id}`, c));
export const zapiszMagazyny = async (id: number, magazyny: string[]): Promise<void> => void (await zadanie("PUT", `${KLUCZ_PARTNERZY}/${id}/magazyny`, { magazyny }));
export const zapiszWykluczenia = async (id: number, kody: string[]): Promise<void> => void (await zadanie("PUT", `${KLUCZ_PARTNERZY}/${id}/wykluczenia`, { kody }));
export const zapiszKraj = async (id: number, kraj: string, u: UstawieniaKraju): Promise<void> => void (await zadanie("PUT", `${KLUCZ_PARTNERZY}/${id}/kraje/${kraj}`, u));
export const usunKraj = async (id: number, kraj: string): Promise<void> => void (await zadanie("DELETE", `${KLUCZ_PARTNERZY}/${id}/kraje/${kraj}`));

/** Zamienia tekst z pola liczbowego na liczbę (przecinek lub kropka); pusty → `null`; nieliczbowy → `NaN`. */
export function liczbaZPola(tekst: string): number | null {
  const t = tekst.trim().replace(",", ".");
  return t === "" ? null : Number(t);
}
