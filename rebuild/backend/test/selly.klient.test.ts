/**
 * Klient REST Selly (blok 8a) — port `mirror/backend/selly/client.cjs`.
 *
 * ⚠ TESTUJEMY PRZECIW PRAWDZIWEMU SERWEROWI HTTP, nie przeciw zamockowanemu `fetch`.
 * Serwer stoi lokalnie na porcie EFEMERYCZNYM (`listen(0)`), więc nie koliduje z niczym,
 * co równolegle chodzi na maszynie. Mock `fetch` sprawdzałby, czy poprawnie wołamy mocka;
 * ten test sprawdza rzeczy, które psują się naprawdę: nagłówek `Authorization`, kształt
 * ciała OAuth2, ponowienie po 401 i to, że drugie 401 już nie jest ponawiane.
 *
 * Czego ten test NIE dowodzi: że Selly zachowuje się tak, jak ten serwer udaje. Tego bez
 * sandboxu Selly zweryfikować się nie da — kształty bierzemy z nagrań produkcji
 * (`contract/fixtures/GET_selly_ping.json`, `GET_selly_log.json`).
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { afterEach, describe, expect, it } from "vitest";

import { BladSelly, stworzKlientaSelly } from "../src/selly/klient.js";

type Zadanie = { metoda: string; sciezka: string; autoryzacja?: string; cialo: string };

/** Serwer udający Selly — zapisuje każde żądanie, żeby test mógł je obejrzeć. */
function udawanySelly(obsluga: (zad: Zadanie, res: ServerResponse) => void): {
  server: Server;
  zadania: Zadanie[];
  url: Promise<string>;
} {
  const zadania: Zadanie[] = [];
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const kawalki: Buffer[] = [];
    req.on("data", (c: Buffer) => kawalki.push(c));
    req.on("end", () => {
      const zadanie: Zadanie = {
        metoda: req.method ?? "",
        sciezka: req.url ?? "",
        autoryzacja: req.headers.authorization,
        cialo: Buffer.concat(kawalki).toString("utf8"),
      };
      zadania.push(zadanie);
      obsluga(zadanie, res);
    });
  });

  const url = new Promise<string>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const adres = server.address();
      resolve(typeof adres === "object" && adres ? `http://127.0.0.1:${adres.port}` : "");
    });
  });

  return { server, zadania, url };
}

function odpowiedz(res: ServerResponse, status: number, cialo: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(cialo));
}

describe("klient Selly — OAuth2 i warstwa HTTP", () => {
  let serwer: Server | undefined;

  afterEach(() => {
    serwer?.close();
    serwer = undefined;
  });

  /**
   * Port `assertConfig()` (`client.cjs:28-32`). Rzuca dopiero przy WYWOŁANIU, nie przy
   * tworzeniu klienta — dzięki temu proces bez sekretów Selly wstaje i obsługuje cztery
   * lokalne trasy panelu (plan.md D6).
   */
  it("bez sekretów rzuca komunikatem `assertConfig` dopiero przy wywołaniu", async () => {
    const klient = stworzKlientaSelly({
      shopUrl: "",
      clientId: "",
      clientSecret: "",
      scope: "READWRITE",
    });

    await expect(klient.ping()).rejects.toThrow(
      "[Selly] Brak konfiguracji: SELLY_SHOP_URL / SELLY_CLIENT_ID / SELLY_CLIENT_SECRET",
    );
  });

  it("pobiera token przez `client_credentials` i dokłada go jako Bearer", async () => {
    const udawany = udawanySelly((zad, res) => {
      if (zad.sciezka === "/api/auth/access_token") {
        odpowiedz(res, 200, { access_token: "TOKEN-ABC", expires_in: 3600 });
        return;
      }
      odpowiedz(res, 200, { data: [{ rate: 23, vat_id: 5 }] });
    });
    serwer = udawany.server;
    const shopUrl = await udawany.url;

    const klient = stworzKlientaSelly({
      shopUrl,
      clientId: "bridge-test",
      clientSecret: "sekret",
      scope: "READWRITE",
    });

    const wynik = await klient.listVatRates();

    expect(wynik).toEqual({ data: [{ rate: 23, vat_id: 5 }] });

    const [tokenowe, danych] = udawany.zadania;
    expect(tokenowe?.metoda).toBe("POST");
    expect(JSON.parse(tokenowe?.cialo ?? "{}")).toEqual({
      grant_type: "client_credentials",
      scope: "READWRITE",
      client_id: "bridge-test",
      client_secret: "sekret",
    });
    expect(danych?.autoryzacja).toBe("Bearer TOKEN-ABC");
  });

  it("token jest cache'owany — drugie wywołanie nie odpytuje o niego ponownie", async () => {
    const udawany = udawanySelly((zad, res) => {
      if (zad.sciezka === "/api/auth/access_token") {
        odpowiedz(res, 200, { access_token: "TOKEN-ABC", expires_in: 3600 });
        return;
      }
      odpowiedz(res, 200, { data: [] });
    });
    serwer = udawany.server;
    const shopUrl = await udawany.url;

    const klient = stworzKlientaSelly({
      shopUrl,
      clientId: "id",
      clientSecret: "sekret",
      scope: "READWRITE",
    });

    await klient.listVatRates();
    await klient.listWarehouses();

    const tokenowe = udawany.zadania.filter((z) => z.sciezka === "/api/auth/access_token");
    expect(tokenowe).toHaveLength(1);
  });

  /**
   * ⚠ 401 z API oznacza „token wygasł", więc klient pobiera go PONOWNIE z `force` i powtarza
   * żądanie. To jest jedyne miejsce, gdzie sami z siebie bijemy do Selly dwa razy.
   */
  it("na 401 odświeża token i ponawia żądanie dokładnie raz", async () => {
    let numerTokenu = 0;
    let pierwszeDaneOdbite = false;

    const udawany = udawanySelly((zad, res) => {
      if (zad.sciezka === "/api/auth/access_token") {
        numerTokenu += 1;
        odpowiedz(res, 200, { access_token: `TOKEN-${numerTokenu}`, expires_in: 3600 });
        return;
      }
      if (!pierwszeDaneOdbite) {
        pierwszeDaneOdbite = true;
        odpowiedz(res, 401, { error: "expired" });
        return;
      }
      odpowiedz(res, 200, { data: [{ warehouse_id: 1, name: "Magazyn główny" }] });
    });
    serwer = udawany.server;
    const shopUrl = await udawany.url;

    const klient = stworzKlientaSelly({
      shopUrl,
      clientId: "id",
      clientSecret: "sekret",
      scope: "READWRITE",
    });

    const wynik = await klient.listWarehouses();

    expect(wynik?.data).toHaveLength(1);
    expect(numerTokenu).toBe(2);
    const daneowe = udawany.zadania.filter((z) => z.sciezka !== "/api/auth/access_token");
    expect(daneowe).toHaveLength(2);
    expect(daneowe[1]?.autoryzacja).toBe("Bearer TOKEN-2");
  });

  it("drugie 401 z rzędu nie jest ponawiane — leci do wołającego", async () => {
    const udawany = udawanySelly((zad, res) => {
      if (zad.sciezka === "/api/auth/access_token") {
        odpowiedz(res, 200, { access_token: "TOKEN", expires_in: 3600 });
        return;
      }
      odpowiedz(res, 401, { error: "nadal expired" });
    });
    serwer = udawany.server;
    const shopUrl = await udawany.url;

    const klient = stworzKlientaSelly({
      shopUrl,
      clientId: "id",
      clientSecret: "sekret",
      scope: "READWRITE",
    });

    await expect(klient.listWarehouses()).rejects.toThrow(BladSelly);

    const daneowe = udawany.zadania.filter((z) => z.sciezka !== "/api/auth/access_token");
    expect(daneowe).toHaveLength(2);
  });

  /**
   * ⚠ Format komunikatu błędu jest CZĘŚCIĄ ZASTANEGO ZACHOWANIA: trafia żywcem do
   * `selly_sync_log.szczegoly_json` i widać go w `contract/fixtures/GET_selly_log.json`
   * (`[Selly] HTTP 400 ... Brak kategorii o id 1`). Nie wolno go „ładniej sformatować".
   */
  it("błąd HTTP niesie status i komunikat w formacie zapisywanym do dziennika", async () => {
    const udawany = udawanySelly((zad, res) => {
      if (zad.sciezka === "/api/auth/access_token") {
        odpowiedz(res, 200, { access_token: "TOKEN", expires_in: 3600 });
        return;
      }
      odpowiedz(res, 400, { error: "Brak kategorii o id 1" });
    });
    serwer = udawany.server;
    const shopUrl = await udawany.url;

    const klient = stworzKlientaSelly({
      shopUrl,
      clientId: "id",
      clientSecret: "sekret",
      scope: "READWRITE",
    });

    await expect(klient.createProduct({ name: "X" })).rejects.toMatchObject({
      name: "BladSelly",
      status: 400,
      message: expect.stringContaining("[Selly] HTTP 400 POST"),
    });
    await expect(klient.createProduct({ name: "X" })).rejects.toThrow(
      /Brak kategorii o id 1/,
    );
  });

  it("brak `access_token` w odpowiedzi jest błędem z treścią odpowiedzi", async () => {
    const udawany = udawanySelly((_zad, res) => odpowiedz(res, 200, { cos: "innego" }));
    serwer = udawany.server;
    const shopUrl = await udawany.url;

    const klient = stworzKlientaSelly({
      shopUrl,
      clientId: "id",
      clientSecret: "sekret",
      scope: "READWRITE",
    });

    await expect(klient.listVatRates()).rejects.toThrow(
      '[Selly] Brak access_token w odpowiedzi: {"cos":"innego"}',
    );
  });

  /**
   * ⚠ `limit` w słownikach idzie do Selly WPROST, bez capowania. Selly ma twardy limit 50
   * rekordów na zapytanie, ale oryginał capuje go wyłącznie w `listProducts` i `listOrders`
   * (`client.cjs:129,203`), a w `listProducers`/`listCategories` przekazuje wartość surową
   * (`:181-186`). Jedyny wołający (`slowniki.ts`) i tak podaje `limit: 50`, więc dodanie tu
   * capa byłoby logiką spoza oryginału — a ten test pilnuje, żeby nikt jej nie dołożył.
   */
  it("`limit` w słownikach idzie do Selly bez capowania", async () => {
    const udawany = udawanySelly((zad, res) => {
      if (zad.sciezka === "/api/auth/access_token") {
        odpowiedz(res, 200, { access_token: "TOKEN", expires_in: 3600 });
        return;
      }
      odpowiedz(res, 200, { data: [] });
    });
    serwer = udawany.server;
    const shopUrl = await udawany.url;

    const klient = stworzKlientaSelly({
      shopUrl,
      clientId: "id",
      clientSecret: "sekret",
      scope: "READWRITE",
    });

    await klient.listProducers({ limit: 500 });

    const daneowe = udawany.zadania.find((z) => z.sciezka.startsWith("/api/producers"));
    expect(daneowe?.sciezka).toBe("/api/producers?limit=500");
  });

  /**
   * Port `upsertProductWarehouse` (`client.cjs:139-151`): najpierw POST, a gdy Selly odbije
   * 400/409 — PUT na istniejące przypisanie. Warunek jest w oryginale, bo Selly potrafi
   * oddać 400 zamiast czystego 409.
   */
  it("`upsertProductWarehouse` po 409 przechodzi na PUT", async () => {
    const udawany = udawanySelly((zad, res) => {
      if (zad.sciezka === "/api/auth/access_token") {
        odpowiedz(res, 200, { access_token: "TOKEN", expires_in: 3600 });
        return;
      }
      if (zad.metoda === "POST") {
        odpowiedz(res, 409, { error: "przypisanie już istnieje" });
        return;
      }
      odpowiedz(res, 200, { data: { quantity: 5 } });
    });
    serwer = udawany.server;
    const shopUrl = await udawany.url;

    const klient = stworzKlientaSelly({
      shopUrl,
      clientId: "id",
      clientSecret: "sekret",
      scope: "READWRITE",
    });

    const wynik = await klient.upsertProductWarehouse(42, { warehouse_id: 3, quantity: 5 });

    expect(wynik).toEqual({ data: { quantity: 5 } });
    const put = udawany.zadania.find((z) => z.metoda === "PUT");
    expect(put?.sciezka).toBe("/api/products/42/warehouses/3");
    expect(JSON.parse(put?.cialo ?? "{}")).toEqual({ quantity: 5 });
  });

  it("`setProductMultiCat` bez kategorii nie wykonuje żadnego żądania", async () => {
    const udawany = udawanySelly((_zad, res) => odpowiedz(res, 200, {}));
    serwer = udawany.server;
    const shopUrl = await udawany.url;

    const klient = stworzKlientaSelly({
      shopUrl,
      clientId: "id",
      clientSecret: "sekret",
      scope: "READWRITE",
    });

    expect(await klient.setProductMultiCat(1, [])).toBeNull();
    expect(udawany.zadania).toHaveLength(0);
  });

  it("`ping` zwraca prefiks tokenu i liczbę stawek VAT", async () => {
    const udawany = udawanySelly((zad, res) => {
      if (zad.sciezka === "/api/auth/access_token") {
        odpowiedz(res, 200, { access_token: "eyJ0eXAiOiJKV1QiLCJhbGciOi", expires_in: 3600 });
        return;
      }
      odpowiedz(res, 200, { data: Array.from({ length: 15 }, (_, i) => ({ rate: i })) });
    });
    serwer = udawany.server;
    const shopUrl = await udawany.url;

    const klient = stworzKlientaSelly({
      shopUrl,
      clientId: "id",
      clientSecret: "sekret",
      scope: "READWRITE",
    });

    const wynik = await klient.ping();

    expect(wynik).toMatchObject({
      ok: true,
      shop: shopUrl,
      token_prefix: "eyJ0eXAiOiJK...",
      vat_probe: "OK (15 stawek)",
    });
    expect(wynik.expires_in_seconds).toBeGreaterThan(3500);
  });
});
