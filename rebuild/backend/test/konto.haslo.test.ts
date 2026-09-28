/**
 * `POST /api/password/change` i `GET /api/users` — port `P4()` + trasy `:48195-48223`.
 *
 * Testy chodzą po prawdziwym bcrypcie i prawdziwym SQLite (katalog tymczasowy), bo cała
 * wartość tej trasy siedzi w tym, czy po zmianie hasła DA SIĘ SIĘ ZALOGOWAĆ nowym, a starym
 * już nie. Zamockowany `porownajHaslo` sprawdzałby wyłącznie to, że wywołaliśmy własną atrapę.
 */
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { auditLog } from "../src/db/schema.js";
import { pobierzUzytkownikaPoEmailu } from "../src/repos/users.js";
import { zahashujHaslo } from "../src/auth/password.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";

describe("POST /api/password/change", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  const zaloguj = (haslo: string) =>
    request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: haslo });

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    const odp = await zaloguj(srodowisko.dane.haslo);
    token = (odp.body as { token: string }).token;
  });

  afterAll(() => srodowisko.posprzataj());

  /**
   * Każdy test dostaje hasło w stanie wyjściowym. Testy zmieniające hasło robią to
   * NAPRAWDĘ (jedna baza na cały plik), więc bez tego resetu kolejny test logowałby się
   * nieaktualnym hasłem — a wynik zależałby od kolejności wykonania.
   */
  beforeEach(async () => {
    const hash = await zahashujHaslo(srodowisko.dane.haslo);
    srodowisko.sqlite
      .prepare("UPDATE users SET haslo_hash = ? WHERE id = ?")
      .run(hash, srodowisko.uzytkownik.id);
    srodowisko.sqlite.prepare("DELETE FROM audit_log").run();
  });

  const zmien = (cialo: unknown) =>
    request(srodowisko.app)
      .post("/api/password/change")
      .set("Authorization", `Bearer ${token}`)
      .send(cialo as object);

  it("wymaga tokenu", async () => {
    const odp = await request(srodowisko.app)
      .post("/api/password/change")
      .send({ oldPassword: srodowisko.dane.haslo, newPassword: "nowe-haslo-123" });

    expect(odp.status).toBe(401);
    expect(odp.body).toEqual({ error: "Nieautoryzowany" });
  });

  it("odrzuca ciało bez obu pól typu string (400, bez kodu)", async () => {
    for (const cialo of [{}, { oldPassword: "x" }, { newPassword: "y" }, { oldPassword: 1, newPassword: 2 }]) {
      const odp = await zmien(cialo);
      expect(odp.status).toBe(400);
      expect(odp.body).toEqual({ error: "Wymagane: oldPassword i newPassword" });
    }
  });

  it("błędne stare hasło daje 401 WRONG_OLD_PASSWORD", async () => {
    const odp = await zmien({ oldPassword: "nie-to-haslo", newPassword: "nowe-haslo-123" });

    expect(odp.status).toBe(401);
    expect(odp.body).toEqual({
      error: "Aktualne hasło jest nieprawidłowe",
      code: "WRONG_OLD_PASSWORD",
    });
  });

  it("nowe hasło krótsze niż 8 znaków daje 400 WEAK_PASSWORD", async () => {
    const odp = await zmien({ oldPassword: srodowisko.dane.haslo, newPassword: "1234567" });

    expect(odp.status).toBe(400);
    expect(odp.body).toEqual({
      error: "Nowe hasło musi mieć co najmniej 8 znaków",
      code: "WEAK_PASSWORD",
    });
  });

  it("nowe hasło równe aktualnemu daje 400 SAME_PASSWORD", async () => {
    const odp = await zmien({
      oldPassword: srodowisko.dane.haslo,
      newPassword: srodowisko.dane.haslo,
    });

    expect(odp.status).toBe(400);
    expect(odp.body).toEqual({
      error: "Nowe hasło musi być inne niż aktualne",
      code: "SAME_PASSWORD",
    });
  });

  /**
   * ⚠ KOLEJNOŚĆ SPRAWDZEŃ (`P4`, `:47913` przed `:47919`): złe stare hasło wygrywa
   * z za słabym nowym. Gdyby ktoś przestawił te dwa bloki, komunikat zdradzałby regułę
   * długości hasła osobie, która nie zna aktualnego hasła.
   */
  it("złe stare hasło ma pierwszeństwo przed za słabym nowym", async () => {
    const odp = await zmien({ oldPassword: "nie-to-haslo", newPassword: "krotkie" });

    expect(odp.status).toBe(401);
    expect((odp.body as { code: string }).code).toBe("WRONG_OLD_PASSWORD");
  });

  it("zmienia hasło naprawdę: stare przestaje działać, nowe działa", async () => {
    const odp = await zmien({ oldPassword: srodowisko.dane.haslo, newPassword: "nowe-haslo-123" });

    expect(odp.status).toBe(200);
    expect(odp.body).toEqual({ ok: true });

    expect((await zaloguj(srodowisko.dane.haslo)).status).toBe(401);
    expect((await zaloguj("nowe-haslo-123")).status).toBe(200);

    // Hash w bazie faktycznie się zmienił i nie jest tekstem jawnym.
    const uzytkownik = pobierzUzytkownikaPoEmailu(srodowisko.db, srodowisko.dane.email);
    expect(uzytkownik?.hasloHash).toMatch(/^\$2[aby]\$10\$/);
    expect(uzytkownik?.hasloHash).not.toContain("nowe-haslo-123");
  });

  it("zapisuje audyt zmiana_hasla z e-mailem, bez hasła", async () => {
    await zmien({ oldPassword: srodowisko.dane.haslo, newPassword: "nowe-haslo-123" });

    const wpisy = srodowisko.db.select().from(auditLog).all();
    expect(wpisy).toHaveLength(1);
    const wpis = wpisy[0]!;
    expect(wpis).toMatchObject({
      uzytkownikId: srodowisko.uzytkownik.id,
      uzytkownikImie: srodowisko.uzytkownik.imieNazwisko,
      akcja: "zmiana_hasla",
      encjaTyp: "user",
      encjaId: String(srodowisko.uzytkownik.id),
    });
    expect(JSON.parse(wpis.szczegolyJson!)).toEqual({ email: srodowisko.dane.email });
    expect(wpis.szczegolyJson).not.toContain("nowe-haslo-123");
  });

  it("nieudana zmiana nie zostawia śladu w audycie", async () => {
    await zmien({ oldPassword: "nie-to-haslo", newPassword: "nowe-haslo-123" });

    expect(srodowisko.db.select().from(auditLog).all()).toHaveLength(0);
  });
});

describe("GET /api/users", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });

  afterAll(() => srodowisko.posprzataj());

  it("wymaga tokenu", async () => {
    const odp = await request(srodowisko.app).get("/api/users");
    expect(odp.status).toBe(401);
  });

  /**
   * Najważniejsza asercja tej trasy: `hasloHash` NIE MOŻE wyciec. Gołe `select()` z Drizzle
   * oddałoby wszystkie kolumny modelu — dlatego `listaUzytkownikow` ma projekcję jawną.
   */
  it("zwraca dokładnie trzy pola, bez hasła", async () => {
    const odp = await request(srodowisko.app)
      .get("/api/users")
      .set("Authorization", `Bearer ${token}`);

    expect(odp.status).toBe(200);
    expect(Array.isArray(odp.body)).toBe(true);
    for (const wiersz of odp.body as Record<string, unknown>[]) {
      expect(Object.keys(wiersz).sort()).toEqual(["email", "id", "imieNazwisko"]);
    }
    expect(JSON.stringify(odp.body)).not.toMatch(/\$2[aby]\$/);
  });
});
