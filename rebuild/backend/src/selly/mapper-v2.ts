/**
 * Mapper Bridge → Selly v2 — port `mirror/backend/selly/mapper_v2.cjs`
 * (Iteracja 13d-1, ticket 45).
 *
 * Różnice względem `mapper.ts` (v1, z I8), wprost z nagłówka oryginału:
 *  - `provider_code = kod_importu`, nie `kod_dostawcy` — NAPRAWA BUGA po stronie Ani;
 *  - pełna mapa 21 cech (cecha „Bieżnik / model" bierze `bieznik`, nie `model`);
 *  - świadomie NIE ustawia: `content_html`, `html_*`, `unit_of_measure`, `availability`,
 *    wymiarów paczki, `category_id`, `producer_id`, `warehouse_id` (magazyn idzie cechą
 *    „Magazyny" na WARIANCIE, nie polem produktu);
 *  - świadomie pomija dwie cechy: „Lód" (`label_ice` zepsute w Bridge — 0% pokrycia,
 *    wartości „0.0") i „Magazyny" (cecha wariantu, osobna ścieżka).
 *
 * ⚠ W TORZE 1 TEN PLIK NIE JEST WOŁANY. `sync-delta.ts` liczy deltę własnym SQL-em i wysyła
 * gołe `{quantity, price}` na wariant; `toDeltaPayload` niżej jest w oryginale martwe
 * dokładnie tak samo (sprawdzone grafem wywołań na `main`). Portujemy w całości, bo tak
 * wygląda plik u Ani i bo Tor 2 (13d-2) będzie z niego korzystał — ale NIGDZIE go tu nie
 * podpinamy.
 */

/** `DEFAULT_VAT_RATE` (`mapper_v2.cjs:17`). */
export const DOMYSLNA_STAWKA_VAT = 23;

/**
 * Konwersja „flag" Bridge (`0`/`1`/`'Tak'`/`null`/`''`) na format Selly (`'Tak'` albo `null`).
 * Etykiety UE: M+S, 3PMSF, `label_snow`. Port `yn()` (`:26-33`).
 */
export function yn(v: unknown): string | null {
  if (v === null || v === undefined || v === "" || v === 0 || v === "0") return null;
  if (v === 1 || v === "1" || v === true || v === "Tak" || v === "tak" || v === "TAK") {
    return "Tak";
  }
  // Awaryjnie: coś innego (np. liczba dB) idzie jako string — 1:1 z oryginałem.
  const s = String(v).trim();
  return s || null;
}

/** Port `txt()` (`:38-42`): `null`/`''` → `null`, reszta przycięta. */
export function txt(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/** Port `num()` (`:49-56`): liczba jako tekst bez końcowych zer — `17.0` → `"17"`. */
export function num(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (isNaN(n)) return txt(v);
  return n.toString();
}

/** Port `zastosowaniePierwsze()` (`:62-66`): „Koparka + Ładowarka" → „Koparka". */
export function zastosowaniePierwsze(v: unknown): string | null {
  if (!v) return null;
  const pierwsze = String(v).split("+")[0]?.trim();
  return pierwsze || null;
}

/** Wiersz `products` widziany przez mapper (klucze `snake_case`, jak w oryginale). */
export type WierszProduktu = Record<string, unknown>;

/** Cecha w payloadzie Selly: `{name, values}` (produkt), nie `{feature_id, value}` (wariant). */
export type CechaProduktu = { name: string; values: string[] };

/**
 * Mapa 21 cech Bridge → Selly: `[nazwa_selly, pole_bridge, transformacja]`.
 * ⚠ KOLEJNOŚĆ MA ZNACZENIE (komentarz oryginału: „dla ładniejszego payloadu w logach”),
 * więc jest przepisana 1:1 z `FEATURE_MAP` (`:70-92`).
 */
export const MAPA_CECH: ReadonlyArray<
  readonly [string, string, (v: unknown) => string | null]
> = [
  ["Bieżnik / model", "bieznik", txt], // Anna: `bieznik`, nie `model`
  ["Rozmiar", "rozmiar", txt],
  ["Szerokość opony", "szerokosc", txt],
  ["Profil", "profil", num], // ODKRYTE w produkcie 407
  ["Średnica", "srednica", num],
  ["Rozmiar alternatywny", "rozmiar_alternatywny", txt], // ODKRYTE w produkcie 462
  ["R/D", "konstrukcja", txt],
  ["PR", "pr", txt], // ODKRYTE w produkcie 407
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
] as const;

/**
 * Port `buildFeatures()` (`:103-113`). Cechy o wartości `null` są POMIJANE — świadomie:
 * pusta wartość skasowałaby to, co już jest w Selly.
 */
export function zbudujCechy(wiersz: WierszProduktu): CechaProduktu[] {
  const cechy: CechaProduktu[] = [];
  for (const [nazwaSelly, poleBridge, fn] of MAPA_CECH) {
    const zmapowana = fn(wiersz[poleBridge]);
    if (zmapowana !== null && zmapowana !== undefined && zmapowana !== "") {
      cechy.push({ name: nazwaSelly, values: [String(zmapowana)] });
    }
  }
  return cechy;
}

/**
 * Port `buildFeaturesMirror()` (`:124-146`) — tryb „lustro", bezpieczny dla Selly:
 *  - cecha jest w Selly i w naszej mapie → wysyłamy wartość z Bridge;
 *  - cecha jest w Selly, ale nie w naszej mapie → ZACHOWUJEMY jej obecną wartość
 *    (inaczej skasowalibyśmy cudzą pracę w sklepie);
 *  - cecha jest w naszej mapie, ale nie ma jej w Selly → dokładamy (wzbogacenie).
 */
export function zbudujCechyLustro(
  wiersz: WierszProduktu,
  istniejaceCechy: CechaProduktu[] | null | undefined,
): CechaProduktu[] {
  const zBridge = zbudujCechy(wiersz);
  const wgNazwy = new Map(zBridge.map((c) => [c.name, c]));
  const wynik: CechaProduktu[] = [];

  for (const istniejaca of istniejaceCechy ?? []) {
    const nasza = wgNazwy.get(istniejaca.name);
    if (nasza) {
      wynik.push(nasza);
      wgNazwy.delete(istniejaca.name);
    } else {
      wynik.push({ name: istniejaca.name, values: istniejaca.values });
    }
  }

  for (const [, cecha] of wgNazwy) {
    wynik.push(cecha);
  }

  return wynik;
}

export type PayloadProduktuV2 = {
  name: unknown;
  vat_rate: number;
  weight: number;
  provider_code: string | null;
  price_purchase: number;
  visible: boolean;
  ean?: string;
  features?: CechaProduktu[];
};

/**
 * Port `toSellyPayloadV2()` (`:170-194`) — payload dla `PUT`/`POST /api/products/{id}`.
 * Zawiera WYŁĄCZNIE pola, które chcemy nadpisać; reszta zostaje w Selly nietknięta.
 *
 * ⚠ `provider_code = kod_importu` — to jest ta naprawa buga (było `kod_dostawcy`).
 * ⚠ `ean` idzie TYLKO gdy `ean_is_valid` (97,9% pokrycia w Bridge).
 */
export function naPayloadSellyV2(
  wiersz: WierszProduktu,
  opcje: { includeFeatures?: boolean; existingSellyFeatures?: CechaProduktu[] } = {},
): PayloadProduktuV2 {
  const payload: PayloadProduktuV2 = {
    name: wiersz.nazwa,
    vat_rate: Number(wiersz.vat ?? DOMYSLNA_STAWKA_VAT),
    weight: Number(wiersz.waga) || 0,
    provider_code: (wiersz.kod_importu as string) || (wiersz.kod_dostawcy as string) || null,
    price_purchase: Number(wiersz.cena_zakupu) || 0,
    visible: wiersz.status === "aktywny",
  };

  if (wiersz.ean && wiersz.ean_is_valid) {
    payload.ean = String(wiersz.ean);
  }

  // Cechy tylko dla Toru 2 — Tor 1 wysyła gołe `{quantity, price}` na wariant.
  if (opcje.includeFeatures) {
    payload.features = opcje.existingSellyFeatures
      ? zbudujCechyLustro(wiersz, opcje.existingSellyFeatures)
      : zbudujCechy(wiersz);
  }

  return payload;
}

/** Snapshot ostatnio wysłanych wartości (wiersz `selly_products`). */
export type OstatnioWyslane = {
  cena_sprzedazy_wyslana: number | null;
  cena_zakupu_wyslana: number | null;
  stan_wyslany: number | null;
} | null;

export type PayloadDelty = {
  price?: number;
  price_purchase?: number;
  _stock: number;
  _stockChanged: boolean;
};

/**
 * Port `toDeltaPayload()` (`:204-227`).
 *
 * ⚠ MARTWY W TORZE 1 — u Ani też. `sync_delta.cjs` liczy deltę w SQL-u
 * (`WHERE stan_wyslany != p.stan OR cena_sprzedazy_wyslana != p.cena_sprzedazy`) i nigdy tej
 * funkcji nie woła. Portowany dla kompletności pliku i pod Tor 2 (13d-2).
 */
export function naPayloadDelty(
  wiersz: WierszProduktu,
  ostatnio: OstatnioWyslane,
): PayloadDelty | null {
  const cenaTeraz = Number(wiersz.cena_sprzedazy) || 0;
  const zakupTeraz = Number(wiersz.cena_zakupu) || 0;
  const stanTeraz = Number(wiersz.stan) || 0;

  const cenaPrzed = ostatnio ? Number(ostatnio.cena_sprzedazy_wyslana) : null;
  const zakupPrzed = ostatnio ? Number(ostatnio.cena_zakupu_wyslana) : null;
  const stanPrzed = ostatnio ? Number(ostatnio.stan_wyslany) : null;

  const zmiany: PayloadDelty = { _stock: stanTeraz, _stockChanged: stanPrzed !== stanTeraz };
  if (cenaPrzed !== cenaTeraz) zmiany.price = cenaTeraz;
  if (zakupPrzed !== zakupTeraz) zmiany.price_purchase = zakupTeraz;

  const zmianaProduktu = "price" in zmiany || "price_purchase" in zmiany;
  if (!zmianaProduktu && !zmiany._stockChanged) return null;

  return zmiany;
}

/**
 * Port `DOSTAWCA_TO_MAGAZYN_FEATURE_ID` (`:232-239`) — odkryte 2026-09-07 z produktów
 * 407, 1927, 215, 1524, 60, 1049, 462, 1547.
 *
 * ⚠ Ta sama wiedza mieszka też w `discovery.ts` (`FEATURE_ID_MAGAZYNOW`) — u Ani również
 * w dwóch miejscach. NIE scalamy tego: `discovery` prowadzi WŁASNY cache uzupełniany
 * w trakcie działania, ta mapa jest stałą tylko do odczytu.
 */
export const DOSTAWCA_NA_FEATURE_ID_MAGAZYNU: Readonly<Record<string, number>> = {
  MO9: 1,
  MO5: 2,
  MO4: 3,
  MO3: 4,
  MO2: 5,
  // MO1, MO6, MO7, MO8, MO10 — do wykrycia z Selly przy pierwszym auto-create.
};

export function featureIdMagazynuDlaDostawcy(dostawca: string): number | null {
  return DOSTAWCA_NA_FEATURE_ID_MAGAZYNU[dostawca] ?? null;
}
