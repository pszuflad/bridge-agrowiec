import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

/**
 * Lokalne foldery cenników dostawców (po wyłączeniu starych adresów `agroopony.eu/imports/…`).
 *
 * Katalog główny (`IMPORTY_KATALOG`) ma podfoldery `<KOD>_<losowy sufiks>` (np. `MO4_rfkP…`) —
 * folder dostawcy znajdujemy po prefiksie kodu, więc sufiksów (część nazwy folderu, nie sekret,
 * ale nie ma po co ich trzymać w publicznym repo) nie ma w kodzie ani w konfiguracji.
 * Plik dostawcy = NAJNOWSZY (wg czasu modyfikacji) `.csv`/`.xlsx`/`.xls` w jego folderze —
 * ludzie wgrywają je po FTP pod dowolną nazwą, nazwa nie jest kontraktem.
 */

const ROZSZERZENIA = new Set([".csv", ".xlsx", ".xls"]);

/** `plik:///ścieżka/folderu` → `/ścieżka/folderu` (adres wpisany do pola URL dostawcy przez podmianę źródeł). */
export function folderZUrl(url: string | null): string | null {
  const m = url ? /^plik:\/\/(\/.+)$/i.exec(url.trim()) : null;
  return m ? m[1]!.replace(/\/+$/, "") : null;
}

/** Stare źródło = brak URL-a albo plik na `agroopony.eu/imports/` (ten adres znika). */
export function czyStareZrodlo(url: string | null): boolean {
  if (!url) return true;
  if (folderZUrl(url)) return true;
  try {
    const u = new URL(url);
    return /(^|\.)agroopony\.eu$/i.test(u.hostname) && u.pathname.startsWith("/imports/");
  } catch {
    return false;
  }
}

/** Folder dostawcy w katalogu głównym albo `null`, gdy go nie ma. */
export function folderDostawcy(katalog: string, kod: string): string | null {
  let wpisy: string[];
  try {
    wpisy = readdirSync(katalog);
  } catch {
    return null;
  }
  const prefiks = `${kod}_`; // `MO1_` nie łapie `MO10_`
  const nazwa = wpisy.find((w) => w.startsWith(prefiks) && statSync(join(katalog, w)).isDirectory());
  return nazwa ? join(katalog, nazwa) : null;
}

export type PlikZFolderu = { sciezka: string; nazwa: string; bufor: Buffer };

/** Najnowszy cennik w folderze dostawcy; błąd z czytelną treścią, gdy folderu lub pliku brak. */
export function najnowszyPlik(katalog: string, kod: string, url: string | null = null): PlikZFolderu {
  const folder = folderZUrl(url) ?? folderDostawcy(katalog, kod);
  if (!folder) throw new Error(`Brak folderu dostawcy ${kod} w ${katalog}`);
  let nazwy: string[];
  try {
    nazwy = readdirSync(folder);
  } catch {
    throw new Error(`Brak folderu dostawcy ${kod}: ${folder}`);
  }
  const pliki = nazwy
    .filter((n) => !n.startsWith(".") && ROZSZERZENIA.has(extname(n).toLowerCase()))
    .map((n) => ({ n, mtime: statSync(join(folder, n)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (pliki.length === 0) throw new Error(`Brak pliku CSV/XLSX w folderze dostawcy ${kod}`);
  const sciezka = join(folder, pliki[0]!.n);
  return { sciezka, nazwa: pliki[0]!.n, bufor: readFileSync(sciezka) };
}

const polaCsv = (v: unknown): string => {
  const t = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[";\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

/** Rekordy z API → CSV (średnik, BOM) zapisany atomowo (tmp + rename) w folderze dostawcy. */
export function zapiszCsvZRekordow(
  katalog: string,
  kod: string,
  nazwaPliku: string,
  rekordy: unknown[],
  url: string | null = null,
): Buffer {
  const folder = folderZUrl(url) ?? folderDostawcy(katalog, kod);
  if (!folder) throw new Error(`Brak folderu dostawcy ${kod} w ${katalog}`);
  const wiersze = rekordy.filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null);
  const kolumny = [...new Set(wiersze.flatMap((r) => Object.keys(r)))];
  const tresc =
    "﻿" +
    [kolumny.map(polaCsv).join(";"), ...wiersze.map((r) => kolumny.map((k) => polaCsv(r[k])).join(";"))].join("\r\n") +
    "\r\n";
  const docelowy = join(folder, nazwaPliku);
  const tymczasowy = `${docelowy}.tmp-${process.pid}`;
  mkdirSync(folder, { recursive: true });
  try {
    writeFileSync(tymczasowy, tresc, "utf8");
    renameSync(tymczasowy, docelowy);
  } catch (e) {
    rmSync(tymczasowy, { force: true });
    throw e;
  }
  return Buffer.from(tresc, "utf8");
}
