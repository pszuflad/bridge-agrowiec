/**
 * GATE ODBUDOWY — alerty (Iteracja 6).
 *
 * Ścieżki w zakresie: `GET /api/alerts`, `PATCH /api/alerts/{id}`.
 * Fixture: `GET_alerts.json`. Dla PATCH-a **nie ma nagranej próbki** — jego kształt
 * (`{ok:true}`, brak 404) stoi wyłącznie na kodzie oryginału `backend-index.cjs:48688-48691`,
 * i właśnie dlatego jest tu przypięty testem: to jedyne miejsce, gdzie ta wiedza żyje.
 *
 * Rozbieżność z fixture'em = STOP (nie poprawiamy fixture'a).
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { alerts } from "../src/db/schema.js";
import {
  sprawdzZgodnoscZFixture,
  sprawdzZgodnoscZKontraktem,
  stworzSrodowiskoTestowe,
  wczytajFixture,
  type SrodowiskoTestowe,
} from "./gate/index.js";

type WierszAlertu = Record<string, unknown>;

describe("GATE — kontrakt i fixtures dla alertów", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();

    // Zasiew WPROST z fixture'a — dokładnie te wartości, które nagrała produkcja.
    const fixture = wczytajFixture("GET_alerts.json");
    srodowisko.db
      .insert(alerts)
      .values(fixture.body as WierszAlertu[] as never)
      .run();

    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });

  afterAll(() => srodowisko.posprzataj());

  const zAuth = (sciezka: string) =>
    request(srodowisko.app).get(sciezka).set("Authorization", `Bearer ${token}`);

  it("GET /api/alerts zwraca kształt 1:1 z contract/fixtures/GET_alerts.json", async () => {
    const odp = await zAuth("/api/alerts");

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka: "/api/alerts", odpowiedz: odp });
    sprawdzZgodnoscZFixture("GET_alerts.json", odp.body);
  });

  /**
   * Odpowiedź jest GOŁĄ TABLICĄ, bez koperty `{items,total}` — `listAlerts()` nie ma
   * ani limitu, ani offsetu (`:44951`). `porownajKsztalt` sam z siebie nie odróżni
   * pustej tablicy od poprawnej, więc liczba pól i pozycji jest sprawdzana wprost.
   */
  it("odpowiedź jest gołą tablicą z kompletem 7 pól w każdej pozycji", async () => {
    const fixture = wczytajFixture("GET_alerts.json");
    const wzorcowy = (fixture.body as WierszAlertu[])[0]!;
    const oczekiwaneKlucze = Object.keys(wzorcowy).sort();
    expect(oczekiwaneKlucze).toEqual(
      ["data", "dostawca", "id", "opis", "poziom", "status", "typ"].sort(),
    );

    const odp = await zAuth("/api/alerts");
    const pozycje = odp.body as WierszAlertu[];

    expect(Array.isArray(pozycje)).toBe(true);
    expect(pozycje.length).toBe((fixture.body as unknown[]).length);
    for (const pozycja of pozycje) {
      expect(Object.keys(pozycja).sort()).toEqual(oczekiwaneKlucze);
    }
  });

  /**
   * KOLEJNOŚĆ JEST CZĘŚCIĄ KONTRAKTU, nie szczegółem: `listAlerts` sortuje `data`
   * MALEJĄCO (`Ii(Ki.data)`, `:44951`), a nagrana próbka to potwierdza — pięć wierszy
   * idzie od 15:45:27 do 15:44:40. Widok `/alerty` wyprowadza z tej kolejności
   * „ostatnio o 14:45" dla każdej zwiniętej grupy.
   */
  it("lista jest posortowana `data` MALEJĄCO — dokładnie jak w nagranej próbce", async () => {
    const fixture = wczytajFixture("GET_alerts.json");
    const oczekiwaneId = (fixture.body as WierszAlertu[]).map((a) => a.id);

    const odp = await zAuth("/api/alerts");
    expect((odp.body as WierszAlertu[]).map((a) => a.id)).toEqual(oczekiwaneId);

    const znaczniki = (odp.body as WierszAlertu[]).map((a) => String(a.data));
    expect([...znaczniki].sort().reverse()).toEqual(znaczniki);
  });

  /**
   * ODSTĘPSTWO ŚWIADOME (D1 z I1): w produkcji `GET /api/alerts` jest PUBLICZNY
   * (`security: []` w `contract/openapi.yaml:67`, brak `we` przy `:48688`), a my wymagamy
   * `requireAuth` — jak przy każdej innej trasie danych od I1.
   *
   * ⚠ Brak `sprawdzZgodnoscZKontraktem` jest tu CELOWY: kontrakt deklaruje dla tej ścieżki
   * wyłącznie 200 i 400, więc 401 nie mieści się w jego liście kodów. To właśnie jest
   * to odstępstwo — udawanie, że kontrakt je przewiduje, byłoby zamiataniem go pod dywan.
   */
  it("GET /api/alerts bez tokenu daje 401 (odstępstwo D1 — oryginał ma trasę publiczną)", async () => {
    const odp = await request(srodowisko.app).get("/api/alerts");
    expect(odp.status).toBe(401);
  });

  it("PATCH /api/alerts/{id} zmienia status i oddaje {ok:true}", async () => {
    const fixture = wczytajFixture("GET_alerts.json");
    const cel = (fixture.body as WierszAlertu[])[0]!;
    expect(cel.status).toBe("rozwiazany");

    const odp = await request(srodowisko.app)
      .patch(`/api/alerts/${String(cel.id)}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "nowy" });

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({
      metoda: "PATCH",
      sciezka: `/api/alerts/${String(cel.id)}`,
      odpowiedz: odp,
    });
    expect(odp.body).toEqual({ ok: true });

    const poZmianie = (await zAuth("/api/alerts")).body as WierszAlertu[];
    expect(poZmianie.find((a) => a.id === cel.id)?.status).toBe("nowy");

    // Przywrócenie stanu z fixture'a — kolejne testy w tym pliku porównują się z nim.
    await request(srodowisko.app)
      .patch(`/api/alerts/${String(cel.id)}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: String(cel.status) });
  });

  /**
   * ODTWORZONE 1:1 (decyzja D4): oryginał NIE sprawdza istnienia wiersza — UPDATE bez
   * trafienia jest cichym no-opem, a trasa i tak oddaje `{ok:true}`. Bliźniacze
   * `DELETE /api/overrides/:id` i `PATCH /api/markups/:id` 404 mają; ta trasa nie.
   */
  it("PATCH dla NIEISTNIEJĄCEGO id oddaje 200 {ok:true}, a nie 404", async () => {
    const przed = ((await zAuth("/api/alerts")).body as WierszAlertu[]).length;

    const odp = await request(srodowisko.app)
      .patch("/api/alerts/999999")
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "rozwiazany" });

    expect(odp.status).toBe(200);
    expect(odp.body).toEqual({ ok: true });
    expect(((await zAuth("/api/alerts")).body as WierszAlertu[]).length).toBe(przed);
  });

  /** `we` przy `:48689` — tę trasę oryginał chroni sam z siebie, bez odstępstwa. */
  it("PATCH bez tokenu daje 401 — jak w oryginale", async () => {
    const fixture = wczytajFixture("GET_alerts.json");
    const cel = (fixture.body as WierszAlertu[])[0]!;

    const odp = await request(srodowisko.app)
      .patch(`/api/alerts/${String(cel.id)}`)
      .send({ status: "nowy" });

    expect(odp.status).toBe(401);
    sprawdzZgodnoscZKontraktem({
      metoda: "PATCH",
      sciezka: `/api/alerts/${String(cel.id)}`,
      odpowiedz: odp,
    });
  });

  /**
   * ODTWORZONE 1:1 (decyzja D4): brak wpisu do `audit_log`. To jedyny PATCH w rebuildzie
   * bez audytu — overrides i markups audytują każdą zmianę. Test pilnuje, żeby ktoś
   * „dla spójności" nie dołożył audytu bez decyzji użytkownika.
   */
  it("PATCH nie zostawia śladu w audit_log — inaczej niż overrides i markups", async () => {
    const fixture = wczytajFixture("GET_alerts.json");
    const cel = (fixture.body as WierszAlertu[])[1]!;

    const przed = srodowisko.sqlite.prepare("SELECT COUNT(*) AS ile FROM audit_log").get() as {
      ile: number;
    };

    await request(srodowisko.app)
      .patch(`/api/alerts/${String(cel.id)}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "nowy" });

    const po = srodowisko.sqlite.prepare("SELECT COUNT(*) AS ile FROM audit_log").get() as {
      ile: number;
    };
    expect(po.ile).toBe(przed.ile);
  });
});
