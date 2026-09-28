/**
 * Formatowanie wartości panelu Selly — port 1:1 z `mirror/frontend/assets/selly-injection.js`.
 *
 * Każda funkcja odpowiada jednemu wyrażeniu z oryginału; numery linii przy funkcjach.
 * Trzymamy je osobno od komponentów, żeby dało się je przetestować bez montowania widoku.
 */

/** Stan wskaźnika przy nagłówku sekcji — odpowiednik klas `.dot` / `.err` / `.load`. */
export type StanWskaznika = "ok" | "blad" | "ladowanie";

/**
 * Wariant odznaki statusu operacji w logu.
 *
 * ⚠ Celowo OSOBNY typ od `StanWskaznika`, mimo że oryginał używa dla obu tych samych klas
 * CSS (`ok`/`err`/`warn`). Wpis w logu jest zakończony — „trwa ładowanie" nie jest jego
 * możliwym stanem, a wspólny typ kusił do mylącego mapowania `zakonczono → ladowanie`.
 */
export type WariantOperacji = "sukces" | "blad" | "inny";

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
 * Data ostatniej synchronizacji CSV — `selly-injection.js:585-587`.
 *
 * Sama data; wiek („(N min temu)") dokłada widok osobnym elementem, bo oryginał koloruje
 * go zależnie od `wygenerowany_dzisiaj` — zielono, gdy plik jest z dziś, bursztynowo gdy nie.
 * Sklejenie obu w jeden string uniemożliwiłoby to rozróżnienie.
 */
export function formatujDateSynchronizacji(znacznik: string | null | undefined): string {
  if (!znacznik) return "—";
  const data = new Date(znacznik);
  if (Number.isNaN(data.getTime())) return "—";
  return data.toLocaleString("pl-PL");
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
export function wariantStatusuOperacji(status: string | null | undefined): WariantOperacji {
  if (status === "success") return "sukces";
  if (status === "error") return "blad";
  return "inny";
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
