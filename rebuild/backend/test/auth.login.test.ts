/** POST /api/login — wierne odtworzenie backend-index.cjs:48156-48174. */
import { eq } from "drizzle-orm";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NAZWA_COOKIE_SESJI } from "../src/auth/cookie.js";
import { zweryfikujToken } from "../src/auth/jwt.js";
import { users } from "../src/db/schema.js";
import { SEKRET_TESTOWY, stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";

describe("POST /api/login", () => {
  let s: SrodowiskoTestowe;

  beforeEach(async () => {
    s = await stworzSrodowiskoTestowe();
  });
  afterEach(() => s.posprzataj());

  it("400 gdy brakuje pól — komunikat verbatim jak w oryginale", async () => {
    for (const ciało of [{}, { email: s.dane.email }, { password: s.dane.haslo }]) {
      const odp = await request(s.app).post("/api/login").send(ciało);
      expect(odp.status).toBe(400);
      expect(odp.body).toEqual({ error: "Email i hasło są wymagane" });
    }
  });

  it("401 dla nieznanego e-maila i dla złego hasła — TEN SAM komunikat", async () => {
    const nieznany = await request(s.app)
      .post("/api/login")
      .send({ email: "nikt@example.test", password: s.dane.haslo });
    const zleHaslo = await request(s.app)
      .post("/api/login")
      .send({ email: s.dane.email, password: "nie-to-haslo" });

    expect(nieznany.status).toBe(401);
    expect(zleHaslo.status).toBe(401);
    // Oryginał nie zdradza, który człon jest błędny — nie „poprawiamy" tego.
    expect(nieznany.body).toEqual({ error: "Nieprawidłowy email lub hasło" });
    expect(zleHaslo.body).toEqual(nieznany.body);
  });

  it("200 zwraca {ok, user, token} i nie wypuszcza hasła", async () => {
    const odp = await request(s.app)
      .post("/api/login")
      .send({ email: s.dane.email, password: s.dane.haslo });

    expect(odp.status).toBe(200);
    expect(odp.body).toMatchObject({
      ok: true,
      user: { id: s.uzytkownik.id, email: s.dane.email, imieNazwisko: s.dane.imieNazwisko },
    });
    expect(Object.keys(odp.body as object).sort()).toEqual(["ok", "token", "user"]);
    expect(Object.keys((odp.body as { user: object }).user).sort()).toEqual([
      "email",
      "id",
      "imieNazwisko",
    ]);
    expect(JSON.stringify(odp.body)).not.toContain("$2");
    expect(JSON.stringify(odp.body)).not.toContain("hasloHash");
  });

  it("token z ciała jest ważny i niesie payload {id, email, imieNazwisko}", async () => {
    const odp = await request(s.app)
      .post("/api/login")
      .send({ email: s.dane.email, password: s.dane.haslo });

    const payload = zweryfikujToken((odp.body as { token: string }).token, SEKRET_TESTOWY);
    expect(payload).toMatchObject({
      id: s.uzytkownik.id,
      email: s.dane.email,
      imieNazwisko: s.dane.imieNazwisko,
    });
  });

  it("ustawia cookie bridge_session z tym samym tokenem (HttpOnly, Path=/, 30 dni)", async () => {
    const odp = await request(s.app)
      .post("/api/login")
      .send({ email: s.dane.email, password: s.dane.haslo });

    const setCookie = odp.headers["set-cookie"] as unknown as string[];
    const cookie = setCookie.find((c) => c.startsWith(`${NAZWA_COOKIE_SESJI}=`));
    expect(cookie).toBeDefined();
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=2592000");
    expect(cookie).toContain("SameSite=Lax");
    // NODE_ENV=test → bez Secure, żeby cookie działało po HTTP (plan.md O4).
    expect(cookie).not.toContain("Secure");

    const zCookie = decodeURIComponent(cookie!.split(";")[0]!.split("=").slice(1).join("="));
    expect(zCookie).toBe((odp.body as { token: string }).token);
  });

  it("zapisuje ostatnie_logowanie przy udanym logowaniu", async () => {
    const przed = s.db.select().from(users).where(eq(users.id, s.uzytkownik.id)).get();
    expect(przed?.ostatnieLogowanie).toBeNull();

    await request(s.app)
      .post("/api/login")
      .send({ email: s.dane.email, password: s.dane.haslo });

    const po = s.db.select().from(users).where(eq(users.id, s.uzytkownik.id)).get();
    expect(po?.ostatnieLogowanie).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("NIE zapisuje ostatniego logowania przy błędnym haśle", async () => {
    await request(s.app)
      .post("/api/login")
      .send({ email: s.dane.email, password: "nie-to-haslo" });

    const po = s.db.select().from(users).where(eq(users.id, s.uzytkownik.id)).get();
    expect(po?.ostatnieLogowanie).toBeNull();
  });

  it("e-mail dopasowywany DOKŁADNIE — bez trim i bez ignorowania wielkości liter", async () => {
    // Oryginał: where eq(users.email, t) (backend-index.cjs:45052). Trim robi frontend.
    for (const email of [` ${s.dane.email}`, s.dane.email.toUpperCase()]) {
      const odp = await request(s.app).post("/api/login").send({ email, password: s.dane.haslo });
      expect(odp.status).toBe(401);
    }
  });

  it("nie-stringowe pola nie wywracają serwera (400, nie 500)", async () => {
    const odp = await request(s.app)
      .post("/api/login")
      .send({ email: { $ne: null }, password: ["x"] });
    expect(odp.status).toBe(400);
  });
});
