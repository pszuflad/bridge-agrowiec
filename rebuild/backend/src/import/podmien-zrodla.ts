import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { eq } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { suppliers } from "../db/schema.js";
import { czyStareZrodlo, folderDostawcy, folderZUrl } from "./katalog-importow.js";

/** Katalog główny folderów cenników na produkcji (`$IMPORTY_KATALOG` go nadpisuje). */
export const DOMYSLNY_KATALOG_IMPORTOW = "/home/admin/domains/agroopony.eu/public_html/imports/selly-agroopony";

/** Dostawcy, którzy zostają na swoich zewnętrznych adresach (decyzja użytkownika). */
const ZOSTAJA = new Set(["MO2", "MO3"]);

/**
 * Lokalna ścieżka (zwykła lub `file://`) leżąca BEZPOŚREDNIO w katalogu `imports/` nad folderami dostawców —
 * np. produkcyjne `…/imports/agrorami.csv` (MO9). Ścieżek do konkretnych plików WEWNĄTRZ folderu dostawcy
 * (MO4 `agrowiec_wr.csv`, MO5 `agrowiec_mw.csv`) nie ruszamy: to jawny wybór pliku i nie wolno go zastąpić
 * „najnowszym plikiem folderu” bez sprawdzenia, co jest w pozostałych (MO5 ma też `agrowiec_suma.csv`).
 */
export function czyPlikWKatalogu(url: string | null, katalog: string): boolean {
  if (!url) return false;
  const sciezka = url.replace(/^file:\/\//i, "");
  if (!sciezka.startsWith("/")) return false;
  return dirname(resolve(sciezka)) === dirname(resolve(katalog));
}

export type WynikPodmiany = { zmiany: string[]; braki: string[] };

/**
 * Podmiana starych źródeł (pusty URL / agroopony.eu/imports) na `plik://<folder dostawcy>` — folder
 * widać wtedy w panelu. Idempotentna: dotyka tylko starych źródeł, więc ponowne uruchomienie nic nie zmienia.
 */
export function podmienZrodla(db: Baza, katalog: string): WynikPodmiany {
  const wynik: WynikPodmiany = { zmiany: [], braki: [] };
  for (const d of db.select().from(suppliers).all()) {
    if (ZOSTAJA.has(d.kod) || folderZUrl(d.url)) continue;
    if (!czyStareZrodlo(d.url) && !czyPlikWKatalogu(d.url, katalog)) continue;
    const folder = folderDostawcy(katalog, d.kod);
    if (!folder) {
      wynik.braki.push(`${d.kod}: brak folderu w ${katalog}`);
      continue;
    }
    db.update(suppliers).set({ url: `plik://${folder}` }).where(eq(suppliers.id, d.id)).run();
    wynik.zmiany.push(`${d.kod}: → plik://${folder}`);
  }
  return wynik;
}

export const czyKatalogIstnieje = (katalog: string): boolean => existsSync(katalog);
