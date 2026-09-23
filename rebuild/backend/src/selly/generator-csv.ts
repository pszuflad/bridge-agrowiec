/**
 * Codzienny eksport CSV, po który Selly przychodzi samo — port
 * `mirror/backend/generate_selly_export.cjs`.
 *
 * W produkcji ten plik generuje cron ok. 6:00, a `POST /api/selly/generate-csv` jest
 * przyciskiem awaryjnym „zrób to teraz". Format odwzorowuje plik wzorcowy uzgodniony
 * z Selly: 60 kolumn, separator `;`, BOM UTF-8, złamania `\r\n`.
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

import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { asc, eq, getTableColumns, type SQL, sql } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { products } from "../db/schema.js";
import type { ProduktWewnetrzny } from "../repos/products.js";

/** BOM — bez niego Excel czyta plik jako windows-1250 i zamienia „ą" w krzaki. */
const BOM = "﻿";

/**
 * 60 kolumn w kolejności z pliku wzorcowego (`generate_selly_export.cjs:14-75`, stan `88fa31c`).
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
  ["Blokowane-formy-platnosci", "blokowaneFormyPlatnosci"],
] as const;

/** Liczba kolumn — wystawiona, bo trafia do `stdout` odpowiedzi trasy. */
export const LICZBA_KOLUMN = KOLUMNY.length;

/** Surowa wartość flagi — dokładnie to, co oddaje SQLite, bez mappera boolean drizzle. */
type WartoscSurowaFlagi = string | number | null;

/**
 * Dziesięć kolumn oddawanych jako `"Tak"` / puste (`boolCols`,
 * `generate_selly_export.cjs:76`) — czytanych SUROWO, z pominięciem mappera drizzle.
 *
 * ⚠ TE KOLUMNY MAJĄ W BAZIE MIESZANE TYPY i dlatego NIE WOLNO ich tu czytać przez model.
 * SQLite pozwala trzymać tekst w kolumnie `INTEGER`, a import z tego korzysta: obok `0`/`1`
 * siedzi napis `'Tak'`. Pomiar na kopii produkcji z 23.09 (5396 produktów `status='aktywny'`,
 * wpis backlogu #153.1): `snow_3pmsf` 750 × `'Tak'`, `ms` 713, `cfo` 52, `nro` 12, `cho` 10,
 * `stubble_resistant` 1 (wiersz nieaktywny).
 *
 * W modelu te pola są `integer({ mode: "boolean" })` (`db/schema.ts:71-77`), a mapper drizzle
 * robi `Number(v) === 1` — więc tekst `'Tak'` stawał się `false` i `wartosc ? "Tak" : ""`
 * wypisywało PUSTE pole. Produkcyjny generator czyta `SELECT *` przez `better-sqlite3`
 * i dostaje wartość surową, dlatego wypisywał `Tak`. Efekt rozjazdu: 899 z 5396 wierszy
 * (17% katalogu) traciło oznaczenia `Śnieg 3PMSF`, `M+S`, `CFO`, `NRO`, `CHO` — czyli cechy,
 * po których klient filtruje opony zimowe i specjalistyczne. Nic nie zgłaszało błędu: plik
 * miał poprawny nagłówek, poprawną liczbę wierszy i poprawne ceny.
 *
 * ⚠ MODELU NIE RUSZAMY (karta FIX.1). Oryginał trzyma te kolumny w tym samym trybie boolean
 * (`deminified/backend-index.cjs:43733-43752`), więc produkcyjne `GET /api/products` zwraca na
 * `'Tak'` to samo `false` co nasze — API jest wierne i ma takie zostać. Zmiana schematu
 * naprawiłaby CSV kosztem rozjazdu z `contract/fixtures/GET_products.json`.
 *
 * DLACZEGO `sql` OMIJA MAPPER: `mapResultRow` (`drizzle-orm/sqlite-core/utils.cjs:40-75`)
 * wybiera dekoder po typie pola — `is(field, Column)` daje `column.mapFromDriverValue`
 * (czyli `Number(v) === 1`), a `is(field, SQL)` daje `field.decoder`, którym bez `.mapWith()`
 * jest `noopDecoder` = `(v) => v` (`drizzle-orm/sql/sql.cjs:297`). Pole zbudowane jako
 * sql`${products.ms}` jest więc `SQL`, nie `Column`, i wartość wychodzi surowa.
 */
const FLAGI_SUROWE = {
  reinforced: sql<WartoscSurowaFlagi>`${products.reinforced}`,
  extraLoad: sql<WartoscSurowaFlagi>`${products.extraLoad}`,
  cutResistant: sql<WartoscSurowaFlagi>`${products.cutResistant}`,
  heatResistant: sql<WartoscSurowaFlagi>`${products.heatResistant}`,
  stubbleResistant: sql<WartoscSurowaFlagi>`${products.stubbleResistant}`,
  nro: sql<WartoscSurowaFlagi>`${products.nro}`,
  cho: sql<WartoscSurowaFlagi>`${products.cho}`,
  ms: sql<WartoscSurowaFlagi>`${products.ms}`,
  snow3pmsf: sql<WartoscSurowaFlagi>`${products.snow3pmsf}`,
  cfo: sql<WartoscSurowaFlagi>`${products.cfo}`,
} satisfies Partial<Record<keyof ProduktWewnetrzny, SQL<WartoscSurowaFlagi>>>;

/**
 * Które pola lecą przez warunek `"Tak"` / puste — WYPROWADZONE z `FLAGI_SUROWE`, żeby nie dało
 * się dopisać kolumny do jednego miejsca i zapomnieć o drugim. Rozjazd tych dwóch list jest
 * dokładnie tym błędem, który naprawia ten ticket, tylko w drugą stronę: kolumna czytana
 * surowo, a nieoznaczona jako boolowska, trafiłaby do pliku jako goły tekst `'Tak'`/`1`.
 */
const KOLUMNY_BOOL: ReadonlySet<keyof ProduktWewnetrzny> = new Set(
  Object.keys(FLAGI_SUROWE) as (keyof ProduktWewnetrzny)[],
);

/**
 * Blokowane formy płatności per magazyn — port `BLOCKED_PAYMENT_FORMS`
 * (`mirror/backend/payment_blocks.cjs:7-17`, backlog #73).
 *
 * ⚠ ŹRÓDŁEM KANONICZNYM TEJ MAPY JEST BAZA, nie ten plik: wartość kolumny
 * `products.blokowane_formy_platnosci` utrzymują triggery `products_blokowane_formy_ai/_au`
 * z `rebuild/schema/011_blokowane_formy_i_triggery.sql` (karta I15.1). Kopia tutaj jest
 * wyłącznie po to, żeby odtworzyć FALLBACK oryginału (niżej).
 *
 * ⚠ TA LISTA ŻYJE W CZTERECH MIEJSCACH i zmiana u Ani musi trafić do wszystkich:
 *  1. `rebuild/schema/011_blokowane_formy_i_triggery.sql` — triggery, źródło wartości w bazie;
 *  2. `rebuild/backend/src/import/legacy/payment_blocks.cjs` — kopia oryginału bajt w bajt,
 *     wniesiona kartą I15.2 (ticket 120) na potrzeby potoku importu;
 *  3. ten plik — fallback eksportu CSV;
 *  4. `rebuild/frontend/src/pages/katalog/formatowanie.tsx` — kolumna w `/katalog`.
 * Produkcja ma ten sam podział (`payment_blocks.cjs` + skrypt front-endowy); zweryfikowane
 * 2026-09-23, że wszystkie cztery są identyczne co do znaku.
 *
 * Świadomie NIE importujemy tu (2): `legacy/` to zawekowana kopia CJS należąca do potoku importu
 * (karta I15.2), z `require("better-sqlite3")` i zaszytą ścieżką produkcyjną na górze modułu.
 * Sprzęgnięcie z nim eksportu Selly byłoby decyzją projektową, nie porządkami — zgłoszone
 * koordynatorowi zamiast rozstrzygane po cichu.
 *
 * ⚠ MO6 (Uniglory) CELOWO NIE MA WPISU — CHANGELOG produkcji 2026-09-10 14:53: „nie będzie
 * na razie w sprzedaży". Dla MO6 i dla nieznanego dostawcy pole zostaje puste; to zamierzone
 * zachowanie, nie luka do załatania (backlog #101, zamknięte 2026-09-23).
 */
const BLOKOWANE_FORMY_PLATNOSCI: Readonly<Record<string, string>> = Object.freeze({
  MO1: "203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219",
  MO2: "201, 202, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219",
  MO3: "201, 202, 203, 204, 205, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219",
  MO4: "201, 202, 203, 204, 205, 206, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219",
  MO5: "201, 202, 203, 204, 205, 206, 207, 208, 211, 212, 213, 214, 215, 216, 217, 218, 219",
  MO7: "201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 213, 214, 215, 216, 217, 218, 219",
  MO8: "201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 215, 216, 217, 218, 219",
  MO9: "201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 217, 218, 219",
  MO10: "201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216",
});

/**
 * Port `getBlockedPaymentForms()` (`payment_blocks.cjs:19-22`) — fallback kolumny 60.
 *
 * Oryginał sięga po mapę dopiero wtedy, gdy kolumna w bazie jest PUSTA
 * (`generate_selly_export.cjs:142-144`). Na dziś to martwa gałąź: odczyt żywej bazy produkcji
 * (ticket **113**, 2026-09-23 — osobny ticket pomiarowy zamykający backlog #101) pokazał
 * **0 wierszy** z pustym polem na 8329 produktów, w żadnej grupie dostawcy. Gałąź zostaje jako
 * bezpiecznik dla wiersza wstawionego drogą omijającą trigger — i dlatego, że tak robi oryginał.
 */
function blokowaneFormyDlaDostawcy(kodDostawcy: unknown): string | null {
  const kod = String(kodDostawcy ?? "")
    .trim()
    .toUpperCase();
  return BLOKOWANE_FORMY_PLATNOSCI[kod] ?? null;
}

/** Nazwy kategorii sklepu Selly — port `sellyCategoryNames` (`generate_selly_export.cjs:77-83`). */
const NAZWY_KATEGORII_SKLEPU = new Map<string, string>([
  ["rolnicze", "Opony rolnicze"],
  ["rolnicze male", "Opony rolnicze"],
  ["lesne", "Opony leśne"],
  ["przemyslowe", "Opony przemysłowe"],
  ["ciezarowe", "Opony ciężarowe"],
]);

/**
 * Port `toSellyCategoryName()` (`generate_selly_export.cjs:85-95`, backlog #76).
 *
 * Integrator Selly o 12:00 przypisywał produkty do starych, ukrytych kategorii 7–10, bo CSV
 * niósł WEWNĘTRZNE nazwy Bridge (`Rolnicze`, `Leśne`…). Generator mapuje je na nazwy ŻYWYCH
 * kategorii sklepu; wartość spoza mapy przechodzi bez zmian (`raw`), a `null` daje pusty string.
 *
 * ⚠ `.replace(/ł/g, "l")` NIE JEST NADMIAROWE. `normalize("NFD")` rozkłada `ś`→`s`+znak
 * diakrytyczny, ale `ł` to OSOBNY punkt kodowy (U+0142) i NFD go nie rusza — więc
 * „Przemysłowe" po samej normalizacji zostaje „przemysłowe" i nie trafia w klucz
 * `przemyslowe`. Dokładnie ten błąd naprawiła druga łatka z 14.09
 * (`.bak_fix_polish_l_20260914_131800`): jedna z czterech kategorii zachowała starą nazwę.
 *
 * ⚠ Kolejność ma znaczenie: `ł`→`l` PO zdjęciu diakrytyków, bo `replace` na
 * zdekomponowanym tekście i tak nie zobaczyłby `ł` inaczej — trzymamy się kolejności oryginału.
 */
export function nazwaKategoriiSklepu(wartosc: unknown): string {
  if (wartosc === null || wartosc === undefined) return "";
  const surowa = String(wartosc).trim();
  const klucz = surowa
    .toLocaleLowerCase("pl-PL")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ł/g, "l")
    .replace(/\s+/g, " ");
  return NAZWY_KATEGORII_SKLEPU.get(klucz) ?? surowa;
}

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
    // Projekcja: całość modelu, ale dziesięć flag SUROWO — patrz komentarz `FLAGI_SUROWE`.
    // Bez tego mapper boolean drizzle zamienia napis `'Tak'` z bazy na `false` i flaga
    // wypada z pliku (wpis backlogu #153.1, 899 z 5396 wierszy).
    .select({ ...getTableColumns(products), ...FLAGI_SUROWE })
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
        if (naglowek === "Kategoria") {
          wartosc = nazwaKategoriiSklepu(wartosc);
        }
        if (naglowek === "Blokowane-formy-platnosci" && !wartosc) {
          wartosc = blokowaneFormyDlaDostawcy(produkt.dostawca);
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

/**
 * Zapis przez plik tymczasowy + `rename` — port `generate_selly_export.cjs:154-156`
 * (backlog #104, produkcja 2026-09-22).
 *
 * Po co: `rename` w obrębie jednego systemu plików jest atomowy, więc Selly przychodzące
 * po plik NIGDY nie zobaczy go w połowie zapisu (~2 MB, kilkaset ms). Wcześniej produkcja
 * pisała wprost w miejsce i przy pechowym zbiegu w czasie sklep zaciągał ucięty katalog.
 *
 * ⚠ Plik tymczasowy MUSI leżeć w tym samym katalogu co docelowy — `rename` przez granicę
 * systemu plików rzuca `EXDEV`. Stąd sufiks na pełnej ścieżce, a nie `os.tmpdir()`.
 *
 * ⚠ Ten zapis nadpisuje WYŁĄCZNIE plik CSV. Katalog eksportu na produkcji jest chroniony
 * `.htaccess` z białą listą IP (Selly + Agrowiec) i ten plik musi w nim zostać nietknięty —
 * `docs/cutover.md`, krok „Frontend na miejsce".
 */
function zapiszAtomowo(pelna: string, tresc: string): void {
  const tymczasowy = `${pelna}.tmp-${process.pid}`;
  try {
    writeFileSync(tymczasowy, tresc, "utf8");
    renameSync(tymczasowy, pelna);
  } catch (blad) {
    // Nieudany zapis nie może zostawić śmiecia obok pliku, po który przychodzi Selly.
    try {
      rmSync(tymczasowy, { force: true });
    } catch {
      /* sprzątanie jest best-effort — oryginalny błąd jest ważniejszy */
    }
    throw blad;
  }
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
  zapiszAtomowo(pelna, tresc);

  const st = statSync(pelna);
  const stdout = [
    `Zapisano: ${pelna}`,
    `Liczba produktow aktywnych: ${wiersze}`,
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
