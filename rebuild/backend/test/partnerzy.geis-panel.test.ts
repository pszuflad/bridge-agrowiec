/** Ticket 244: import tabel GEIS z Excela, podgląd i edycja przez API (dane syntetyczne, nie prawdziwy cennik). */
import request from "supertest";
import * as XLSX from "xlsx";
import { afterEach, describe, expect, it } from "vitest";

import { parsujGeisXlsx } from "../src/partnerzy/geis-xlsx.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";

const arkusz = (wsp: number, maks: string, stawki: [number, number][]): XLSX.WorkSheet =>
  XLSX.utils.aoa_to_sheet([
    [],
    ["GEIS — test"],
    ["Parametr", null, "Wartość"],
    ["Opłata paliwowa", null, 1.11],
    ["Koszt pakowania", null, 2],
    ["Współczynnik wagi gabarytowej", null, wsp],
    ["Maks. długość / szerokość / wysokość", null, maks],
    [],
    ["Waga", "1", "2", "Średnia"],
    ...stawki.map(([p, s]) => [p, s, null, s]),
  ]);

function xlsx(arkusze: Record<string, XLSX.WorkSheet>): Buffer {
  const wb = XLSX.utils.book_new();
  for (const [n, a] of Object.entries(arkusze)) XLSX.utils.book_append_sheet(wb, a, n);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("parsujGeisXlsx", () => {
  it("czyta parametry i kolumnę „1” stawek; „0 × 0 × 0” = brak limitu; nieznany arkusz pomijany z ostrzeżeniem", () => {
    const w = parsujGeisXlsx(xlsx({
      Austria: arkusz(200, "240 × 240 × 220", [[50, 57], [100, 61]]),
      Łotwa: arkusz(250, "0 × 0 × 0", [[50, 80]]),
      Inne: arkusz(250, "0 × 0 × 0", [[50, 80]]),
    }));
    expect(w.dane.AT).toEqual({ wspGabarytowy: 200, kosztPakowania: 2, maks: [240, 240, 220], stawki: [[50, 57], [100, 61]] });
    expect(w.dane.LV).toMatchObject({ wspGabarytowy: 250, maks: null });
    expect(w.ostrzezenia).toEqual(["Arkusz „Inne”: nieznany kraj — pominięty."]);
  });

  it("brak współczynnika lub stawek to błąd z nazwą arkusza", () => {
    expect(() => parsujGeisXlsx(xlsx({ Francja: XLSX.utils.aoa_to_sheet([["Waga", "1"], [50, 10]]) }))).toThrow(/Francja.*współczynnik/);
    expect(() => parsujGeisXlsx(xlsx({ Francja: arkusz(250, "0 × 0 × 0", []) }))).toThrow(/Francja.*stawek/);
    expect(() => parsujGeisXlsx(xlsx({ Inne: arkusz(250, "0 × 0 × 0", [[1, 1]]) }))).toThrow(/żadnego arkusza/);
  });
});

describe("API GEIS", () => {
  let s: SrodowiskoTestowe;
  afterEach(() => s.posprzataj());
  const token = async (): Promise<string> => {
    const odp = await request(s.app).post("/api/login").send({ email: s.dane.email, password: s.dane.haslo });
    return (odp.body as { token: string }).token;
  };

  it("import → podgląd → edycja kraju; błędne dane odrzucone", async () => {
    s = await stworzSrodowiskoTestowe();
    const t = await token();
    const auth = { Authorization: `Bearer ${t}` };
    const imp = await request(s.app).post("/api/partnerzy/geis/import").set(auth).attach("plik", xlsx({ Francja: arkusz(250, "0 × 0 × 0", [[50, 100], [100, 150]]) }), "g.xlsx");
    expect(imp.status).toBe(200);
    expect(imp.body).toMatchObject({ zaimportowano: 1, kraje: ["FR"] });

    const lista = await request(s.app).get("/api/partnerzy/geis").set(auth);
    expect(lista.body.kraje).toEqual([{ kraj: "FR", wspGabarytowy: 250, kosztPakowania: 2, maks: null, stawki: [[50, 100], [100, 150]] }]);

    const put = await request(s.app).put("/api/partnerzy/geis/FR").set(auth).send({ wspGabarytowy: 200, kosztPakowania: 3, maks: [100, 100, 100], stawki: [[50, 90], [200, 300]] });
    expect(put.status).toBe(200);
    expect(put.body.kraje[0]).toEqual({ kraj: "FR", wspGabarytowy: 200, kosztPakowania: 3, maks: [100, 100, 100], stawki: [[50, 90], [200, 300]] });

    expect((await request(s.app).put("/api/partnerzy/geis/FR").set(auth).send({ wspGabarytowy: 0, stawki: [[1, 1]] })).status).toBe(400);
    expect((await request(s.app).put("/api/partnerzy/geis/FR").set(auth).send({ wspGabarytowy: 200, stawki: [[50, 1], [50, 2]] })).status).toBe(400);
    expect((await request(s.app).post("/api/partnerzy/geis/import").set(auth)).status).toBe(400);
    expect((await request(s.app).post("/api/partnerzy/geis/import").set(auth).attach("plik", Buffer.from("nie excel"), "x.xlsx")).status).toBe(400);
  });

  it("podgląd kosztu przesyłki: rozbicie GEIS (waga rozliczeniowa, stawka, paliwo, myto, pakowanie); błędy 400/404", async () => {
    s = await stworzSrodowiskoTestowe();
    const auth = { Authorization: `Bearer ${await token()}` };
    await request(s.app).post("/api/partnerzy/geis/import").set(auth).attach("plik", xlsx({ Francja: arkusz(250, "0 × 0 × 0", [[50, 100], [100, 150], [200, 260]]) }), "g.xlsx");
    const id = Number((await request(s.app).post("/api/partnerzy").set(auth).send({ nazwa: "P" })).body.id);
    await request(s.app).put(`/api/partnerzy/${id}/kraje/FR`).set(auth).send({ narzutProc: 10, mytoEur: 9.92, pakowanieEur: 15, paliwoProc: 44 });
    const paczka = { partnerId: id, kraj: "FR", waga: 60, dlugosc: 100, szerokosc: 100, wysokosc: 100 };

    // gabaryt: 1 m × 1 m × (1 m + 10 cm palety) × 250 = 275 kg > 200 → błąd; mniejsza paczka 80×50×100: szerokość 50 → 60, wysokość 110 → 0,528 m³ × 250 = 132 kg → próg 200
    const za_duza = await request(s.app).post("/api/partnerzy/geis/podglad-kosztu").set(auth).send(paczka);
    expect(za_duza.status).toBe(400);
    expect(za_duza.body.error).toMatch(/przekracza najwyższy próg/);

    const ok = await request(s.app).post("/api/partnerzy/geis/podglad-kosztu").set(auth).send({ ...paczka, dlugosc: 80, szerokosc: 50, wysokosc: 100 });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ zrodlo: "geis", wagaRozliczeniowa: 132, progKg: 200, baza: 260, paliwoProc: 44, mytoEur: 9.92, pakowanieKrajuEur: 15 });
    expect(ok.body.razemEur).toBeCloseTo(260 * 1.44 + 2 + 9.92 + 15, 6); // pakowanie GEIS (2) z arkusza testowego

    expect((await request(s.app).post("/api/partnerzy/geis/podglad-kosztu").set(auth).send({ ...paczka, kraj: "DE" })).status).toBe(400);
    expect((await request(s.app).post("/api/partnerzy/geis/podglad-kosztu").set(auth).send({ ...paczka, partnerId: 999 })).status).toBe(404);
  });

  it("bez zalogowania 401", async () => {
    s = await stworzSrodowiskoTestowe();
    expect((await request(s.app).get("/api/partnerzy/geis")).status).toBe(401);
  });
});
