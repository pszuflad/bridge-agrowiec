/**
 * Klient API widoku `/waga-gabarytowa` — karta P9.1 (ticket 76).
 *
 * ⚠ ODSTĘPSTWA ŚWIADOME od produkcji, oba zatwierdzone przez Anię (2026-09-18/21):
 *  - lista przewoźników idzie na serwer (backlog #27) zamiast do IndexedDB
 *    (`deminified/frontend-index.js:9165-9193`) — wspólna dla całej firmy;
 *  - kalkulator paletowy woła `POST /api/waga-gabarytowa/oblicz` (backlog #28), którego
 *    produkcyjny frontend nie woła wcale.
 *
 * Wzór wolumetryczny zostaje we froncie (`obliczenia.ts`) — serwer daje mu tylko dzielniki.
 */
import { zadanie } from "@/lib/api";
import type { Przewoznik } from "./przewoznicy";

/** Klucz zapytania = ścieżka (konwencja `lib/queryClient.ts`). */
export const KLUCZ_PRZEWOZNIKOW = ["/api/waga-gabarytowa/przewoznicy"] as const;

/** Podmienia CAŁĄ listę — tak jak front zapisywał ją wcześniej do IndexedDB. Oddaje listę po zapisie. */
export async function zapiszPrzewoznikow(lista: Przewoznik[]): Promise<Przewoznik[]> {
  const odpowiedz = await zadanie("PUT", KLUCZ_PRZEWOZNIKOW[0], lista);
  return (await odpowiedz.json()) as Przewoznik[];
}

/** Ciało `/oblicz` — trzy wymiary w cm (`rebuild/backend/src/waga-gabarytowa/formula.ts`). */
export type WymiaryPaletowe = { szerokosc: number; dlugosc: number; wysokosc: number };

/** Odpowiedź `/oblicz` — pięć pól handlera oryginału (`backend-index.cjs:48766-48769`). */
export type WynikPaletowy = {
  /** Już zaokrąglona przez serwer do trzech miejsc po przecinku. */
  wagaGabarytowa: number;
  szerokoscEfektywna: number;
  wysokoscZPaleta: number;
  wspolczynnik: number;
  /** Zdanie z serwera, jak zaokrąglono szerokość (półpaleta / paleta / oryginał). */
  opis: string;
};

export async function obliczPaletowo(wymiary: WymiaryPaletowe): Promise<WynikPaletowy> {
  const odpowiedz = await zadanie("POST", "/api/waga-gabarytowa/oblicz", wymiary);
  return (await odpowiedz.json()) as WynikPaletowy;
}
