/**
 * Mapper Bridge → Selly v2 — port `origin/main:mirror/backend/selly/mapper_v2.cjs`
 * (karta I15.7, ticket 109; produkcja zamrożona na 7d6cfc9).
 *
 * Konsumenci w oryginale: `sync_full.cjs` (`toSellyPayloadV2`, 3×) i `discovery.cjs:213`
 * (`buildProductPayload` przy auto-create). U nas `buildProductPayload` jest WSTRZYKIWANY do
 * `stworzDiscovery({ budujPayloadProduktu })` (decyzja D1 ticketu 108) — discovery mappera nie
 * importuje; montaż jednej instancji z tym mapperem to karta I15.8.
 *
 * Zasady z oryginału:
 *  - `provider_code` = `kod_importu` (nie `kod_dostawcy`, ten jest tylko rezerwą);
 *  - pełna mapa 21 cech (`Bieżnik / model` z kolumny `bieznik`, nie `model`);
 *  - ŚWIADOMIE bez `vat_rate` (Anna 2026-09-08: VAT nadawany w Selly na kategorii), bez
 *    `content_html`/`html_*`, `unit_of_measure`, `availability`, wymiarów paczki, `warehouse_id`
 *    (magazyn idzie cechą „Magazyny” na wariancie);
 *  - ŚWIADOMIE pomijane cechy: „Lód” (`label_ice` zepsute) i „Magazyny” (cecha wariantu).
 *
 * ⚠ Payload NIE niesie „blokowanych form płatności” — tego pola nie ma w żadnym pliku
 * `selly/*.cjs`; wysyłał je wyłącznie stary eksport CSV (`generate_selly_export.cjs:75,142`).
 * Kandydat na przyczynę backlogu #101 — opis w `docs/karty/I15.7/karta.md`.
 *
 * Pominięte martwe eksporty oryginału (decyzja D1 ticketu 109): `toDeltaPayload` (Tor 1 buduje
 * ciało sam) oraz `DOSTAWCA_TO_MAGAZYN_FEATURE_ID`/`getMagazynFeatureIdForDostawca` (discovery ma
 * własną mapę `WAREHOUSE_FEATURE_IDS`). Nikt ich w produkcji nie woła.
 */

import type { BudujPayloadProduktu } from "./discovery.js";

type Wartosc = string | number | boolean | null | undefined;

/**
 * Wiersz `products` (snake_case, jak z surowego SQL-a `collectFullSyncItems`). Wszystkie pola
 * opcjonalne, żeby `buildProductPayload` dało się podać discovery jako `BudujPayloadProduktu`
 * (discovery zna tylko `WierszBridge`, a w runtime dostaje pełny wiersz Toru 2).
 */
export type WierszMapperaV2 = {
  kod?: string | null;
  nazwa?: string | null;
  waga?: Wartosc;
  kod_importu?: string | null;
  kod_dostawcy?: string | null;
  cena_zakupu?: Wartosc;
  cena_sprzedazy?: Wartosc;
  status?: string | null;
  ean?: string | null;
  ean_is_valid?: Wartosc;
  kategoria?: string | null;
  marka?: string | null;
  bieznik?: Wartosc;
  rozmiar?: Wartosc;
  szerokosc?: Wartosc;
  profil?: Wartosc;
  srednica?: Wartosc;
  rozmiar_alternatywny?: Wartosc;
  konstrukcja?: Wartosc;
  pr?: Wartosc;
  tl_tt?: Wartosc;
  indeksy?: Wartosc;
  indeks_nosnosci?: Wartosc;
  indeks_predkosci?: Wartosc;
  dot?: Wartosc;
  zastosowanie?: Wartosc;
  label_wet?: Wartosc;
  label_rolling?: Wartosc;
  label_noise?: Wartosc;
  ms?: Wartosc;
  snow_3pmsf?: Wartosc;
  label_snow?: Wartosc;
};

/** Cecha produktu w payloadzie Selly — `{ name, values: [..] }`. */
export type CechaSelly = { name: string; values: unknown };

export type PayloadV2 = {
  name: string | null | undefined;
  weight: number;
  provider_code: string | null;
  price_purchase: number;
  visible: boolean;
  ean?: string;
  features?: CechaSelly[];
  category_id?: number;
  producer_id?: number;
  product_code?: string;
  price?: number;
};

// ---- Pomocnicze transformacje wartości cech (`mapper_v2.cjs:21-47`) ----

/**
 * Flaga Bridge (0/1/'Tak'/null/'') → 'Tak' albo `null`.
 * ⚠ Wartość spoza znanych (np. `false`, 'Nie') wraca jako tekst po `trim()` — tak jest w oryginale.
 */
export function yn(v: Wartosc): string | null {
  if (v === null || v === undefined || v === "" || v === 0 || v === "0") return null;
  if (v === 1 || v === "1" || v === true || v === "Tak" || v === "tak" || v === "TAK") return "Tak";
  const s = String(v).trim();
  return s || null;
}

export function txt(v: Wartosc): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/** Liczba jako tekst (`70` → `"70"`, `22.5` → `"22.5"`); nieliczba → `txt`. */
export function num(v: Wartosc): string | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (isNaN(n)) return txt(v);
  return n.toString();
}

/** `"Koparka + Ładowarka"` → `"Koparka"` — Selly dostaje tylko pierwsze zastosowanie. */
export function zastosowaniePierwsze(v: Wartosc): string | null {
  if (!v) return null;
  const first = String(v).split("+")[0]?.trim();
  return first || null;
}

type KolumnaCechy = keyof WierszMapperaV2;

/** Mapa 21 cech Bridge → Selly (`mapper_v2.cjs:50-72`) — nazwa Selly, kolumna Bridge, transformacja. */
export const FEATURE_MAP: readonly (readonly [string, KolumnaCechy, (v: Wartosc) => string | null])[] = [
  ["Bieżnik / model", "bieznik", txt],
  ["Rozmiar", "rozmiar", txt],
  ["Szerokość opony", "szerokosc", txt],
  ["Profil", "profil", num],
  ["Średnica", "srednica", num],
  ["Rozmiar alternatywny", "rozmiar_alternatywny", txt],
  ["R/D", "konstrukcja", txt],
  ["PR", "pr", txt],
  ["TL/TT", "tl_tt", txt],
  ["Indeksy", "indeksy", txt],
  ["Indeks nośności", "indeks_nosnosci", txt],
  ["Indeks prędkości", "indeks_predkosci", txt],
  ["DOT", "dot", txt],
  ["Zastosowanie", "zastosowanie", zastosowaniePierwsze],
  ["Przyczepność", "label_wet", txt],
  ["Opór toczenia", "label_rolling", txt],
  ["Hałas", "label_noise", txt],
  ["Błoto + śnieg", "ms", yn],
  ["Śnieg-3PMSF", "snow_3pmsf", yn],
  ["Śnieg", "label_snow", yn],
  ["Marka", "marka", txt],
];

/** Cechy z wiersza Bridge. Puste pomijane — nie kasujemy nimi niczego w Selly (`:77-87`). */
export function buildFeatures(row: WierszMapperaV2): CechaSelly[] {
  const features: CechaSelly[] = [];
  for (const [sellyName, bridgeCol, fn] of FEATURE_MAP) {
    const mapped = fn(row[bridgeCol]);
    if (mapped !== null && mapped !== undefined && mapped !== "") {
      features.push({ name: sellyName, values: [String(mapped)] });
    }
  }
  return features;
}

/**
 * Tryb lustra (`:94-115`, stan po `5dedefb`, backlog #81): dla cech już obecnych w Selly
 * wysyłamy wartość Bridge; cechy SPOZA mapy zachowujemy (żeby ich nie skasować); cechy z mapy,
 * których w Selly nie ma — dopisujemy na końcu.
 *
 * #81: cecha ZARZĄDZANA przez Bridge, która jest teraz pusta, NIE dziedziczy starej wartości
 * z Selly — znika z tablicy (PUT wysyła pełną tablicę, więc to ją kasuje).
 */
export function buildFeaturesMirror(
  row: WierszMapperaV2,
  existingFeatures: readonly CechaSelly[] | null | undefined,
): CechaSelly[] {
  const bridgeFeatures = buildFeatures(row);
  const bridgeByName = new Map(bridgeFeatures.map((f) => [f.name, f]));
  const managedNames = new Set(FEATURE_MAP.map(([name]) => name));
  const result: CechaSelly[] = [];
  for (const existing of existingFeatures || []) {
    const zBridge = bridgeByName.get(existing.name);
    if (zBridge) {
      result.push(zBridge);
      bridgeByName.delete(existing.name);
    } else if (!managedNames.has(existing.name)) {
      result.push({ name: existing.name, values: existing.values });
    }
  }
  for (const [, f] of bridgeByName) {
    result.push(f);
  }
  return result;
}

/**
 * Payload `PUT /api/products/{id}` (Tor 2) — `mapper_v2.cjs:123-145`.
 * Bez `vat_rate`, `category_id` (dokłada ją `sync_full` tylko właścicielowi metadanych),
 * `producer_id`, `price` (cena jest per wariant — Tor 1).
 *
 * `existingSellyFeatures` podane (nawet `[]`) → tryb lustra; niepodane → same cechy Bridge.
 */
export function toSellyPayloadV2(
  row: WierszMapperaV2,
  opts: { includeFeatures?: boolean; existingSellyFeatures?: readonly CechaSelly[] } = {},
): PayloadV2 {
  const payload: PayloadV2 = {
    name: row.nazwa,
    weight: Number(row.waga) || 0,
    provider_code: row.kod_importu || row.kod_dostawcy || null,
    price_purchase: Number(row.cena_zakupu) || 0,
    visible: row.status === "aktywny",
  };

  if (row.ean && row.ean_is_valid) {
    payload.ean = row.ean;
  }

  if (opts.includeFeatures) {
    payload.features = opts.existingSellyFeatures
      ? buildFeaturesMirror(row, opts.existingSellyFeatures)
      : buildFeatures(row);
  }

  return payload;
}

/** Słownik `klucz → id` — oryginał przyjmuje `Map` albo zwykły obiekt (`:163-168`). */
type Slownik = Map<string, number> | Record<string, number>;

export type SlownikiMappera = { catMap?: Slownik; prodMap?: Slownik };

const wSlowniku = (slownik: Slownik | undefined, klucz: string): number | undefined =>
  slownik instanceof Map ? slownik.get(klucz) : slownik?.[klucz];

/**
 * KOMPLETNY payload `POST /api/products` (Tor 2 auto-create) — `mapper_v2.cjs:159-187`.
 * `toSellyPayloadV2` z cechami + `category_id` (z `selly_kategoria_norm_map`, backlog #74),
 * `producer_id`, `product_code` (kod Bridge bez podkreślników), `price` (cena startowa).
 *
 * Brak kategorii/producenta w słowniku → `{ _error }` (treść komunikatu rozpoznaje
 * `markError` Toru 2 jako `missing_dict`).
 */
export function buildProductPayload(
  row: WierszMapperaV2,
  dictMaps: SlownikiMappera = {},
): PayloadV2 | { _error: string } {
  const catKey = String(row.kategoria || "").toLowerCase();
  const prodKey = String(row.marka || "").toLowerCase();

  const catId = wSlowniku(dictMaps.catMap, catKey);
  const prodId = wSlowniku(dictMaps.prodMap, prodKey);

  if (!catId) {
    return { _error: `Brak kategorii w slowniku: "${row.kategoria}" (klucz=${catKey})` };
  }
  if (!prodId) {
    return { _error: `Brak producenta w slowniku: "${row.marka}" (klucz=${prodKey})` };
  }

  const payload = toSellyPayloadV2(row, { includeFeatures: true });

  payload.category_id = catId;
  payload.producer_id = prodId;
  payload.product_code = String(row.kod || "").replace(/_/g, "");
  payload.price = Number(row.cena_sprzedazy) || 0;

  return payload;
}

/**
 * `buildProductPayload` w typie parametru `stworzDiscovery({ budujPayloadProduktu })` — to podaje
 * montaż jednej instancji discovery (karta I15.8). Przypisanie jest też kontrolą typów portu.
 */
export const budujPayloadProduktuV2: BudujPayloadProduktu = buildProductPayload;
