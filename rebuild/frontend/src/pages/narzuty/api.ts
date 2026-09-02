/**
 * Klient `/api/markups` i `/api/promotions` — backend gotowy od sesji 4a
 * (ticket `15-FEATURE-narzuty-promocje-ceny`).
 *
 * ⚠ WYSYŁAMY WYŁĄCZNIE POLA Z LIST EDYTOWALNYCH. Backend odsiewa ciało żądania przez
 * `POLA_EDYTOWALNE_NARZUTU` i `POLA_EDYTOWALNE_PROMOCJI` (`rebuild/backend/src/repos/`),
 * a pole spoza listy jest po cichu IGNOROWANE PRZY ZAPISIE — i mimo to trafia do audytu,
 * bo audyt loguje surowe ciało (4a, decyzje D2 i D3). Wysłanie czegoś spoza listy nie da
 * więc błędu, tylko cichą nieskuteczność plus mylący wpis w dzienniku.
 *
 * `zmienilUzytkownikId` i `zmienionoData` ustawia SERWER — nie wolno ich wysyłać.
 */
import { BAZA_API, naglowki, rzucGdyBlad, zadanie } from "@/lib/api";

/** Kształt z `contract/fixtures/GET_markups.json` — jedenaście pól. */
export type Narzut = {
  id: number;
  typ: string;
  zakres: string;
  /** STRING ze zserializowanym JSON-em, nie tablica. */
  warunki: string | null;
  nazwa: string | null;
  wartosc: number;
  jednostka: string;
  priorytet: number;
  status: string;
  zmienilUzytkownikId: number | null;
  zmienionoData: string | null;
};

/**
 * ⚠ Kształt ze SCHEMATU (`rebuild/schema/001_schema.sql:156-168`), nie z nagrania:
 * `contract/fixtures/GET_promotions.json` jest pustą tablicą, bo produkcja nie miała
 * ani jednej promocji w chwili nagrywania. To słabsze świadectwo niż przy narzutach.
 */
export type Promocja = {
  id: number;
  nazwa: string;
  rabatPct: number;
  zasieg: string;
  warunki: string | null;
  priorytet: number | null;
  start: string;
  koniec: string;
  status: string;
  zmienilUzytkownikId: number | null;
  zmienionoData: string | null;
};

/** Pola przyjmowane przez `POST`/`PATCH /api/markups` — 1:1 z `POLA_EDYTOWALNE_NARZUTU`. */
export type CialoNarzutu = {
  typ: string;
  zakres: string;
  warunki: string;
  nazwa: string;
  wartosc: number;
  jednostka: string;
  priorytet: number;
  status: string;
};

/** Pola przyjmowane przez `POST`/`PATCH /api/promotions` — 1:1 z `POLA_EDYTOWALNE_PROMOCJI`. */
export type CialoPromocji = {
  nazwa: string;
  rabatPct: number;
  zasieg: string;
  warunki: string;
  priorytet: number;
  start: string;
  koniec: string;
  status: string;
};

/**
 * Odczyt odpowiedzi mutacji.
 *
 * ⚠ POWÓD ISTNIENIA TEJ FUNKCJI: `PATCH /api/promotions/{id}` dla nieistniejącego `id`
 * oddaje **200 z PUSTYM ciałem**, a nie 404 — bliźniacza trasa narzutu 404 ma. To asymetria
 * oryginału odtworzona w 4a 1:1 (`backend-index.cjs:48709` vs `:48722-48731`,
 * `rebuild-backlog.md` #20). Gołe `odpowiedz.json()` rzuciłoby tu wyjątkiem parsowania,
 * czyli edycja znikniętej promocji wywalałaby widok zamiast pokazać komunikat.
 *
 * @returns `null`, gdy serwer oddał puste ciało — czyli „nie znaleziono", nie „sukces".
 */
async function odczytajCialo<T>(odpowiedz: Response): Promise<T | null> {
  const tresc = await odpowiedz.text();
  if (!tresc) return null;
  return JSON.parse(tresc) as T;
}

/**
 * Lista reguł. Odpowiedź to GOŁA TABLICA, nie koperta (`GET_markups.json`).
 *
 * Nie używamy domyślnego `queryFn` z `queryClient.ts` (`on401: returnNull`), bo widok ma
 * odróżniać pustą listę od braku sesji — tamten zwróciłby `null` i tabela pokazałaby
 * „brak reguł" przy wygasłym tokenie.
 */
export async function pobierzNarzuty(): Promise<Narzut[]> {
  const odpowiedz = await fetch(`${BAZA_API}/api/markups`, {
    headers: naglowki(false),
    credentials: "include",
  });
  await rzucGdyBlad(odpowiedz);
  return (await odpowiedz.json()) as Narzut[];
}

export async function pobierzPromocje(): Promise<Promocja[]> {
  const odpowiedz = await fetch(`${BAZA_API}/api/promotions`, {
    headers: naglowki(false),
    credentials: "include",
  });
  await rzucGdyBlad(odpowiedz);
  return (await odpowiedz.json()) as Promocja[];
}

export async function dodajNarzut(cialo: CialoNarzutu): Promise<Narzut | null> {
  return odczytajCialo<Narzut>(await zadanie("POST", "/api/markups", cialo));
}

export async function zapiszNarzut(
  id: number,
  cialo: Partial<CialoNarzutu>,
): Promise<Narzut | null> {
  return odczytajCialo<Narzut>(await zadanie("PATCH", `/api/markups/${id}`, cialo));
}

export async function usunNarzut(id: number): Promise<void> {
  await zadanie("DELETE", `/api/markups/${id}`);
}

export async function dodajPromocje(cialo: CialoPromocji): Promise<Promocja | null> {
  return odczytajCialo<Promocja>(await zadanie("POST", "/api/promotions", cialo));
}

/**
 * @returns `null`, gdy promocji o tym `id` nie ma — serwer oddaje wtedy 200 z pustym ciałem
 *   (patrz `odczytajCialo`). Wywołujący MUSI to rozróżnić, bo `rzucGdyBlad` tu nie zadziała.
 */
export async function zapiszPromocje(
  id: number,
  cialo: Partial<CialoPromocji>,
): Promise<Promocja | null> {
  return odczytajCialo<Promocja>(await zadanie("PATCH", `/api/promotions/${id}`, cialo));
}

export async function usunPromocje(id: number): Promise<void> {
  await zadanie("DELETE", `/api/promotions/${id}`);
}
