/**
 * Codzienny eksport CSV, po który Selly przychodzi samo — port
 * `mirror/backend/generate_selly_export.cjs`.
 *
 * W produkcji ten plik generuje cron ok. 6:00, a `POST /api/selly/generate-csv` jest
 * przyciskiem awaryjnym „zrób to teraz". Format odwzorowuje plik wzorcowy uzgodniony
 * z Selly: 59 kolumn, separator `;`, BOM UTF-8, złamania `\r\n`.
 *
 * ODSTĘPSTWO ŚWIADOME W SPOSOBIE URUCHOMIENIA (plan.md D5, decyzja użytkownika 2026-09-04):
 * oryginał odpala PODPROCES (`execFile(process.execPath, [generate_selly_export.cjs])`,
 * `routes.cjs:346-353`), który otwiera własne połączenie do SQLite. My generujemy
 * in-process. Wynik bajtowy jest identyczny; różnica dotyczy wyłącznie tego, gdzie liczy się
 * pętla. Skutki uboczne tej zmiany, świadomie przyjęte:
 *  - `stdout` w odpowiedzi trasy składamy z tych samych czterech linii, które wypisywał
 *    skrypt — jest syntetyczny, nie przechwycony;
 *  - generowanie blokuje pętlę zdarzeń na czas zapisu (~7 tys. wierszy, rzędu setek ms),
 *    podczas gdy podproces jej nie blokował. Trasa i tak stoi za `requireAuth` i jest
 *    ręcznym przyciskiem awaryjnym, więc to nie jest ścieżka gorąca.
 *
 * ⚠ TRZY TRANSFORMACJE, KTÓRE WYGLĄDAJĄ NA BŁĘDY, A SĄ UZGODNIONE Z SELLY:
 *  1. `Kod-dostawcy` bierze kolumnę `kod` (nie `kod_dostawcy`) i USUWA z niej podkreślniki:
 *     `MO9_336320` → `MO9336320`. Zgodnie z plikiem wzorcowym wysłanym do Selly.
 *  2. Kolumny boolowskie oddają napis `"Tak"` albo PUSTE pole — nie `1`/`0`
 *     (zmiana z 2026-07-24 na prośbę Selly).
 *  3. `cena_sprzedazy` to `"123,-"`, czyli część całkowita plus przecinek i myślnik —
 *     nie liczba (zmiana z 2026-07-31).
 */

import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { asc, eq } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { products } from "../db/schema.js";
import type { ProduktWewnetrzny } from "../repos/products.js";

/** BOM — bez niego Excel czyta plik jako windows-1250 i zamienia „ą" w krzaki. */
const BOM = "﻿";

/**
 * 59 kolumn w kolejności z pliku wzorcowego (`generate_selly_export.cjs:13-74`).
 * `null` w drugim polu = kolumna zawsze pusta (nie ma jej w bazie) — dotyczy `Promocja`.
 *
 * Klucze po prawej to nazwy pól drizzle (camelCase), nie nazwy kolumn SQL — to jedyna
 * różnica wobec oryginału, który czytał `SELECT *` i indeksował po `snake_case`.
 */
const KOLUMNY: readonly (readonly [string, keyof ProduktWewnetrzny | null])[] = [
  ["Nazwa-produktu", "nazwa"],
  ["Kod-importu", "kodImportu"],
  ["Dost", "dostawca"],
  ["Producent-opony", "marka"],
  ["Cena-zakupu", "cenaZakupu"],
  ["marza_pct", "marzaPct"],
  ["cena_sprzedazy", "cenaSprzedazy"],
  ["Promocja", null],
  ["Stan-magazynowy", "stan"],
  ["Kod-dostawcy", "kod"],
  ["EAN", "ean"],
  ["Rozmiar", "rozmiar"],
  ["Rozmiar-alternatywny", "rozmiarAlternatywny"],
  ["Bieznik/model", "model"],
  ["Szerokosc-opony-mm", "szerokosc"],
  ["Profil", "profil"],
  ["Srednica", "srednica"],
  ["Dlugosc-paczki-cm", "dlugosc"],
  ["Szerokosc-paczki-cm", "szerokoscPaczki"],
  ["Wysokosc-paczki-cm", "wysokosc"],
  ["Wysokosc-przesylki-cm", "wysokoscPrzesylki"],
  ["Indeks-nosnosci", "indeksNosnosci"],
  ["Indeks-predkosci", "indeksPredkosci"],
  ["Indeksy", "indeksy"],
  ["Kategoria", "kategoria"],
  ["DOT", "dot"],
  ["Waga", "waga"],
  ["TL/TT", "tlTt"],
  ["PR", "pr"],
  ["R/D", "konstrukcja"],
  ["IF/VF", "vfIf"],
  ["Oznaczenie-bieznika", "oznaczenieBieznika"],
  ["Link-do-zdjecia", "linkZdjecia"],
  ["Sezon", "sezon"],
  ["Bloto+snieg", "ms"],
  ["Snieg-3PMSF", "snow3pmsf"],
  ["Wentyl", "wentyl"],
  ["CFO", "cfo"],
  ["SF", "sf"],
  ["SB", "sb"],
  ["NRO", "nro"],
  ["CHO", "cho"],
  ["HF", "hf"],
  ["LS", "ls"],
  ["Reinforced", "reinforced"],
  ["ExtraLoad", "extraLoad"],
  ["CutResistant", "cutResistant"],
  ["HeatResistant", "heatResistant"],
  ["StubbleResistant", "stubbleResistant"],
  ["Dostepnosc", "dostepnosc"],
  ["Opor-toczenia", "labelRolling"],
  ["Przyczepnosc", "labelWet"],
  ["Halas", "labelNoise"],
  ["Lod", "labelIce"],
  ["Snieg", "labelSnow"],
  ["vat", "vat"],
  ["status", "status"],
  ["Zastosowanie", "zastosowanie"],
  ["data_aktualizacji", "dataAktualizacji"],
] as const;

/** Liczba kolumn — wystawiona, bo trafia do `stdout` odpowiedzi trasy. */
export const LICZBA_KOLUMN = KOLUMNY.length;

/**
 * Kolumny oddawane jako `"Tak"` / puste (`generate_selly_export.cjs:76`).
 *
 * ⚠ W drizzle te pola są już `boolean` (`db/schema.ts`, dopieszczenie D5 z I2), a w oryginale
 * były surowymi `0`/`1` z SQLite. Warunek `v ? "Tak" : ""` działa tak samo dla obu — `false`
 * i `0` dają puste pole, `true` i `1` dają `"Tak"`.
 */
const KOLUMNY_BOOL = new Set<keyof ProduktWewnetrzny>([
  "reinforced",
  "extraLoad",
  "cutResistant",
  "heatResistant",
  "stubbleResistant",
  "nro",
  "cho",
  "ms",
  "snow3pmsf",
  "cfo",
]);

/**
 * Port `esc()` (`generate_selly_export.cjs:78-85`). Cudzysłów zakładany na pola z `;`, `"`,
 * `\n` lub `\r`; `null`/`undefined` → puste pole.
 *
 * ⚠ To NIE jest `escapujKomorke` z `analityka/csv.ts`, mimo identycznej treści warunku.
 * Tamten moduł opisuje format eksportu analityki (łącznik `\n`, nagłówek z kluczy wiersza),
 * ten — format uzgodniony z Selly (łącznik `\r\n`, nagłówek stały). Wspólny helper związałby
 * ze sobą dwa formaty, które mogą się rozejść niezależnie; kopia jest tu tańsza niż to
 * sprzężenie.
 */
function esc(wartosc: unknown): string {
  if (wartosc === null || wartosc === undefined) return "";
  const tekst = String(wartosc);
  return /[;"\n\r]/.test(tekst) ? `"${tekst.replace(/"/g, '""')}"` : tekst;
}

/**
 * Buduje treść pliku — port pętli głównej (`generate_selly_export.cjs:87-114`).
 * Tylko produkty `status='aktywny'`, kolejność po `id`. Plik kończy się `\r\n`.
 */
export function zbudujCsvSelly(db: Baza): { tresc: string; wiersze: number } {
  const aktywne = db
    .select()
    .from(products)
    .where(eq(products.status, "aktywny"))
    .orderBy(asc(products.id))
    .all();

  const linie: string[] = [KOLUMNY.map(([naglowek]) => naglowek).join(";")];

  for (const produkt of aktywne) {
    linie.push(
      KOLUMNY.map(([naglowek, pole]) => {
        if (!pole) return "";
        let wartosc: unknown = produkt[pole];

        if (KOLUMNY_BOOL.has(pole)) wartosc = wartosc ? "Tak" : "";
        if (naglowek === "Kod-dostawcy" && typeof wartosc === "string") {
          wartosc = wartosc.replace(/_/g, "");
        }
        if (naglowek === "cena_sprzedazy" && typeof wartosc === "number") {
          wartosc = `${Math.floor(wartosc)},-`;
        }
        return esc(wartosc);
      }).join(";"),
    );
  }

  return { tresc: BOM + linie.join("\r\n") + "\r\n", wiersze: aktywne.length };
}

/** Gdzie leży plik i pod jakim adresem widzi go Selly (env, plan.md D4). */
export type SciezkiCsvSelly = {
  katalog: string;
  plik: string;
  url: string;
};

/** Pełna ścieżka pliku — jedno miejsce, zamiast dwóch zahardkodowanych stałych oryginału. */
export function sciezkaPliku(sciezki: SciezkiCsvSelly): string {
  return join(sciezki.katalog, sciezki.plik);
}

/** Odpowiedź `GET /api/selly/csv-status` — kształt z `contract/fixtures/GET_selly_csv-status.json`. */
export type StatusCsv =
  | { ok: false; exists: false; status: "blad"; powod: string; url: string }
  | {
      ok: boolean;
      exists: true;
      status: "ok" | "blad";
      powod: string | null;
      ostatnia_synchronizacja: string;
      wygenerowany_dzisiaj: boolean;
      wiek_minut: number;
      wiersze: number | null;
      rozmiar_bajty: number;
      rozmiar_mb: number;
      url: string;
    };

/**
 * Port `csv-status` (`routes.cjs:298-342`).
 *
 * ⚠ ODPOWIEDŹ „BRAKUJE PLIKU" MA INNY KSZTAŁT niż odpowiedź „plik jest": pięć kluczy zamiast
 * jedenastu, bez `ostatnia_synchronizacja`, `wiersze` itd. To nie przeoczenie oryginału —
 * frontend rozgałęzia się na `exists`. Fixture zamraża wariant z plikiem.
 *
 * ⚠ Wiersze liczone są znakami `\n` MINUS jeden (nagłówek). Plik kończy się `\r\n`, więc
 * liczba `\n` = nagłówek + wiersze danych. Nieczytelny plik daje `wiersze: null`, a nie
 * błąd — i wtedy `ok` zależy już tylko od daty i rozmiaru.
 *
 * ⚠ „Dzisiaj" liczy się w strefie LOKALNEJ serwera (`getFullYear`/`getMonth`/`getDate`),
 * a `ostatnia_synchronizacja` wychodzi w UTC (`toISOString`). Przy cronie o 6:00 i serwerze
 * w Europe/Warsaw to bez znaczenia; zostaje 1:1.
 */
export function statusPlikuCsv(sciezki: SciezkiCsvSelly, teraz = new Date()): StatusCsv {
  const pelna = sciezkaPliku(sciezki);

  if (!existsSync(pelna)) {
    return {
      ok: false,
      exists: false,
      status: "blad",
      powod: "Brak pliku CSV",
      url: sciezki.url,
    };
  }

  const st = statSync(pelna);

  let wiersze: number | null = 0;
  try {
    const bufor = readFileSync(pelna);
    let licznik = 0;
    for (const bajt of bufor) if (bajt === 10) licznik++;
    wiersze = Math.max(0, licznik - 1);
  } catch {
    wiersze = null;
  }

  const mtime = st.mtime;
  const dzisiaj =
    mtime.getFullYear() === teraz.getFullYear() &&
    mtime.getMonth() === teraz.getMonth() &&
    mtime.getDate() === teraz.getDate();
  const wiekMinut = Math.round((teraz.getTime() - mtime.getTime()) / 60_000);

  const czyOk = dzisiaj && st.size > 0 && (wiersze === null || wiersze > 0);

  return {
    ok: czyOk,
    exists: true,
    status: czyOk ? "ok" : "blad",
    powod: czyOk ? null : !dzisiaj ? "Plik nie zostal wygenerowany dzisiaj" : "Plik pusty",
    ostatnia_synchronizacja: mtime.toISOString(),
    wygenerowany_dzisiaj: dzisiaj,
    wiek_minut: wiekMinut,
    wiersze,
    rozmiar_bajty: st.size,
    rozmiar_mb: +(st.size / 1_048_576).toFixed(2),
    url: sciezki.url,
  };
}

/** Odpowiedź `POST /api/selly/generate-csv` (`routes.cjs:359-365`). */
export type WynikGenerowania = {
  ok: true;
  czas_ms: number;
  wiersze: number;
  rozmiar_mb: number;
  ostatnia_synchronizacja: string;
  stdout: string;
};

/**
 * Generuje plik i oddaje jego statystyki — port `generate-csv` (`routes.cjs:345-368`).
 *
 * `stdout` odtwarza cztery linie, które wypisywał skrypt (`generate_selly_export.cjs:121-124`),
 * i jest przycinany do ostatnich 500 znaków, jak w oryginale. Katalog docelowy jest tworzony,
 * jeśli nie istnieje (`:116-118`).
 */
export function wygenerujCsvSelly(db: Baza, sciezki: SciezkiCsvSelly): WynikGenerowania {
  const t0 = Date.now();
  const pelna = sciezkaPliku(sciezki);

  mkdirSync(sciezki.katalog, { recursive: true });
  const { tresc, wiersze } = zbudujCsvSelly(db);
  writeFileSync(pelna, tresc, "utf8");

  const st = statSync(pelna);
  const stdout = [
    `Zapisano: ${pelna}`,
    `Liczba produktow (aktywnych): ${wiersze}`,
    `Liczba kolumn: ${LICZBA_KOLUMN}`,
    `Rozmiar pliku (bajty): ${st.size}`,
    "",
  ].join("\n");

  return {
    ok: true,
    czas_ms: Date.now() - t0,
    wiersze,
    rozmiar_mb: +(st.size / 1_048_576).toFixed(2),
    ostatnia_synchronizacja: st.mtime.toISOString(),
    stdout: stdout.slice(-500),
  };
}
