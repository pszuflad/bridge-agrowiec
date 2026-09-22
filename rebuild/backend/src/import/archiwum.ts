import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";

/**
 * Archiwum plików importu — port zachowania `mirror/backend/archive_module.cjs:26-130, 245-258`.
 *
 * Po co istnieje (komentarz Anny z 2026-08-21): KAŻDY plik wpływający do systemu ma zostać
 * odłożony na dysk PRZED parsowaniem — także taki, który parsowania nie przeszedł. Bez tego
 * po nieudanym imporcie nie ma czego obejrzeć.
 *
 * Twarda zasada z oryginału, zachowana tutaj: **archiwum nigdy nie wywraca importu**.
 * Każda funkcja łapie własne wyjątki i zwraca `null`/`false` zamiast rzucać.
 *
 * ⚠ ODSTĘPSTWO ŚWIADOME (plan.md D11): oryginał trzyma katalog obok `__dirname`. My bierzemy
 * go z `IMPORT_ARCHIVE_DIR`, domyślnie `<cwd>/import_archive` — inaczej po `npm run build`
 * archiwum lądowałoby wewnątrz `dist/`, a testy pisałyby po repozytorium.
 *
 * Odczyt dla tras `/api/import-archive*` (lista, statystyki, pobranie pliku) — port
 * `archive_module.cjs:131-158, 168-238`, dopisany w tickecie 91 (karta PR.1). Zapis bez zmian.
 */

/** Retencja z oryginału: 7 dni (zmiana 90→7 na prośbę Anny, 2026-08-21). */
export const RETENCJA_DNI = 7;

/** Sufit rozmiaru archiwum — 5 GB. */
export const MAX_BAJTOW = 5 * 1024 * 1024 * 1024;

const MS_NA_DOBE = 86_400_000;

export function katalogArchiwum(env: NodeJS.ProcessEnv = process.env): string {
  return resolve(env.IMPORT_ARCHIVE_DIR ?? join(process.cwd(), "import_archive"));
}

export type ZrodloImportu = "auto-pull" | "from-url" | "upload";

export type OpcjeArchiwizacji = {
  dostawcaKod: string;
  oryginalnaNazwa?: string | null;
  zrodlo: ZrodloImportu;
  url?: string | null;
  uzytkownik?: string | null;
  status?: "ok" | "blad";
  blad?: string | null;
  rekordy?: number | null;
  parserErrors?: number | null;
  odrzucone?: number | null;
};

/** Plik `.meta.json` — 14 pól, dokładnie jak w oryginale (archive_module.cjs:66-80). */
export type MetaArchiwum = {
  id: string;
  dostawca: string;
  zrodlo: string;
  url: string | null;
  uzytkownik: string | null;
  data: string;
  oryginalnaNazwa: string | null;
  rozmiar: number;
  sha256: string;
  status: string;
  blad: string | null;
  rekordy: number | null;
  parserErrors: number | null;
  odrzucone: number | null;
};

export type WpisArchiwum = {
  id: string;
  sciezka: string;
  rozmiar: number;
  sha: string;
};

function zapewnijKatalog(katalog: string): string {
  if (!existsSync(katalog)) mkdirSync(katalog, { recursive: true });
  return katalog;
}

/** Nazwa pliku sprowadzona do bezpiecznych znaków, max 80 (archive_module.cjs:38-40). */
function bezpiecznaNazwa(nazwa: unknown): string {
  return String(nazwa || "plik").replace(/[^A-Za-z0-9._-]/g, "_").slice(-80) || "plik";
}

function sha256(bufor: Buffer): string {
  return createHash("sha256").update(bufor).digest("hex");
}

/**
 * Zapisuje bufor do archiwum wraz z plikiem `.meta.json`.
 *
 * Zwraca `null`, gdy bufor jest pusty albo cokolwiek się nie udało — wywołujący NIE musi
 * tego obsługiwać inaczej niż zapisując `archiwum: null` w odpowiedzi (produkcja robi
 * dokładnie to samo).
 */
export function archiwizujBufor(
  bufor: Buffer,
  opcje: OpcjeArchiwizacji,
  env: NodeJS.ProcessEnv = process.env,
): WpisArchiwum | null {
  try {
    if (!Buffer.isBuffer(bufor) || bufor.length === 0) return null;

    const korzen = zapewnijKatalog(katalogArchiwum(env));
    const teraz = new Date().toISOString();
    const katalogMiesiaca = zapewnijKatalog(join(korzen, teraz.slice(0, 7)));

    // Dokładnie ta transformacja co w oryginale (archive_module.cjs:57).
    //
    // ⚠ Komentarz w oryginale zapowiada `RRRRMMDD__GGMMSS`, ale `slice(0, 15)` ucina
    // jedną cyfrę za wcześnie: wychodzi `RRRRMMDD__GGMMS` (godzina, minuta i DZIESIĄTKI
    // sekund). Praktyczny skutek: dwa pliki tego samego dostawcy o tej samej nazwie,
    // wgrane w tym samym dziesięciosekundowym oknie, nadpisują się nawzajem.
    // Odtwarzamy to wiernie — naprawa zmieniłaby nazwy plików w archiwum, a te są
    // identyfikatorem (`meta.id`), po którym `aktualizujMeta` odnajduje wpis.
    const stempel = teraz.replace(/[-:]/g, "").replace("T", "__").slice(0, 15);
    const nazwa = `${String(opcje.dostawcaKod || "XX").toUpperCase()}__${stempel}__${bezpiecznaNazwa(
      opcje.oryginalnaNazwa,
    )}`;
    const sciezka = join(katalogMiesiaca, nazwa);

    writeFileSync(sciezka, bufor);

    const meta: MetaArchiwum = {
      id: `${teraz.slice(0, 7)}/${nazwa}`,
      dostawca: String(opcje.dostawcaKod || "").toUpperCase(),
      zrodlo: opcje.zrodlo || "nieznane",
      url: opcje.url || null,
      uzytkownik: opcje.uzytkownik || null,
      data: teraz,
      oryginalnaNazwa: opcje.oryginalnaNazwa || null,
      rozmiar: bufor.length,
      sha256: sha256(bufor),
      status: opcje.status || "ok",
      blad: opcje.blad || null,
      rekordy: opcje.rekordy ?? null,
      parserErrors: opcje.parserErrors ?? null,
      odrzucone: opcje.odrzucone ?? null,
    };
    writeFileSync(`${sciezka}.meta.json`, JSON.stringify(meta, null, 2));

    wymusRetencje(env);
    return { id: meta.id, sciezka, rozmiar: bufor.length, sha: meta.sha256 };
  } catch (e) {
    // Celowo: archiwum nie może wywrócić importu (archive_module.cjs:84-86).
    console.error("[archiwum] BŁĄD zapisu:", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Dokłada pola do istniejącego `.meta.json` (archive_module.cjs:245-258).
 *
 * Endpointy importu wołają to dwa razy: po parsowaniu (liczniki rekordów) i przy błędzie
 * (`status: "blad"`), bo w chwili archiwizacji te dane jeszcze nie istnieją.
 *
 * Kontrola `id.includes("..")` jest z oryginału — `id` pochodzi z zapisu, ale ta funkcja
 * jest wołana z danymi przechodzącymi przez warstwę HTTP, więc traversal zostaje zablokowany.
 */
export function aktualizujMeta(
  id: string,
  patch: Partial<MetaArchiwum>,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  try {
    if (!id || id.includes("..")) return false;
    const sciezkaMeta = join(katalogArchiwum(env), `${id}.meta.json`);
    if (!existsSync(sciezkaMeta)) return false;
    const meta = JSON.parse(readFileSync(sciezkaMeta, "utf8")) as MetaArchiwum;
    writeFileSync(sciezkaMeta, JSON.stringify({ ...meta, ...patch }, null, 2));
    return true;
  } catch (e) {
    console.error("[archiwum] BŁĄD aktualizacji meta:", e instanceof Error ? e.message : e);
    return false;
  }
}

export type PlikArchiwum = {
  pelna: string;
  nazwa: string;
  miesiac: string;
  rozmiar: number;
  mtimeMs: number;
};

/** Wszystkie pliki archiwum bez `.meta.json`, najstarsze pierwsze (archive_module.cjs:131-150). */
export function listaPlikow(env: NodeJS.ProcessEnv): PlikArchiwum[] {
  const korzen = katalogArchiwum(env);
  if (!existsSync(korzen)) return [];

  const wynik: PlikArchiwum[] = [];
  for (const miesiac of readdirSync(korzen)) {
    const katalog = join(korzen, miesiac);
    try {
      if (!statSync(katalog).isDirectory()) continue;
    } catch {
      continue;
    }
    for (const nazwa of readdirSync(katalog)) {
      if (nazwa.endsWith(".meta.json")) continue;
      const pelna = join(katalog, nazwa);
      try {
        const st = statSync(pelna);
        wynik.push({ pelna, nazwa, miesiac, rozmiar: st.size, mtimeMs: st.mtimeMs });
      } catch {
        /* plik zniknął w trakcie listowania — pomijamy, jak oryginał */
      }
    }
  }
  wynik.sort((a, b) => a.mtimeMs - b.mtimeMs);
  return wynik;
}

/**
 * Rotacja: najpierw wiek (7 dni), potem sufit rozmiaru (5 GB, od najstarszych).
 * Na koniec sprząta puste katalogi miesięcy. Port z archive_module.cjs:90-127.
 */
export function wymusRetencje(env: NodeJS.ProcessEnv = process.env): void {
  try {
    const pliki = listaPlikow(env);
    const prog = Date.now() - RETENCJA_DNI * MS_NA_DOBE;

    const doUsuniecia = new Set<PlikArchiwum>();
    for (const plik of pliki) if (plik.mtimeMs < prog) doUsuniecia.add(plik);

    let suma = pliki.reduce((s, p) => s + p.rozmiar, 0);
    for (const plik of pliki) {
      if (suma <= MAX_BAJTOW) break;
      doUsuniecia.add(plik);
      suma -= plik.rozmiar;
    }

    for (const plik of doUsuniecia) {
      try {
        unlinkSync(plik.pelna);
      } catch {
        /* już nie istnieje */
      }
      try {
        unlinkSync(`${plik.pelna}.meta.json`);
      } catch {
        /* już nie istnieje */
      }
    }

    const korzen = katalogArchiwum(env);
    for (const miesiac of readdirSync(korzen)) {
      const katalog = join(korzen, miesiac);
      try {
        if (statSync(katalog).isDirectory() && readdirSync(katalog).length === 0) {
          rmdirSync(katalog);
        }
      } catch {
        /* nie nasz problem — rotacja nie może wywrócić importu */
      }
    }
  } catch (e) {
    console.error("[archiwum] BŁĄD rotacji:", e instanceof Error ? e.message : e);
  }
}

/** `readMeta` z oryginału (archive_module.cjs:152-158): brak albo zepsuty plik → `null`. */
function czytajMeta(pelna: string): Partial<MetaArchiwum> | null {
  try {
    const sciezka = `${pelna}.meta.json`;
    if (existsSync(sciezka)) return JSON.parse(readFileSync(sciezka, "utf8")) as Partial<MetaArchiwum>;
  } catch {
    /* zepsuty JSON traktujemy jak brak — jak oryginał */
  }
  return null;
}

export type FiltryArchiwum = {
  dostawca?: string | undefined;
  miesiac?: string | undefined;
  status?: string | undefined;
};

/** Pozycja listy `GET /api/import-archive` — 11 pól, kolejność kluczy jak w oryginale (:181-193). */
export type PozycjaArchiwum = {
  id: string;
  dostawca: string;
  zrodlo: string | null;
  uzytkownik: string | null;
  data: string;
  oryginalnaNazwa: string;
  rozmiar: number;
  status: string;
  blad: string | null;
  rekordy: number | null;
  sha256: string | null;
};

/**
 * Lista archiwum, najnowsze pierwsze, z filtrami łączonymi koniunkcją (archive_module.cjs:169-195).
 *
 * Filtry dosłownie jak w oryginale: `dostawca` po `toUpperCase()` porównany z `meta.dostawca`
 * (plik bez meta nie przejdzie filtra dostawcy, mimo zastępczego `dostawca` z nazwy pliku),
 * `miesiac` — z nazwą KATALOGU, nie z `meta.data`; `status` — dosłownie z `meta.status`
 * (więc plik bez meta nie przejdzie też `?status=ok`, choć na liście pokazuje się jako `ok`).
 * Puste wartości filtrów = brak filtra (`|| null` w oryginale).
 *
 * `rozmiar` bierzemy ze `stat` pliku, nie z meta — jak oryginał.
 */
export function listaArchiwum(
  filtry: FiltryArchiwum,
  env: NodeJS.ProcessEnv = process.env,
): PozycjaArchiwum[] {
  const fDostawca = (filtry.dostawca ?? "").toUpperCase() || null;
  const fMiesiac = filtry.miesiac || null;
  const fStatus = filtry.status || null;

  const wynik: PozycjaArchiwum[] = [];
  for (const plik of listaPlikow(env).reverse()) {
    const meta = czytajMeta(plik.pelna) ?? {};
    if (fDostawca && meta.dostawca !== fDostawca) continue;
    if (fMiesiac && plik.miesiac !== fMiesiac) continue;
    if (fStatus && meta.status !== fStatus) continue;
    wynik.push({
      id: meta.id || `${plik.miesiac}/${plik.nazwa}`,
      dostawca: meta.dostawca || plik.nazwa.slice(0, 3),
      zrodlo: meta.zrodlo || null,
      uzytkownik: meta.uzytkownik || null,
      data: meta.data || new Date(plik.mtimeMs).toISOString(),
      oryginalnaNazwa: meta.oryginalnaNazwa || plik.nazwa,
      rozmiar: plik.rozmiar,
      status: meta.status || "ok",
      blad: meta.blad || null,
      rekordy: meta.rekordy ?? null,
      sha256: meta.sha256 || null,
    });
  }
  return wynik;
}

export type StatystykiArchiwum = {
  plikow: number;
  bajtow: number;
  limitBajtow: number;
  retencjaDni: number;
  perMiesiac: Record<string, number>;
};

/**
 * `GET /api/import-archive/stats` (archive_module.cjs:203-220). Klucze `perMiesiac` w kolejności
 * pierwszego wystąpienia na liście posortowanej rosnąco po `mtime` — tak iteruje oryginał.
 */
export function statystykiArchiwum(env: NodeJS.ProcessEnv = process.env): StatystykiArchiwum {
  const pliki = listaPlikow(env);
  const perMiesiac: Record<string, number> = {};
  for (const plik of pliki) perMiesiac[plik.miesiac] = (perMiesiac[plik.miesiac] ?? 0) + plik.rozmiar;
  return {
    plikow: pliki.length,
    bajtow: pliki.reduce((s, p) => s + p.rozmiar, 0),
    limitBajtow: MAX_BAJTOW,
    retencjaDni: RETENCJA_DNI,
    perMiesiac,
  };
}

export type WynikSzukaniaPliku =
  | { rodzaj: "plik"; sciezka: string; nazwa: string }
  | { rodzaj: "nieprawidlowe-id" }
  | { rodzaj: "brak" };

/**
 * Ścieżka pliku do pobrania z dwóch segmentów URL-a (archive_module.cjs:224-232).
 *
 * Ochrona przed path traversal JEST W ORYGINALE i odtwarzamy ją 1:1 (bez odstępstwa):
 * `month/name` po zdekodowaniu parametrów przez Express musi pasować do
 * `^\d{4}-\d{2}/[^/]+$` — więc `%2F` w nazwie (zdekodowany do `/`) odpada — i nie może
 * zawierać `..`. Po tym `join(korzen, id)` nie ma jak wyjść poza katalog miesiąca.
 *
 * Skutek uboczny zachowany: nazwa z dwiema kropkami obok siebie (np. `a..csv`) jest nie do
 * pobrania, choć `bezpiecznaNazwa` przy zapisie takie przepuszcza.
 */
export function szukajPlikuArchiwum(
  miesiac: string,
  nazwa: string,
  env: NodeJS.ProcessEnv = process.env,
): WynikSzukaniaPliku {
  const id = `${miesiac}/${nazwa}`;
  if (!/^\d{4}-\d{2}\/[^/]+$/.test(id) || id.includes("..")) return { rodzaj: "nieprawidlowe-id" };
  const sciezka = join(katalogArchiwum(env), id);
  if (!existsSync(sciezka)) return { rodzaj: "brak" };
  return { rodzaj: "plik", sciezka, nazwa: basename(sciezka) };
}
