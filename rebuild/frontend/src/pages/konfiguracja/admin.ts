/**
 * Klient tras administracyjnych — backend gotowy w tej samej sesji
 * (`rebuild/backend/src/routes/{admin,konto,maintenance}.ts`).
 *
 * ⚠ TE EKRANY NIE ISTNIAŁY W ORYGINALNYM REACT SPA (plan.md D1, świadome odstępstwo).
 * Produkcja obsługuje te trasy osobnymi stronami HTML poza panelem
 * (`mirror/backend/extensions.cjs:290-295,410-415`), więc nie ma wzorca UI do odtworzenia —
 * jest za to kontrakt, i to on wyznacza kształty niżej. Wszystkie typy pochodzą wprost
 * z `contract/fixtures/`, nie z naszej implementacji.
 */
import { BAZA_API, naglowki, rzucGdyBlad } from "@/lib/api";

/** Kształt z `contract/fixtures/GET_admin_supplier-config.json`. */
export type KonfiguracjaDostawcy = {
  kod: string;
  nazwa: string;
  /** Adres EFEKTYWNY: z bazy, jeśli ustawiony, inaczej `fallbackUrl`. */
  url: string | null;
  /** Czy `url` pochodzi z bazy (`true`), czy jest fallbackiem dispatchera (`false`). */
  urlEfektywnyZDb: boolean;
  czestotliwoscMinuty: number | null;
  status: string;
  /** Adres z mapy dispatchera — ZAWSZE, niezależnie od bazy. */
  fallbackUrl: string | null;
};

/** Kształt z `contract/fixtures/GET_admin_suppliers-list.json`. */
export type DostawcaNaLiscie = {
  kod: string;
  nazwa: string;
  url: string | null;
  czestotliwoscMinuty: number | null;
  status: string;
  ostatniPlik: string | null;
  liczbaProduktow: number;
};

/** Kształt z `contract/fixtures/GET_users.json` — trzy pola, bez hasła. */
export type UzytkownikNaLiscie = {
  id: number;
  email: string;
  imieNazwisko: string;
};

/** Kształt z `contract/fixtures/GET_audit-log.json`. */
export type WpisAudytu = {
  id: number;
  uzytkownikId: number | null;
  uzytkownikImie: string | null;
  akcja: string;
  encjaTyp: string | null;
  encjaId: string | null;
  /**
   * ⚠ STRING, nie obiekt — backend oddaje surową kolumnę (`u.json(U.listAudit(500))`,
   * `backend-index.cjs:48735`), a `contract/fixtures/GET_audit-log.json` to zamraża.
   * Parsowanie robi widok, przez `parsujSzczegoly` z `./dziennik`.
   */
  szczegolyJson: string | null;
  kiedy: string;
};

/** Statusy przyjmowane przez `PATCH` — 1:1 z walidacją backendu (`extensions.cjs:374`). */
export const STATUSY_DOSTAWCY = ["aktywny", "wstrzymany", "blad"] as const;

/** Granice częstotliwości pollingu — 1:1 z backendem (`extensions.cjs:366`). */
export const MIN_CZESTOTLIWOSC = 5;
export const MAX_CZESTOTLIWOSC = 10080;

async function pobierzJson<T>(sciezka: string): Promise<T> {
  const odpowiedz = await fetch(`${BAZA_API}${sciezka}`, {
    headers: naglowki(false),
    credentials: "include",
  });
  await rzucGdyBlad(odpowiedz);
  return (await odpowiedz.json()) as T;
}

export async function pobierzKonfiguracjeDostawcow(): Promise<KonfiguracjaDostawcy[]> {
  const { dostawcy } = await pobierzJson<{ ok: boolean; dostawcy: KonfiguracjaDostawcy[] }>(
    "/api/admin/supplier-config",
  );
  return dostawcy;
}

export async function pobierzListeDostawcow(): Promise<DostawcaNaLiscie[]> {
  const { dostawcy } = await pobierzJson<{ ok: boolean; dostawcy: DostawcaNaLiscie[] }>(
    "/api/admin/suppliers-list",
  );
  return dostawcy;
}

export function pobierzUzytkownikow(): Promise<UzytkownikNaLiscie[]> {
  return pobierzJson<UzytkownikNaLiscie[]>("/api/users");
}

export function pobierzAudyt(): Promise<WpisAudytu[]> {
  return pobierzJson<WpisAudytu[]>("/api/audit-log");
}

/** Pola przyjmowane przez `PATCH` — każde OPCJONALNE; nieobecne znaczy „nie ruszaj". */
export type ZmianaDostawcy = {
  /** `null` albo `""` CZYŚCI adres, przywracając fallback dispatchera. */
  url?: string | null;
  /** `null` czyści częstotliwość. */
  czestotliwoscMinuty?: number | null;
  status?: string;
};

/**
 * ⚠ METODA TO `PATCH`. `contract/openapi.yaml:31` i `extensions.cjs:344` — roadmapa mówiła
 * „PUT", czego w oryginale nie ma.
 *
 * Komunikat błędu bierzemy z ciała odpowiedzi (backend zwraca `{error}` dla każdej z sześciu
 * gałęzi walidacji), żeby użytkownik zobaczył, KTÓRE pole odrzucono.
 */
export async function zapiszKonfiguracjeDostawcy(
  kod: string,
  zmiana: ZmianaDostawcy,
): Promise<void> {
  const odpowiedz = await fetch(`${BAZA_API}/api/admin/supplier-config/${kod}`, {
    method: "PATCH",
    headers: naglowki(true),
    body: JSON.stringify(zmiana),
    credentials: "include",
  });

  if (!odpowiedz.ok) {
    const cialo = (await odpowiedz.json().catch(() => ({}))) as { error?: string };
    throw new Error(cialo.error || "Nie udało się zapisać konfiguracji dostawcy");
  }
}

export type WynikUsuwaniaNieOpon = {
  ok: boolean;
  usuniete: number;
  perDostawca: Record<string, number>;
  /** Do dziesięciu pozycji w formacie `dostawca/kod: nazwa` (`:48397`). */
  przyklady: string[];
};

export async function usunNieOpony(): Promise<WynikUsuwaniaNieOpon> {
  const odpowiedz = await fetch(`${BAZA_API}/api/maintenance/usun-nieopony`, {
    method: "POST",
    headers: naglowki(false),
    credentials: "include",
  });
  await rzucGdyBlad(odpowiedz);
  return (await odpowiedz.json()) as WynikUsuwaniaNieOpon;
}
