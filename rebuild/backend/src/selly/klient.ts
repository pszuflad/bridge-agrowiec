/**
 * Klient REST API Selly.pl — port `mirror/backend/selly/client.cjs`.
 *
 * ⚠ TO JEST JEDYNY MODUŁ CAŁEJ ODBUDOWY, KTÓRY WYCHODZI DO ŚWIATA PO HTTP. Sześć z dziesięciu
 * tras panelu Selly (`ping`, `dictionaries`, `producers`, `categories`, `sync-product`,
 * `sync-supplier`) idzie tędy do realnego sklepu `https://agroopony.selly24.pl`. Cztery
 * pozostałe (`status`, `log`, `csv-status`, `generate-csv`) są w pełni lokalne i tego pliku
 * nie dotykają.
 *
 * ⚠ `sync-supplier` z `dry_run=false` REALNIE tworzy i modyfikuje produkty w cudzym sklepie.
 * Dlatego cała komunikacja jest za interfejsem `KlientSelly` (plan.md D2): testy wstrzykują
 * atrapę i żaden bieg `npm test` nie może dotknąć produkcyjnego Selly nawet przez pomyłkę.
 *
 * Autoryzacja: OAuth2 `client_credentials`, ciało JSON, `POST {SHOP_URL}/api/auth/access_token`.
 * Token JWT ważny 3600 s, cache w pamięci, auto-refresh przy 401. Limit Selly to 50 rekordów
 * na zapytanie GET; `slowniki.ts` podaje go jawnie, bo oryginał NIE capuje go w słownikach.
 *
 * RÓŻNICA STRUKTURALNA, NIE BEHAWIORALNA (plan.md D8): oryginał trzyma `tokenCache` jako
 * zmienną modułu (`client.cjs:26`). U nas cache siedzi w instancji. Dla pojedynczego procesu
 * to dokładnie to samo (klient jest tworzony raz w `server.ts`), a testy dostają czysty stan
 * bez resetowania modułu.
 */

/** Konfiguracja klienta — 1:1 z `SELLY_*` w `client.cjs:21-24`. */
export type KonfiguracjaSelly = {
  shopUrl: string;
  clientId: string;
  clientSecret: string;
  scope: string;
};

/** Odpowiedź diagnostyczna `ping()` — kształt z `contract/fixtures/GET_selly_ping.json`. */
export type WynikPing = {
  ok: true;
  shop: string;
  token_prefix: string;
  expires_in_seconds: number;
  vat_probe: string | { error: string };
};

/**
 * Odpowiedzi słownikowe Selly. Interesuje nas wyłącznie `data`, bo tylko po niej chodzi
 * `refreshDict` (`routes.cjs:36-59`); reszta koperty jest przepuszczana bez interpretacji.
 */
export type OdpowiedzListy<T> = { data?: T[] } | null;

export type ProducentSelly = { producer_id: number; name?: string };
export type KategoriaSelly = { category_id: number; name?: string };
export type StawkaVatSelly = { vat_id?: number; rate: number | string };
export type MagazynSelly = { warehouse_id: number; name?: string };

/**
 * Powierzchnia klienta, z której korzystają trasy i synchronizacja. Węższa niż moduł
 * oryginału — celowo: `listProducts`, `getProduct`, `deleteProduct`, `bulkPriceUpdate`,
 * `bulkWarehouseQuantity`, `listOrders`, `getOrder`, `listUnits`, `getProductMultiCat`
 * i `deleteProductMultiCat` nie są wołane z ŻADNEJ trasy (sprawdzone grafem wywołań
 * w `mirror/backend/selly/routes.cjs`), więc port bez konsumenta byłby martwym kodem.
 */
export type KlientSelly = {
  ping(): Promise<WynikPing>;
  listProducers(query?: { limit?: number }): Promise<OdpowiedzListy<ProducentSelly>>;
  createProducer(producent: { name: string }): Promise<unknown>;
  listCategories(query?: { limit?: number }): Promise<OdpowiedzListy<KategoriaSelly>>;
  createCategory(kategoria: {
    name: string;
    parent_id: number;
    visible: string;
  }): Promise<unknown>;
  listVatRates(): Promise<OdpowiedzListy<StawkaVatSelly>>;
  listWarehouses(): Promise<OdpowiedzListy<MagazynSelly>>;
  createProduct(payload: unknown): Promise<{ data?: { product_id?: number } } | null>;
  updateProduct(id: number, payload: unknown): Promise<unknown>;
  upsertProductWarehouse(
    productId: number,
    dane: { warehouse_id?: number; quantity?: number },
  ): Promise<unknown>;
  setProductMultiCat(productId: number, categoryIds: number[]): Promise<unknown>;
};

/** Błąd HTTP z Selly — niesie status, żeby `api()` mogło ponowić na 401, a upsert na 400/409. */
export class BladSelly extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "BladSelly";
    this.status = status;
    this.body = body;
  }
}

type CacheTokenu = { accessToken: string | null; wygasaSek: number };

type OdpowiedzHttp = { status: number; data: unknown; raw: string };

const DOMYSLNY_TIMEOUT_MS = 30_000;

/**
 * Port `request()` (`client.cjs:34-68`) na `fetch` z Node 20 zamiast `http`/`https`.
 *
 * Zachowanie zewnętrzne jest identyczne: 2xx daje `{status, data, raw}`, wszystko inne rzuca
 * `[Selly] HTTP {status} {method} {url} :: {pierwsze 800 znaków ciała}`. Ten komunikat trafia
 * potem żywcem do `selly_sync_log.szczegoly_json` — widać go w
 * `contract/fixtures/GET_selly_log.json` — więc jego format jest częścią zastanego zachowania
 * i nie wolno go „ładniej sformatować".
 */
async function zapytaj(
  metoda: string,
  url: string,
  opcje: { headers?: Record<string, string>; body?: string; timeoutMs?: number } = {},
): Promise<OdpowiedzHttp> {
  const kontroler = new AbortController();
  const timeout = setTimeout(
    () => kontroler.abort(new Error("[Selly] timeout")),
    opcje.timeoutMs ?? DOMYSLNY_TIMEOUT_MS,
  );

  try {
    const odp = await fetch(url, {
      method: metoda,
      headers: {
        Accept: "application/json",
        "User-Agent": "Bridge/1.0 Selly-client",
        ...(opcje.headers ?? {}),
      },
      body: opcje.body,
      signal: kontroler.signal,
    });

    const raw = await odp.text();
    let data: unknown = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      // Nie-JSON w ciele nie jest błędem samym w sobie — oryginał też go połyka
      // i zostawia `data: null`, a treść dostępną w `raw`.
    }

    if (odp.status >= 200 && odp.status < 300) return { status: odp.status, data, raw };

    throw new BladSelly(
      `[Selly] HTTP ${odp.status} ${metoda} ${url} :: ${raw.slice(0, 800)}`,
      odp.status,
      data ?? raw,
    );
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fabryka klienta. Sekrety wchodzą jako argument (nie przez `process.env` w środku modułu),
 * żeby `stworzApp` mogło dostać klienta wstrzykniętego, a test — atrapę.
 */
export function stworzKlientaSelly(konfiguracja: KonfiguracjaSelly): KlientSelly {
  const shopUrl = konfiguracja.shopUrl.replace(/\/$/, "");
  const { clientId, clientSecret, scope } = konfiguracja;

  let cache: CacheTokenu = { accessToken: null, wygasaSek: 0 };

  /**
   * Port `assertConfig()` (`client.cjs:28-32`) — komunikat verbatim.
   *
   * Rzuca dopiero przy pierwszym wywołaniu API, nie przy starcie procesu (plan.md D6):
   * środowisko bez sekretów Selly ma wstać i obsłużyć cztery lokalne trasy panelu,
   * a na sześciu zewnętrznych oddać 500 — dokładnie jak produkcja.
   */
  function sprawdzKonfiguracje(): void {
    if (!shopUrl || !clientId || !clientSecret) {
      throw new Error(
        "[Selly] Brak konfiguracji: SELLY_SHOP_URL / SELLY_CLIENT_ID / SELLY_CLIENT_SECRET",
      );
    }
  }

  /** Port `getAccessToken()` (`client.cjs:71-97`). Margines 30 s przed wygaśnięciem — 1:1. */
  async function pobierzToken(force = false): Promise<string> {
    sprawdzKonfiguracje();
    const teraz = Math.floor(Date.now() / 1000);
    if (!force && cache.accessToken && cache.wygasaSek - 30 > teraz) return cache.accessToken;

    const { data } = await zapytaj("POST", `${shopUrl}/api/auth/access_token`, {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        scope,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    const odpowiedz = data as { access_token?: string; expires_in?: number } | null;
    if (!odpowiedz?.access_token) {
      throw new Error("[Selly] Brak access_token w odpowiedzi: " + JSON.stringify(data));
    }

    cache = {
      accessToken: odpowiedz.access_token,
      wygasaSek: teraz + (Number(odpowiedz.expires_in) || 3600),
    };
    return odpowiedz.access_token;
  }

  /**
   * Port `api()` (`client.cjs:100-127`). Jedno ponowienie na 401 z wymuszonym odświeżeniem
   * tokenu; drugie 401 leci już do wołającego.
   */
  async function api(
    metoda: string,
    sciezka: string,
    opcje: {
      query?: Record<string, unknown> | null;
      body?: unknown;
      retryOn401?: boolean;
      timeoutMs?: number;
    } = {},
  ): Promise<OdpowiedzHttp> {
    sprawdzKonfiguracje();
    const token = await pobierzToken();

    let url = `${shopUrl}${sciezka.startsWith("/") ? "" : "/"}${sciezka}`;
    if (opcje.query && Object.keys(opcje.query).length > 0) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(opcje.query)) {
        if (v !== undefined && v !== null) qs.append(k, String(v));
      }
      url += (url.includes("?") ? "&" : "?") + qs.toString();
    }

    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    let cialo: string | undefined;
    if (opcje.body !== null && opcje.body !== undefined) {
      headers["Content-Type"] = "application/json";
      cialo = typeof opcje.body === "string" ? opcje.body : JSON.stringify(opcje.body);
    }

    try {
      return await zapytaj(metoda, url, { headers, body: cialo, timeoutMs: opcje.timeoutMs });
    } catch (blad) {
      if (blad instanceof BladSelly && blad.status === 401 && opcje.retryOn401 !== false) {
        await pobierzToken(true);
        return api(metoda, sciezka, { ...opcje, retryOn401: false });
      }
      throw blad;
    }
  }

  const dane = async (metoda: string, sciezka: string, opcje = {}): Promise<unknown> =>
    (await api(metoda, sciezka, opcje)).data;

  return {
    /** Port `ping()` (`client.cjs:207-218`). Token pobierany z `force` — świadomie, to test łączności. */
    async ping(): Promise<WynikPing> {
      const token = await pobierzToken(true);
      const stawki = await this.listVatRates().catch((e: unknown) => ({
        error: e instanceof Error ? e.message : String(e),
      }));
      const lista = (stawki as { data?: unknown })?.data;
      return {
        ok: true,
        shop: shopUrl,
        token_prefix: token.slice(0, 12) + "...",
        expires_in_seconds: cache.wygasaSek - Math.floor(Date.now() / 1000),
        vat_probe: Array.isArray(lista)
          ? `OK (${lista.length} stawek)`
          : (stawki as { error: string }),
      };
    },

    /**
     * ⚠ BEZ `Math.min(limit, 50)`, mimo że Selly przy 50 rekordach ma twardy limit.
     * Oryginał capuje `limit` WYŁĄCZNIE w `listProducts` i `listOrders` (`client.cjs:129,203`),
     * a w słownikach przekazuje wartość wprost (`:181-186`) — jedyny wołający i tak podaje
     * `limit: 50` (`slowniki.ts`). Dodanie capa tutaj byłoby logiką spoza oryginału.
     */
    listProducers: async (query = {}) =>
      (await dane("GET", "/api/producers", { query })) as OdpowiedzListy<ProducentSelly>,

    createProducer: (producent) => dane("POST", "/api/producers", { body: producent }),

    /** Bez capa na `limit` — jak `listProducers` wyżej. */
    listCategories: async (query = {}) =>
      (await dane("GET", "/api/categories", { query })) as OdpowiedzListy<KategoriaSelly>,

    createCategory: (kategoria) => dane("POST", "/api/categories", { body: kategoria }),

    listVatRates: async () => (await dane("GET", "/api/vat_rates")) as OdpowiedzListy<StawkaVatSelly>,

    listWarehouses: async () =>
      (await dane("GET", "/api/warehouses")) as OdpowiedzListy<MagazynSelly>,

    createProduct: async (payload) =>
      (await dane("POST", "/api/products", { body: payload })) as {
        data?: { product_id?: number };
      } | null,

    updateProduct: (id, payload) => dane("PUT", `/api/products/${id}`, { body: payload }),

    /**
     * Port `upsertProductWarehouse()` (`client.cjs:139-151`): najpierw POST (utworzenie
     * przypisania), a gdy Selly odbije 400/409 albo powie „istnieje" — PUT na istniejące.
     * Warunek `/istnieje|exists/i` na TREŚCI komunikatu jest w oryginale i zostaje: Selly
     * potrafi oddać 400 z takim tekstem zamiast czystego 409.
     */
    async upsertProductWarehouse(productId, { warehouse_id = 1, quantity = 0 } = {}) {
      try {
        return await dane("POST", `/api/products/${productId}/warehouses`, {
          body: { warehouse_id, quantity },
        });
      } catch (blad) {
        const status = blad instanceof BladSelly ? blad.status : 0;
        const komunikat = blad instanceof Error ? blad.message : "";
        if (status === 400 || status === 409 || /istnieje|exists/i.test(komunikat)) {
          return await dane("PUT", `/api/products/${productId}/warehouses/${warehouse_id}`, {
            body: { quantity },
          });
        }
        throw blad;
      }
    },

    /** Port `setProductMultiCat()` (`client.cjs:158-164`) — id-ki idą jako `"1,2,3"`. */
    async setProductMultiCat(productId, categoryIds) {
      const categories = (categoryIds ?? []).filter(Boolean).join(",");
      if (!categories) return null;
      return await dane("POST", `/api/products/${productId}/multi_cat`, {
        body: { product_id: productId, categories },
      });
    },
  };
}
