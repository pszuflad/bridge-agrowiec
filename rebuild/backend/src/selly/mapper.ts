/**
 * Mapowanie wiersza `products` → payload Selly `/api/products` — port
 * `mirror/backend/selly/mapper.cjs`.
 *
 * ⚠ NAZWY PÓL PAYLOADU ZOSTAJĄ PO ANGIELSKU (`name`, `category_id`, `product_code`,
 * `price_purchase`…). To kontrakt cudzego API, nie nasze nazewnictwo — tłumaczenie zepsułoby
 * integrację. Terminy domenowe Bridge (`kategoria`, `zastosowanie`, `cenaZakupu`) zostają
 * po polsku, jak w całej odbudowie.
 *
 * ⚠ ZALEŻNOŚĆ OD BACKLOGU #12. `mapZastosowanieCategory` opiera całe mapowanie kategorii na
 * `products.zastosowanie`. W produkcji pole to jest po każdej akceptacji stagingu uzupełniane
 * przez `__restoreZastosowanie()` (`deminified/backend-index.cjs:44105-44135`) z pliku CSV
 * spoza repo — funkcji tej świadomie NIE portujemy (decyzja 3d-2, podtrzymana 2026-09-04,
 * plan.md D3). Skutek jest konkretny i widać go tutaj: przy pustym `zastosowanie` mapowanie
 * wpada w `source: "fallback_kategoria"`, czyli produkt trafia do Selly wyłącznie do kategorii
 * głównej, bez podkategorii z `selly_zastosowanie_category_map` i bez `multi_cat`.
 * Szczegóły: `docs/rebuild-backlog.md` #12.
 */

import { eq } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { sellyKategoriaNormMap, sellyZastosowanieCategoryMap } from "../db/schema.js";
import type { ProduktWewnetrzny } from "../repos/products.js";

/** Stawka VAT dla opon w PL — fallback, gdy produkt nie ma własnej (`mapper.cjs:9`). */
export const DOMYSLNY_VAT = 23;
/** „Magazyn główny" w Selly — fallback, gdy dostawca nie ma swojego (`mapper.cjs:10`). */
export const DOMYSLNY_MAGAZYN_ID = 1;
/** `1` = sztuka (`mapper.cjs:11`). */
const DOMYSLNA_JEDNOSTKA = 1;
/** Napis wysyłany w polu `availability` (`mapper.cjs:12`). */
const DOMYSLNA_DOSTEPNOSC = "dostępny";

/** Mapy `nazwa → id` z cache `selly_dict` — kształt z `loadMaps` (`routes.cjs:63-72`). */
export type MapySelly = {
  producerMap: Record<string, number>;
  catMap: Record<string, number>;
  vatMap: Record<string, number>;
  whMap: Record<string, number>;
};

/**
 * Rozbija `zastosowanie` na pojedyncze wartości — port `splitZastosowanie` (`mapper.cjs:101-104`).
 * `"Koparka + Ładowarka kołowa"` → `["Koparka", "Ładowarka kołowa"]`.
 */
export function podzielZastosowanie(zastosowanie: string | null | undefined): string[] {
  if (!zastosowanie) return [];
  return zastosowanie
    .split("+")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * `category_id` głównej kategorii Selly dla surowej wartości `products.kategoria` —
 * port `mapKategoriaGlownaId` (`mapper.cjs:111-117`). Tabela `selly_kategoria_norm_map`
 * istnieje właśnie po to, żeby obsłużyć warianty pisowni („przemyslowe" / „przemysłowe" /
 * „Przemysłowe"), więc dopasowanie jest po surowej wartości po `trim()`, bez normalizacji
 * wielkości liter.
 */
export function mapujKategorieGlownaId(db: Baza, kategoriaRaw: string | null): number | null {
  if (!kategoriaRaw) return null;
  const wiersz = db
    .select({ id: sellyKategoriaNormMap.categoryIdGlowna })
    .from(sellyKategoriaNormMap)
    .where(eq(sellyKategoriaNormMap.kategoriaRaw, kategoriaRaw.trim()))
    .get();
  return wiersz ? wiersz.id : null;
}

/** Skąd wzięła się kategoria produktu — pole diagnostyczne, jak w oryginale. */
export type ZrodloKategorii = "zastosowanie" | "fallback_kategoria" | "fallback_empty";

export type MapowanieKategorii = {
  category_id: number | null;
  extra_cat_ids: number[];
  source: ZrodloKategorii;
};

/**
 * Port `mapZastosowanieCategory` (`mapper.cjs:135-170`). Reguły ustalone w produkcji:
 *
 *  - PIERWSZA wartość `zastosowanie` wyznacza kategorię główną produktu w Selly;
 *  - kolejne (po `" + "`) idą do `multi_cat` jako `extra_cat_ids`;
 *  - wartość z `dziedziczy_kategorie_produktu=1` (np. „(ogólne)", „Uniwersalne") NIE ma
 *    własnej podkategorii — podstawia kategorię główną z `products.kategoria`. Słowo
 *    „ogólne" nigdy nie trafia do Selly jako nazwa kategorii;
 *  - wartość nieznana w mapie jest po cichu POMIJANA (`continue`), nie przerywa mapowania;
 *  - brak `zastosowanie` → `fallback_kategoria`; same nieznane wartości → `fallback_empty`.
 *
 * Deduplikacja przez `Set` zachowuje kolejność pierwszego wystąpienia — to ona decyduje,
 * która kategoria jest główna.
 */
export function mapujZastosowanieNaKategorie(
  db: Baza,
  produkt: Pick<ProduktWewnetrzny, "zastosowanie" | "kategoria">,
): MapowanieKategorii {
  const wartosci = podzielZastosowanie(produkt.zastosowanie);

  if (wartosci.length === 0) {
    return {
      category_id: mapujKategorieGlownaId(db, produkt.kategoria),
      extra_cat_ids: [],
      source: "fallback_kategoria",
    };
  }

  const rozwiazane: (number | null)[] = [];
  for (const wartosc of wartosci) {
    const mapa = db
      .select({
        glowna: sellyZastosowanieCategoryMap.categoryIdGlowna,
        zastosowanie: sellyZastosowanieCategoryMap.categoryIdZastosowanie,
        dziedziczy: sellyZastosowanieCategoryMap.dziedziczyKategorieProduktu,
      })
      .from(sellyZastosowanieCategoryMap)
      .where(eq(sellyZastosowanieCategoryMap.zastosowanie, wartosc))
      .get();

    if (!mapa) continue;

    if (mapa.dziedziczy) {
      const glownaId = mapujKategorieGlownaId(db, produkt.kategoria);
      if (glownaId) rozwiazane.push(glownaId);
    } else {
      rozwiazane.push(mapa.zastosowanie);
    }
  }

  const unikalne = [...new Set(rozwiazane.filter((id): id is number => Boolean(id)))];

  if (unikalne.length === 0) {
    return {
      category_id: mapujKategorieGlownaId(db, produkt.kategoria),
      extra_cat_ids: [],
      source: "fallback_empty",
    };
  }

  return { category_id: unikalne[0]!, extra_cat_ids: unikalne.slice(1), source: "zastosowanie" };
}

/** Port `mapProducerId` (`mapper.cjs:45-47`) — klucze cache są po `toLowerCase()`. */
export function mapujProducentaId(
  marka: string | null,
  producerMap: Record<string, number>,
): number | null {
  return producerMap[(marka ?? "").trim().toLowerCase()] ?? null;
}

/**
 * Port `mapWarehouseId` (`mapper.cjs:58-63`). Każdy dostawca ma w Selly magazyn o tej samej
 * nazwie co jego kod („MO1" → magazyn „mo1"); brak → „magazyn główny" → `1`.
 */
export function mapujMagazynId(
  dostawca: string | null,
  whMap: Record<string, number>,
): number {
  const klucz = (dostawca ?? "").trim().toLowerCase();
  if (whMap[klucz]) return whMap[klucz];
  return whMap["magazyn główny"] ?? whMap["magazyn glowny"] ?? DOMYSLNY_MAGAZYN_ID;
}

/**
 * Port `buildTireDescription` (`mapper.cjs:68-98`) — tabela HTML z parametrami opony,
 * wysyłana jako `content_html`.
 *
 * Escaping jest częściowy: oryginał zamienia tylko `<`, i tak zostaje. To nie jest przeoczenie
 * do „naprawienia" przy okazji — treść idzie do cudzego sklepu, a każda zmiana escapingu
 * zmieniłaby opisy 7 tys. produktów w Selly. Wartości pochodzą z parserów cenników, nie
 * z wejścia użytkownika.
 */
export function zbudujOpisOpony(p: ProduktWewnetrzny): string {
  const wiersze: string[] = [];
  const dodaj = (etykieta: string, wartosc: unknown): void => {
    if (wartosc === null || wartosc === undefined || wartosc === "" || wartosc === false) return;
    wiersze.push(
      `<tr><td><b>${etykieta}</b></td><td>${String(wartosc).replace(/</g, "&lt;")}</td></tr>`,
    );
  };

  dodaj("Rozmiar", p.rozmiar);
  dodaj("Szerokość", p.szerokosc);
  dodaj("Profil", p.profil);
  dodaj("Średnica", p.srednica);
  dodaj("Konstrukcja", p.konstrukcja);
  dodaj("Indeks nośności", p.indeksNosnosci || p.indeks1);
  dodaj("Indeks prędkości", p.indeksPredkosci || p.indeks2);
  dodaj("PR", p.pr);
  dodaj("TL/TT", p.tlTt);
  dodaj("VF/IF", p.vfIf);
  dodaj("Bieżnik", p.bieznik);
  dodaj("Model", p.model);
  dodaj("DOT", p.dot);
  dodaj("Sezon", p.sezon);
  dodaj("M+S", p.ms ? "tak" : null);
  dodaj("3PMSF", p.snow3pmsf ? "tak" : null);
  dodaj("Reinforced", p.reinforced ? "tak" : null);
  dodaj("Extra Load", p.extraLoad ? "tak" : null);
  dodaj("Odporność na przecięcia", p.cutResistant ? "tak" : null);
  dodaj("Odporność na temperaturę", p.heatResistant ? "tak" : null);
  dodaj("Odporność na ściernisko", p.stubbleResistant ? "tak" : null);
  dodaj("Waga (kg)", p.waga);
  dodaj("Kod dostawcy", p.kodDostawcy);

  if (wiersze.length === 0) return "";
  return `<table class="tire-specs">${wiersze.join("")}</table>`;
}

/**
 * Payload `POST /api/products` w Selly. `_extra_cat_ids` NIE jest polem Selly — to nasz
 * kanał wewnętrzny do `multi_cat`, dokładnie jak w oryginale (`mapper.cjs:215`).
 */
export type PayloadSelly = {
  name: string;
  category_id: number | null;
  producer_id: number | undefined;
  price: number;
  visible: true;
  product_code: string;
  provider_code: string;
  ean: string;
  vat_rate: number;
  price_purchase: number;
  warehouse_id: number;
  weight: number;
  content_html: string;
  unit_of_measure: number;
  availability: string;
  _extra_cat_ids: number[];
};

/**
 * Port `toSellyPayload` (`mapper.cjs:182-217`).
 *
 * ⚠ Oryginał ma dwie ścieżki mapowania kategorii: przez `zastosowanie` (gdy podano `db`)
 * albo starą `mapCategoryId` po zahardkodowanej tabelce nazw (gdy `db` brak). Druga ścieżka
 * jest w produkcji MARTWA — jedyni wołający, `sync-product` (`routes.cjs:156`) i
 * `sync-supplier` (`:202`), zawsze podają `{db}`. Portujemy więc tylko żywą gałąź;
 * `db` jest tu parametrem wymaganym, nie opcjonalnym.
 */
export function naPayloadSelly(
  db: Baza,
  produkt: ProduktWewnetrzny,
  mapy: MapySelly,
  opcje: { warehouse_id?: number; vat_rate?: number } = {},
): PayloadSelly {
  const magazynId =
    opcje.warehouse_id ?? mapujMagazynId(produkt.dostawca, mapy.whMap ?? {}) ?? DOMYSLNY_MAGAZYN_ID;
  const stawkaVat = opcje.vat_rate ?? produkt.vat ?? DOMYSLNY_VAT;

  const kategorie = mapujZastosowanieNaKategorie(db, produkt);
  const producentId = mapujProducentaId(produkt.marka, mapy.producerMap);

  return {
    name: produkt.nazwa,
    category_id: kategorie.category_id,
    producer_id: producentId || undefined,
    price: Number(produkt.cenaSprzedazy) || 0,
    visible: true,
    product_code: produkt.kod,
    provider_code: produkt.kodDostawcy || produkt.kod,
    ean: produkt.ean || "",
    vat_rate: Number(stawkaVat),
    price_purchase: Number(produkt.cenaZakupu) || 0,
    warehouse_id: magazynId,
    weight: Number(produkt.waga) || 0,
    content_html: zbudujOpisOpony(produkt),
    unit_of_measure: DOMYSLNA_JEDNOSTKA,
    availability: DOMYSLNA_DOSTEPNOSC,
    _extra_cat_ids: kategorie.extra_cat_ids,
  };
}

/**
 * Port `validatePayload` (`mapper.cjs:222-232`). Komunikaty verbatim — trafiają do
 * `selly_sync_log.szczegoly_json` jako `errors[].reason` i do odpowiedzi 400 `sync-product`.
 *
 * ⚠ Brak `producer_id` (nieznana marka) jest BŁĘDEM, nie ostrzeżeniem, mimo brzmienia
 * komunikatu: produkt z nieznaną marką zostaje pominięty. Tak samo cena 0 — sprawdzana
 * osobno od `price >= 0`, więc daje DWA różne komunikaty przy dwóch różnych przyczynach.
 */
export function walidujPayload(payload: PayloadSelly): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!payload.name) errors.push("Brak name");
  if (!payload.category_id) errors.push("Brak category_id (nieznana kategoria)");
  if (!payload.producer_id)
    errors.push("Brak producer_id (nieznana marka) — produkt zostanie pominięty");
  if (!(payload.price >= 0)) errors.push("Nieprawidłowa cena");
  if (payload.price === 0) errors.push("Cena = 0 — produkt nie może być wysłany do Selly");
  if (!payload.product_code) errors.push("Brak product_code");
  return { ok: errors.length === 0, errors };
}
