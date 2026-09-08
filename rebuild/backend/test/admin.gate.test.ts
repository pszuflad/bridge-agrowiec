/**
 * GATE ODBUDOWY — Iteracja 12, sesja 12b (konto, admin, utrzymanie, surowy audyt).
 *
 * Ścieżki kontraktu w zakresie: GET /api/users, GET /api/admin/supplier-config,
 * GET /api/admin/suppliers-list, GET /api/audit-log
 * (+ mutacje bez nagrań: POST /api/password/change, PATCH /api/admin/supplier-config/{kod},
 * POST /api/maintenance/usun-nieopony, POST /api/products/clear — sprawdzane wyłącznie
 * względem kontraktu, bo `contract/fixtures/` nie ma jeszcze nagrań zapisujących).
 *
 * Fixtures w zakresie: GET_users.json, GET_admin_supplier-config.json,
 * GET_admin_suppliers-list.json, GET_audit-log.json.
 *
 * Rozbieżność z fixture'em/kontraktem = STOP (nie poprawiamy fixture'a).
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  sprawdzZgodnoscZFixture,
  sprawdzZgodnoscZKontraktem,
  stworzSrodowiskoTestowe,
  wczytajFixture,
  zasiejAudytSurowy,
  zasiejDostawcowAdmina,
  type SrodowiskoTestowe,
} from "./gate/index.js";

/** Klucze wiersza z nagrania — porównanie kształtu nie wykryłoby BRAKU całego wiersza. */
function kluczePierwszegoWiersza(nazwaPliku: string, sciezkaDoTablicy?: string): string[] {
  const fixture = wczytajFixture(nazwaPliku);
  const cialo = fixture.body as Record<string, unknown> | unknown[];
  const tablica = (
    sciezkaDoTablicy ? (cialo as Record<string, unknown>)[sciezkaDoTablicy] : cialo
  ) as Record<string, unknown>[];
  return Object.keys(tablica[0]!).sort();
}

describe("GATE — kontrakt i fixtures dla konta, admina i utrzymania", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    zasiejDostawcowAdmina(srodowisko.db);
    zasiejAudytSurowy(srodowisko.db);
    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });

  afterAll(() => srodowisko.posprzataj());

  const zAuth = (sciezka: string) =>
    request(srodowisko.app).get(sciezka).set("Authorization", `Bearer ${token}`);

  it("GET /api/users zwraca kształt 1:1 z contract/fixtures/GET_users.json", async () => {
    const odp = await zAuth("/api/users");

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka: "/api/users", odpowiedz: odp });
    sprawdzZgodnoscZFixture("GET_users.json", odp.body);

    const wiersze = odp.body as Record<string, unknown>[];
    expect(wiersze.length).toBeGreaterThan(0);
    expect(Object.keys(wiersze[0]!).sort()).toEqual(kluczePierwszegoWiersza("GET_users.json"));
  });

  it("GET /api/admin/supplier-config zwraca kształt 1:1 z fixture", async () => {
    const odp = await zAuth("/api/admin/supplier-config");

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({
      metoda: "GET",
      sciezka: "/api/admin/supplier-config",
      odpowiedz: odp,
    });
    sprawdzZgodnoscZFixture("GET_admin_supplier-config.json", odp.body);

    const { dostawcy } = odp.body as { dostawcy: Record<string, unknown>[] };
    expect(Object.keys(dostawcy[0]!).sort()).toEqual(
      kluczePierwszegoWiersza("GET_admin_supplier-config.json", "dostawcy"),
    );
    // Fixture ma dziesięciu dostawców (marker `_przyciete: {dostawcy: 10}`) — tylu zna dispatcher.
    expect(dostawcy).toHaveLength(10);
  });

  it("GET /api/admin/suppliers-list zwraca kształt 1:1 z fixture", async () => {
    const odp = await zAuth("/api/admin/suppliers-list");

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({
      metoda: "GET",
      sciezka: "/api/admin/suppliers-list",
      odpowiedz: odp,
    });
    sprawdzZgodnoscZFixture("GET_admin_suppliers-list.json", odp.body);

    const { dostawcy } = odp.body as { dostawcy: Record<string, unknown>[] };
    expect(Object.keys(dostawcy[0]!).sort()).toEqual(
      kluczePierwszegoWiersza("GET_admin_suppliers-list.json", "dostawcy"),
    );
    expect(dostawcy).toHaveLength(10);
  });

  /**
   * ⚠ `szczegolyJson` w nagraniu produkcji jest STRINGIEM. Porównanie kształtu sprawdza typ,
   * więc gdyby handler zaczął parsować JSON (np. przez `parsujSzczegoly`), ten test zapali się
   * jako STOP — i o to chodzi. Osobna asercja niżej mówi to wprost, żeby powód porażki był
   * czytelny bez czytania `ksztalt.ts`.
   */
  it("GET /api/audit-log zwraca kształt 1:1 z contract/fixtures/GET_audit-log.json", async () => {
    const odp = await zAuth("/api/audit-log");

    expect(odp.status).toBe(200);
    sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka: "/api/audit-log", odpowiedz: odp });
    sprawdzZgodnoscZFixture("GET_audit-log.json", odp.body);

    const wiersze = odp.body as Record<string, unknown>[];
    expect(Object.keys(wiersze[0]!).sort()).toEqual(kluczePierwszegoWiersza("GET_audit-log.json"));

    const zeSzczegolami = wiersze.find((w) => w.szczegolyJson !== null)!;
    expect(
      typeof zeSzczegolami.szczegolyJson,
      "szczegolyJson musi zostać STRINGIEM — fixture zamraża string, parsowanie należy do frontu",
    ).toBe("string");
  });

  /**
   * Wiersz z `szczegoly_json = NULL` i `encja_id` spoza `suppliers` przechodzi przez GATE
   * razem z resztą — to dokładnie ten przypadek, który wywalał widok historii w I5.
   */
  it("GET /api/audit-log niesie wiersz z NULL i niezłączalnym encjaId bez naruszenia kształtu", async () => {
    const wiersze = (await zAuth("/api/audit-log")).body as Record<string, unknown>[];

    const reczna = wiersze.find((w) => w.akcja === "synchronizacja_reczna")!;
    expect(reczna.szczegolyJson).toBeNull();
    expect(reczna.encjaId).toBe("MO99");
    expect(srodowisko.sqlite.prepare("SELECT COUNT(*) c FROM suppliers WHERE kod='MO99'").get()).toEqual(
      { c: 0 },
    );
  });

  /**
   * Cztery mutacje tej sesji dostały nagrania w tickecie 38 (sesja 12d), z ORYGINAŁU
   * postawionego na kopii bazy (`tools/record-write-fixtures.cjs`). Do tego czasu gate
   * sprawdzał tu wyłącznie kontrakt (ścieżka, metoda, kod) — teraz także kształt ciała.
   */
  describe("mutacje — zgodność z kontraktem i fixtures", () => {
    it("PATCH /api/admin/supplier-config/{kod}", async () => {
      const odp = await request(srodowisko.app)
        .patch("/api/admin/supplier-config/MO1")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "aktywny" });

      expect(odp.status).toBe(200);
      sprawdzZgodnoscZKontraktem({
        metoda: "PATCH",
        sciezka: "/api/admin/supplier-config/MO1",
        odpowiedz: odp,
      });
      sprawdzZgodnoscZFixture("PATCH_admin_supplier-config_kod.json", odp.body);
    });

    it("POST /api/password/change (401 przy złym starym haśle)", async () => {
      const odp = await request(srodowisko.app)
        .post("/api/password/change")
        .set("Authorization", `Bearer ${token}`)
        .send({ oldPassword: "zle", newPassword: "nowe-haslo-123" });

      expect(odp.status).toBe(401);
      sprawdzZgodnoscZKontraktem({
        metoda: "POST",
        sciezka: "/api/password/change",
        odpowiedz: odp,
      });
    });

    it("POST /api/maintenance/usun-nieopony", async () => {
      const odp = await request(srodowisko.app)
        .post("/api/maintenance/usun-nieopony")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(odp.status).toBe(200);
      sprawdzZgodnoscZKontraktem({
        metoda: "POST",
        sciezka: "/api/maintenance/usun-nieopony",
        odpowiedz: odp,
      });
      sprawdzZgodnoscZFixture("POST_maintenance_usun-nieopony.json", odp.body);
    });

    it("POST /api/products/clear — 400 bez potwierdzenia i 200 z nim", async () => {
      const bez = await request(srodowisko.app)
        .post("/api/products/clear")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(bez.status).toBe(400);
      sprawdzZgodnoscZKontraktem({ metoda: "POST", sciezka: "/api/products/clear", odpowiedz: bez });
      sprawdzZgodnoscZFixture("POST_products_clear_400.json", bez.body);

      const z = await request(srodowisko.app)
        .post("/api/products/clear")
        .set("Authorization", `Bearer ${token}`)
        .send({ potwierdzenie: "WYCZYSC" });

      expect(z.status).toBe(200);
      sprawdzZgodnoscZKontraktem({ metoda: "POST", sciezka: "/api/products/clear", odpowiedz: z });
      sprawdzZgodnoscZFixture("POST_products_clear.json", z.body);
    });

    /**
     * Nagranie POWODZENIA zmiany hasła — osobno od istniejącego testu 401, bo to dwa różne
     * kształty ciała (`{ok:true}` vs `{error, code}`) i tylko oba razem opisują trasę.
     * Idzie na końcu bloku, bo unieważnia hasło, którym loguje się `beforeAll`.
     */
    it("POST /api/password/change — kształt odpowiedzi 200 z fixture'a", async () => {
      const odp = await request(srodowisko.app)
        .post("/api/password/change")
        .set("Authorization", `Bearer ${token}`)
        .send({ oldPassword: srodowisko.dane.haslo, newPassword: "NoweHasloGate1!" });

      expect(odp.status).toBe(200);
      sprawdzZgodnoscZKontraktem({
        metoda: "POST",
        sciezka: "/api/password/change",
        odpowiedz: odp,
      });
      sprawdzZgodnoscZFixture("POST_password_change.json", odp.body);
    });
  });

  /**
   * Wszystkie osiem operacji stoi za `requireAuth` — dla siedmiu to odtworzenie 1:1
   * (oryginał ma `we`), dla `GET /api/audit-log` świadome odstępstwo D2.
   */
  it("wszystkie osiem operacji oddaje 401 bez tokenu", async () => {
    const operacje: [string, string][] = [
      ["get", "/api/users"],
      ["get", "/api/admin/supplier-config"],
      ["get", "/api/admin/suppliers-list"],
      ["get", "/api/audit-log"],
      ["patch", "/api/admin/supplier-config/MO1"],
      ["post", "/api/password/change"],
      ["post", "/api/maintenance/usun-nieopony"],
      ["post", "/api/products/clear"],
    ];

    for (const [metoda, sciezka] of operacje) {
      const odp = await (request(srodowisko.app) as unknown as Record<string, (s: string) => request.Test>)[
        metoda
      ]!(sciezka).send({});
      expect(odp.status, `${metoda.toUpperCase()} ${sciezka} bez tokenu`).toBe(401);
    }
  });
});
