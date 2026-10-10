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
