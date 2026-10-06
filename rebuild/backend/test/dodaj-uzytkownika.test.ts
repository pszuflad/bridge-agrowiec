/** Konto założone z hasłem tymczasowym loguje się nim i może ustawić własne hasło. */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dodajUzytkownika } from "../src/auth/dodaj-uzytkownika.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";

describe("dodajUzytkownika", () => {
  let s: SrodowiskoTestowe;
  const email = "nowy.uzytkownik@agrowiec.eu";
  const tymczasowe = "Tymczasowe2026!";
  beforeAll(async () => {
    s = await stworzSrodowiskoTestowe();
  });
  afterAll(() => s.posprzataj());

  const login = (password: string) => request(s.app).post("/api/login").send({ email, password });

  it("zakłada konto, loguje, zmiana hasła zapisuje się, ponowne dodanie nie nadpisuje", async () => {
    expect(await dodajUzytkownika(s.db, email, "Nowy Użytkownik", tymczasowe)).toBe("utworzono");

    const odp = await login(tymczasowe);
    expect(odp.status).toBe(200);
    const token = (odp.body as { token: string }).token;

    const zmiana = await request(s.app)
      .post("/api/password/change")
      .set("Authorization", `Bearer ${token}`)
      .send({ oldPassword: tymczasowe, newPassword: "MojeWlasne2026" });
    expect(zmiana.status).toBe(200);

    expect(await dodajUzytkownika(s.db, email, "Nowy Użytkownik", tymczasowe)).toBe("istnieje");
    expect((await login(tymczasowe)).status).toBe(401);
    expect((await login("MojeWlasne2026")).status).toBe(200);
  });
});
