/**
 * Zbiorcza historia pozycji usuniętych z Selly (Tor 3) — ticket 195, NOWA funkcja (oryginał nie usuwał nic z Selly).
 *
 * Jeden wiersz tabeli `selly_usuniecia` na każdą usuniętą pozycję, bez limitu długości — w odróżnieniu od
 * `selly_sync_log.szczegoly_json` (jeden wpis na przebieg, przycinany do 8000 znaków). Zapisuje ją
 * `usunSierotyZSelly` obok wpisu w `audit_log`; tu jest zapis, lista (z paginacją) i eksport CSV całości.
 */
import { BOM, escapujKomorke } from "../analityka/csv.js";
import type { Baza } from "../db/index.js";

export type AkcjaUsuniecia = "usunieto_wariant" | "usunieto_produkt" | "juz_nie_istnial";

export type PozycjaUsuniecia = {
  kod: string;
  dostawca: string;
  kod_importu: string;
  nazwa: string | null;
  ean: string | null;
  selly_product_id: number;
  selly_variant_id: number | null;
  akcja: AkcjaUsuniecia;
  /** UTC `YYYY-MM-DD HH:MM:SS`. */
  czas: string;
};

export type WierszUsuniecia = {
  id: number;
  usunieto_at: string;
  przebieg_id: number | null;
  kod: string;
  nazwa: string | null;
  ean: string | null;
  dostawca: string;
  kod_importu: string;
  selly_product_id: number;
  selly_variant_id: number | null;
  akcja: AkcjaUsuniecia;
};

/** Kolumny listy i CSV — jawna projekcja, kolejność = kolejność kolumn pliku. */
const KOLUMNY = [
  "id",
  "usunieto_at",
  "przebieg_id",
  "kod",
  "nazwa",
  "ean",
  "dostawca",
  "kod_importu",
  "selly_product_id",
  "selly_variant_id",
  "akcja",
] as const;

const SELECT = `SELECT ${KOLUMNY.join(", ")} FROM selly_usuniecia ORDER BY usunieto_at DESC, id DESC`;

export const DOMYSLNY_LIMIT_USUNIEC = 20;
export const MAKS_LIMIT_USUNIEC = 200;

export function zapiszUsuniecie(db: Baza, przebiegId: number | null, w: PozycjaUsuniecia): void {
  db.$client
    .prepare(
      `INSERT INTO selly_usuniecia
         (usunieto_at, przebieg_id, kod, nazwa, ean, dostawca, kod_importu, selly_product_id, selly_variant_id, akcja)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(w.czas, przebiegId, w.kod, w.nazwa, w.ean, w.dostawca, w.kod_importu, w.selly_product_id, w.selly_variant_id, w.akcja);
}

/** Najnowsze pierwsze. `limit` obcięty do `1..MAKS_LIMIT_USUNIEC`, `offset` nie mniejszy niż 0. */
export function listaUsuniec(
  db: Baza,
  limit: number = DOMYSLNY_LIMIT_USUNIEC,
  offset = 0,
): { items: WierszUsuniecia[]; total: number } {
  const l = Math.min(Math.max(Math.trunc(limit) || DOMYSLNY_LIMIT_USUNIEC, 1), MAKS_LIMIT_USUNIEC);
  const o = Math.max(Math.trunc(offset) || 0, 0);
  const total = (db.$client.prepare("SELECT COUNT(*) c FROM selly_usuniecia").get() as { c: number }).c;
  const items = db.$client.prepare(`${SELECT} LIMIT ? OFFSET ?`).all(l, o) as WierszUsuniecia[];
  return { items, total };
}

/**
 * Cała historia jako CSV: BOM + średnik + `\n` (wzorzec `analityka/csv.ts`). Przy pustej historii oddaje BOM i wiersz
 * nagłówka — plik z samym znacznikiem wyglądałby jak błąd.
 */
export function csvUsuniec(db: Baza): string {
  const wiersze = db.$client.prepare(SELECT).all() as WierszUsuniecia[];
  const linie = [
    KOLUMNY.join(";"),
    ...wiersze.map((w) => KOLUMNY.map((k) => escapujKomorke(w[k])).join(";")),
  ];
  return BOM + linie.join("\n");
}
