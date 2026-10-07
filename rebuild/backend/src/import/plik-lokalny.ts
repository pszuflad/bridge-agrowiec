// Ticket 194 (2026-10-07): cennik dostawcy z pliku na tym samym serwerze zamiast spod URL-a.
//
// Od 06/07.10 domena agroopony.eu wskazuje Selly — także w DNS samego serwera — więc URL-e
// `https://agroopony.eu/imports/...` przestały działać (MO4, MO5, MO9: „fetch failed”).
// Dostawcy wgrywają pliki przez FTP do `public_html/imports/selly-agroopony/<MOx_…>/`,
// czyli na serwer, na którym działa Bridge. W polu URL dostawcy można więc wpisać ścieżkę
// bezwzględną (`/home/admin/...`) albo `file:///home/admin/...`.
//
// Bezpieczeństwo: czytamy WYŁĄCZNIE spod katalogu `IMPORT_KATALOG_LOKALNY` (domyślnie
// katalog `imports` domeny) — ścieżka spoza niego, także przez `..` lub dowiązanie, jest odrzucana.
import { readFile, realpath } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const DOMYSLNY_KATALOG_LOKALNY =
  "/home/admin/domains/agroopony.eu/public_html/imports";

export class BrakPlikuLokalnego extends Error {}

/** Czy wartość pola URL dostawcy to plik lokalny (ścieżka bezwzględna albo `file://`). */
export function czyPlikLokalny(url: string): boolean {
  const u = String(url ?? "").trim();
  return u.startsWith("/") || u.toLowerCase().startsWith("file://");
}

function sciezkaZUrl(url: string): string {
  const u = url.trim();
  return u.toLowerCase().startsWith("file://") ? fileURLToPath(u) : u;
}

/** Czyta plik lokalny spod dozwolonego katalogu. Brak pliku → `BrakPlikuLokalnego`. */
export async function czytajPlikLokalny(
  url: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<Buffer> {
  const korzen = resolve(
    env.IMPORT_KATALOG_LOKALNY || DOMYSLNY_KATALOG_LOKALNY,
  );
  let sciezka: string;
  try {
    sciezka = await realpath(resolve(sciezkaZUrl(url)));
  } catch {
    throw new BrakPlikuLokalnego(`Brak pliku: ${url}`);
  }
  let korzenRzeczywisty = korzen;
  try {
    korzenRzeczywisty = await realpath(korzen);
  } catch {
    /* katalog nie istnieje — porównanie i tak odrzuci ścieżkę */
  }
  if (
    sciezka !== korzenRzeczywisty &&
    !sciezka.startsWith(korzenRzeczywisty + sep)
  ) {
    throw new Error(`Plik spoza dozwolonego katalogu importów: ${url}`);
  }
  return readFile(sciezka);
}
