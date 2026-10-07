import { existsSync } from "node:fs";

import { eq } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { suppliers } from "../db/schema.js";
import { czyStareZrodlo, folderDostawcy, folderZUrl } from "./katalog-importow.js";

/** Katalog główny folderów cenników na produkcji (`$IMPORTY_KATALOG` go nadpisuje). */
export const DOMYSLNY_KATALOG_IMPORTOW = "/home/admin/domains/agroopony.eu/public_html/imports/selly-agroopony";

/** Dostawcy, którzy zostają na swoich zewnętrznych adresach (decyzja użytkownika). */
const ZOSTAJA = new Set(["MO2", "MO3"]);

/**
 * Podmiana starych źródeł (pusty URL / agroopony.eu/imports) na `plik://<folder dostawcy>` — folder
 * widać wtedy w panelu. Idempotentna: dotyka tylko starych źródeł, więc ponowne uruchomienie nic nie zmienia.
 */
export function podmienZrodla(db: Baza, katalog: string): string[] {
  const opis: string[] = [];
  for (const d of db.select().from(suppliers).all()) {
    if (ZOSTAJA.has(d.kod) || folderZUrl(d.url) || !czyStareZrodlo(d.url)) continue;
    const folder = folderDostawcy(katalog, d.kod);
    if (!folder) {
      opis.push(`${d.kod}: brak folderu w ${katalog}`);
      continue;
    }
    db.update(suppliers).set({ url: `plik://${folder}` }).where(eq(suppliers.id, d.id)).run();
    opis.push(`${d.kod}: → plik://${folder}`);
  }
  return opis;
}

export const czyKatalogIstnieje = (katalog: string): boolean => existsSync(katalog);
