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

import type {
  KategoriaSelly,
  KlientSelly,
  MagazynSelly,
  OdpowiedzListy,
  ProducentSelly,
  StawkaVatSelly,
  WynikPing,
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

export type AtrapaSelly = {
  klient: KlientSelly;
  wywolania: WywolanieSelly[];
  /** Ile razy wołano daną metodę — skrót dla asercji. */
  liczba: (metoda: string) => number;
};

export type OpcjeAtrapy = {
  /** Wynik `createProduct` — domyślnie kolejne `product_id` od 9001 w górę. */
  nastepneProductId?: number;
  /** Metody, które mają rzucić podanym błędem zamiast odpowiedzieć. */
  bledy?: Partial<Record<keyof KlientSelly, Error>>;
};

/**
 * Buduje atrapę. Wszystkie odpowiedzi są deterministyczne — brak losowości, brak sieci,
 * brak czasu rzeczywistego poza `expires_in_seconds`, które i tak bierzemy z fixture.
 */
export function stworzAtrapeSelly(opcje: OpcjeAtrapy = {}): AtrapaSelly {
  const wywolania: WywolanieSelly[] = [];
  const slowniki = slownikiZFixture();
  let kolejneId = opcje.nastepneProductId ?? 9001;

  const zapisz = (metoda: keyof KlientSelly, ...argumenty: unknown[]): void => {
    wywolania.push({ metoda, argumenty });
    const blad = opcje.bledy?.[metoda];
    if (blad) throw blad;
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
      return Promise.resolve({ data: { product_id: kolejneId++ } });
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
  };

  return {
    klient,
    wywolania,
    liczba: (metoda) => wywolania.filter((w) => w.metoda === metoda).length,
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
  };
}
