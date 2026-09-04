/**
 * Formatowanie wartości panelu Selly — port 1:1 z `mirror/frontend/assets/selly-injection.js`.
 *
 * Każda funkcja odpowiada jednemu wyrażeniu z oryginału; numery linii przy funkcjach.
 * Trzymamy je osobno od komponentów, żeby dało się je przetestować bez montowania widoku.
 */

/** Stan wskaźnika przy nagłówku sekcji — odpowiednik klas `.dot` / `.err` / `.load`. */
export type StanWskaznika = "ok" | "blad" | "ladowanie";

/**
 * Rozmiar pliku CSV — `selly-injection.js:588`.
 * Oryginał NIE przelicza jednostek: bierze gotowe `rozmiar_mb` z API i dokleja „ MB".
 */
export function formatujRozmiar(rozmiarMb: number | null | undefined): string {
  return rozmiarMb == null ? "—" : `${rozmiarMb} MB`;
}

/**
 * Liczba produktów w pliku — `selly-injection.js:587`.
 * Separator tysięcy z polskiego locale (spacja niełamliwa), nie kropka.
 */
export function formatujLiczbe(wartosc: number | null | undefined): string {
  return wartosc == null ? "—" : wartosc.toLocaleString("pl-PL");
}

/**
 * Data ostatniej synchronizacji CSV — `selly-injection.js:583-585`.
 * Pełna data w locale `pl-PL` plus wiek w nawiasie, liczony z `wiek_minut` (nie z zegara
 * przeglądarki — API podaje go samo, więc nie wprowadzamy własnego źródła czasu).
 */
export function formatujOstatniaSynchronizacje(
  znacznik: string | null | undefined,
  wiekMinut: number | null | undefined,
): string {
  if (!znacznik) return "—";
  const data = new Date(znacznik);
  if (Number.isNaN(data.getTime())) return "—";
  const opis = data.toLocaleString("pl-PL");
  return wiekMinut == null ? opis : `${opis} (${wiekMinut} min temu)`;
}

/**
 * Data wpisu w logu — `selly-injection.js:666`.
 * Oryginał tnie STRING, nie parsuje daty: `(rozpoczeto||'').slice(0,19).replace('T',' ')`.
 * Wierność ma znaczenie, bo fixture niesie dwa formaty naraz — `"2026-07-06 07:43:36"`
 * (ze spacją, prosto z SQLite) i ISO z `T`. Parsowanie przez `Date` przesunęłoby jedne
 * o strefę, a drugich nie.
 */
export function formatujDateLogu(rozpoczeto: string | null | undefined): string {
  return (rozpoczeto ?? "").slice(0, 19).replace("T", " ");
}

/**
 * Wariant odznaki statusu operacji — `selly-injection.js:667`.
 * `success` → zielony, `error` → czerwony, WSZYSTKO INNE → bursztynowy.
 *
 * ⚠ Fixture `GET_selly_log.json` ma w tym polu `"zakonczono"`, nie `"success"`, więc
 * realne wpisy z produkcji lądują w gałęzi „warn". To nie jest błąd portu — tak samo
 * zachowuje się oryginał.
 */
export function wariantStatusuOperacji(status: string | null | undefined): StanWskaznika {
  if (status === "success") return "ok";
  if (status === "error") return "blad";
  return "ladowanie";
}

/** Kropka statusu połączenia — `selly-injection.js:552-561`. */
export function stanPolaczenia(
  ladowanie: boolean,
  blad: boolean,
  ok: boolean | undefined,
): StanWskaznika {
  if (ladowanie) return "ladowanie";
  if (blad || !ok) return "blad";
  return "ok";
}

/**
 * Kropka statusu pliku CSV — `selly-injection.js:574-580`.
 * Kryterium OK jest po stronie API (`status: "ok"`), panel go nie przelicza.
 */
export function stanPlikuCsv(
  ladowanie: boolean,
  blad: boolean,
  status: string | undefined,
): StanWskaznika {
  if (ladowanie) return "ladowanie";
  if (blad) return "blad";
  return status === "ok" ? "ok" : "blad";
}

/**
 * Sortowanie kodów dostawców numerycznie: MO1, MO2, …, MO10.
 * Zwykły sort tekstowy dałby MO1, MO10, MO2 — ten sam zabieg co w zakładkach katalogu
 * (`pages/Katalog.tsx`, `frontend-index.js:23283`).
 */
export function posortujKodyDostawcow(kody: string[]): string[] {
  return [...kody].sort(
    (a, b) =>
      (parseInt(a.replace(/\D/g, ""), 10) || 0) - (parseInt(b.replace(/\D/g, ""), 10) || 0),
  );
}
