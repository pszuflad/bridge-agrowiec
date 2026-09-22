/**
 * Atrapa klienta Selly dla testów (Iteracja 8a).
 *
 * ⚠ POWÓD ISTNIENIA JEST TWARDY, NIE WYGODNICZY. Sześć z dziesięciu tras panelu wychodzi
 * po HTTP do REALNEGO sklepu `agroopony.selly24.pl`, a `POST /api/selly/sync-supplier`
 * z `dry_run=false` tworzy i modyfikuje tam produkty. Test, który przypadkiem trafiłby
 * w prawdziwe API z prawdziwymi sekretami, zmieniłby cudzy sklep. Dlatego klient jest
 * wstrzykiwany (plan.md D2), a testy dostają TĘ atrapę.
 *
 * ⚠ CZEGO ATRAPA NIE DOWODZI: że nasze rozumienie API Selly jest poprawne. Kształty
 * odpowiedzi bierze z `contract/fixtures/GET_selly_{ping,dictionaries}.json`, czyli z tego,
 * co produkcja RZECZYWIŚCIE zwróciła — więc dowodzi, że nasz kod poprawnie przetwarza realne
 * odpowiedzi Selly. Nie dowodzi, że Selly nadal takie odpowiedzi zwraca. Weryfikacja tego
 * wymagałaby sandboxu Selly i sekretów, których nie mamy.
 *
 * Atrapa liczy wywołania, żeby test mógł sprawdzić rzeczy, których nie widać w odpowiedzi:
 * że `dry_run` NIE dotknął Selly, że `ensureDict` nie odpytuje przy zapełnionym cache,
 * że `multi_cat` poszedł tylko przy dodatkowych kategoriach.
 */

import {
  BladSelly,
  type CechaWariantu,
  type KategoriaSelly,
  type KlientSelly,
  type MagazynSelly,
  type OdpowiedzListy,
  type ProducentSelly,
  type StawkaVatSelly,
  type WariantSelly,
  type WynikPing,
} from "../../src/selly/klient.js";
import { wczytajFixture } from "./fixtures.js";

/** Kształt map z `GET_selly_dictionaries.json` — cztery słowniki `nazwa → id`. */
type SlownikiZFixture = {
  producers: Record<string, number>;
  categories: Record<string, number>;
  vat_rates: Record<string, number>;
  warehouses: Record<string, number>;
};

/**
 * Odtwarza listy Selly z map zapisanych w fixture.
 *
 * Fixture zamraża WYNIK `loadMaps`, czyli już przetworzone `nazwa → id`. Żeby test
 * przechodził realną ścieżkę (`refreshDict` → zapis do `selly_dict` → `loadMaps`), atrapa
 * musi oddać dane w kształcie SUROWEJ odpowiedzi Selly. Odtworzenie jest jednoznaczne, bo
 * klucz mapy to `name.trim().toLowerCase()`, a nazwy w fixture są już małymi literami —
 * `name: klucz` wraca więc do tego samego klucza.
 */
function slownikiZFixture(): SlownikiZFixture {
  return wczytajFixture("GET_selly_dictionaries.json").body as unknown as SlownikiZFixture;
}

/** Zapis jednego wywołania atrapy — nazwa metody i argumenty. */
export type WywolanieSelly = { metoda: string; argumenty: unknown[] };

/**
 * Produkt w „sklepie” atrapy — model wariantowy (karta I15.6). Stan jest mutowalny: discovery
 * i Tor 1 zakładają warianty i aktualizują ceny/stany, a test sprawdza efekt po stronie sklepu.
 */
export type ProduktSklepu = {
  product_id: number;
  product_code?: string | null;
  provider_code?: string | null;
  ean?: string | null;
  warianty: (WariantSelly & { quantity?: number | null; price?: number | null })[];
};

export type AtrapaSelly = {
  klient: KlientSelly;
  wywolania: WywolanieSelly[];
  /** Ile razy wołano daną metodę — skrót dla asercji. */
  liczba: (metoda: string) => number;
  /** Stan sklepu (model wariantowy) — `product_id` → produkt. */
  sklep: Map<number, ProduktSklepu>;
};

export type OpcjeAtrapy = {
  /** Wynik `createProduct` — domyślnie kolejne `product_id` od 9001 w górę. */
  nastepneProductId?: number;
  /** Metody, które mają rzucić podanym błędem zamiast odpowiedzieć. */
  bledy?: Partial<Record<keyof KlientSelly, Error>>;
  /** Jak `bledy`, ale tylko przy PIERWSZYM wywołaniu metody (np. 400 „Istnieje produkt…”). */
  bledyRaz?: Partial<Record<keyof KlientSelly, Error>>;
  /** Początkowa zawartość sklepu dla metod wariantowych. */
  sklep?: ProduktSklepu[];
  /** Rozmiar strony `listProductsPage` — Selly oddaje 20 (`discovery.cjs:59`). */
  rozmiarStrony?: number;
  /**
   * Cecha „Magazyny”, którą sklep dołoży do nowego wariantu utworzonego BEZ cech — symulacja
   * uczenia `feature_id` dla MO1/MO6/MO7/MO8/MO10. Jawnie jedna para: ciało POST-a nie niesie
   * dostawcy, więc atrapa nie ma z czego go wywnioskować.
   */
  magazynNowegoWariantu?: { dostawca: string; featureId: number };
};

/**
 * Buduje atrapę. Wszystkie odpowiedzi są deterministyczne — brak losowości, brak sieci,
 * brak czasu rzeczywistego poza `expires_in_seconds`, które i tak bierzemy z fixture.
 */
export function stworzAtrapeSelly(opcje: OpcjeAtrapy = {}): AtrapaSelly {
  const wywolania: WywolanieSelly[] = [];
  const slowniki = slownikiZFixture();
  let kolejneId = opcje.nastepneProductId ?? 9001;

  const sklep = new Map<number, ProduktSklepu>(
    (opcje.sklep ?? []).map((p) => [p.product_id, structuredClone(p)]),
  );
  const rozmiarStrony = opcje.rozmiarStrony ?? 20;
  let kolejnyWariant = 5001;
  const bledyRaz = new Map(Object.entries(opcje.bledyRaz ?? {}));

  const zapisz = (metoda: keyof KlientSelly, ...argumenty: unknown[]): void => {
    wywolania.push({ metoda, argumenty });
    const blad = opcje.bledy?.[metoda];
    if (blad) throw blad;
    const raz = bledyRaz.get(metoda);
    if (raz) {
      bledyRaz.delete(metoda);
      throw raz;
    }
  };

  /** Selly na nieznany produkt oddaje 404 — `request()` zamienia to w wyjątek. */
  const produktAlbo404 = (productId: number, metoda: string, sciezka: string): ProduktSklepu => {
    const produkt = sklep.get(productId);
    if (!produkt) {
      throw new BladSelly(`[Selly] HTTP 404 ${metoda} https://atrapa${sciezka} :: {}`, 404, {});
    }
    return produkt;
  };

  const jakoLista = <T>(mapa: Record<string, number>, klucz: string, id: string): OdpowiedzListy<T> =>
    ({
      data: Object.entries(mapa).map((wpis) => ({ [klucz]: wpis[0], [id]: wpis[1] })),
    }) as OdpowiedzListy<T>;

  const klient: KlientSelly = {
    ping(): Promise<WynikPing> {
      zapisz("ping");
      return Promise.resolve(wczytajFixture("GET_selly_ping.json").body as unknown as WynikPing);
    },

    listProducers(query) {
      zapisz("listProducers", query);
      return Promise.resolve(jakoLista<ProducentSelly>(slowniki.producers, "name", "producer_id"));
    },

    createProducer(producent) {
      zapisz("createProducer", producent);
      return Promise.resolve({ data: { producer_id: 999, name: producent.name } });
    },

    listCategories(query) {
      zapisz("listCategories", query);
      return Promise.resolve(jakoLista<KategoriaSelly>(slowniki.categories, "name", "category_id"));
    },

    createCategory(kategoria) {
      zapisz("createCategory", kategoria);
      return Promise.resolve({ data: { category_id: 888, name: kategoria.name } });
    },

    listVatRates() {
      zapisz("listVatRates");
      return Promise.resolve(jakoLista<StawkaVatSelly>(slowniki.vat_rates, "rate", "vat_id"));
    },

    listWarehouses() {
      zapisz("listWarehouses");
      return Promise.resolve(jakoLista<MagazynSelly>(slowniki.warehouses, "name", "warehouse_id"));
    },

    createProduct(payload) {
      zapisz("createProduct", payload);
      const productId = kolejneId++;
      // Selly zakłada produkt z jednym domyślnym wariantem, bez cechy „Magazyny”.
      const p = (payload ?? {}) as { product_code?: string; provider_code?: string; ean?: string };
      sklep.set(productId, {
        product_id: productId,
        product_code: p.product_code ?? null,
        provider_code: p.provider_code ?? null,
        ean: p.ean ?? null,
        warianty: [{ variant_id: kolejnyWariant++, default: 1, features: [] }],
      });
      return Promise.resolve({ data: { product_id: productId } });
    },

    updateProduct(id, payload) {
      zapisz("updateProduct", id, payload);
      return Promise.resolve({ data: { product_id: id } });
    },

    upsertProductWarehouse(productId, dane) {
      zapisz("upsertProductWarehouse", productId, dane);
      return Promise.resolve({ data: dane });
    },

    setProductMultiCat(productId, categoryIds) {
      zapisz("setProductMultiCat", productId, categoryIds);
      return Promise.resolve({ data: { product_id: productId, categories: categoryIds } });
    },

    listProductsByEan(ean) {
      zapisz("listProductsByEan", ean);
      const trafiony = [...sklep.values()].find((p) => p.ean === ean);
      return Promise.resolve({ data: trafiony ? [{ product_id: trafiony.product_id }] : [] });
    },

    listProductsPage(page) {
      zapisz("listProductsPage", page);
      const wszystkie = [...sklep.values()].sort((a, b) => a.product_id - b.product_id);
      const numer = page ?? 1;
      const strona = wszystkie.slice((numer - 1) * rozmiarStrony, numer * rozmiarStrony);
      return Promise.resolve({
        data: strona.map(({ product_id, product_code, provider_code }) => ({
          product_id,
          product_code,
          provider_code,
        })),
        __metadata: {
          page_count: Math.max(1, Math.ceil(wszystkie.length / rozmiarStrony)),
          total_count: wszystkie.length,
        },
      });
    },

    async listVariants(productId) {
      zapisz("listVariants", productId);
      const produkt = produktAlbo404(productId, "GET", `/api/products/${productId}/variants`);
      return { data: structuredClone(produkt.warianty) };
    },

    async createVariant(productId, cialo) {
      zapisz("createVariant", productId, cialo);
      const produkt = produktAlbo404(productId, "POST", `/api/products/${productId}/variants`);
      let features: CechaWariantu[] = cialo.features ?? [];
      const nowy = opcje.magazynNowegoWariantu;
      if (features.length === 0 && nowy) {
        features = [{ feature_id: nowy.featureId, name: "Magazyny", value: nowy.dostawca }];
      }
      const wariant = {
        variant_id: kolejnyWariant++,
        default: cialo.default ?? 0,
        features,
        quantity: cialo.quantity ?? null,
        price: cialo.price ?? null,
      };
      produkt.warianty.push(wariant);
      return { data: structuredClone(wariant) };
    },

    async updateVariant(productId, variantId, cialo) {
      zapisz("updateVariant", productId, variantId, cialo);
      const sciezka = `/api/products/${productId}/variants/${variantId}`;
      const wariant = produktAlbo404(productId, "PUT", sciezka).warianty.find(
        (w) => w.variant_id === variantId,
      );
      if (!wariant) throw new BladSelly(`[Selly] HTTP 404 PUT https://atrapa${sciezka} :: {}`, 404, {});
      Object.assign(wariant, cialo);
      return { data: structuredClone(wariant) };
    },
  };

  return {
    klient,
    wywolania,
    liczba: (metoda) => wywolania.filter((w) => w.metoda === metoda).length,
    sklep,
  };
}

/**
 * Atrapa dla środowiska BEZ sekretów Selly — każda metoda rzuca tym samym komunikatem,
 * co `assertConfig()` w oryginale (`mirror/backend/selly/client.cjs:28-32`).
 * Do sprawdzania, że sześć tras zewnętrznych oddaje wtedy 500 (plan.md D6).
 */
export const KOMUNIKAT_BRAK_KONFIGURACJI =
  "[Selly] Brak konfiguracji: SELLY_SHOP_URL / SELLY_CLIENT_ID / SELLY_CLIENT_SECRET";

export function stworzAtrapeBezKonfiguracji(): KlientSelly {
  const rzuc = (): never => {
    throw new Error(KOMUNIKAT_BRAK_KONFIGURACJI);
  };
  return {
    ping: rzuc,
    listProducers: rzuc,
    createProducer: rzuc,
    listCategories: rzuc,
    createCategory: rzuc,
    listVatRates: rzuc,
    listWarehouses: rzuc,
    createProduct: rzuc,
    updateProduct: rzuc,
    upsertProductWarehouse: rzuc,
    setProductMultiCat: rzuc,
    listProductsByEan: rzuc,
    listProductsPage: rzuc,
    listVariants: rzuc,
    createVariant: rzuc,
    updateVariant: rzuc,
  };
}
