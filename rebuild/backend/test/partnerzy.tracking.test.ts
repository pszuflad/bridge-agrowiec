/** Ticket 256: tracking zamówień partnerów — numer listu z panelu → plik CSV (format wg założenia użytkowniczki) w katalogu partnera. */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { eq } from "drizzle-orm";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { partnerWysylki, partnerZamowienia, partnerZamowieniaPozycje, partnerzy, products } from "../src/db/schema.js";
import { NAGLOWEK_TRACKINGU, czasPolski, komorkaCsv } from "../src/partnerzy/tracking.js";
import { zapiszZamowienie } from "../src/repos/partnerzy-zamowienia.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";
import { XML_PRZYKLAD } from "./partnerzy.zamowienie-przyklad.js";

describe("czasPolski / komorkaCsv", () => {
  it("czas w strefie Europe/Warsaw z przesunięciem (lato +02:00, zima +01:00) — jak w przykładzie użytkowniczki", () => {
    expect(czasPolski(new Date("2026-10-13T11:30:00Z"))).toBe("2026-10-13T13:30:00+02:00");
    expect(czasPolski(new Date("2026-01-15T11:30:00Z"))).toBe("2026-01-15T12:30:00+01:00");
  });
  it("komórka CSV: cudzysłów tylko gdy trzeba (średnik, cudzysłów, nowa linia)", () => {
    expect(komorkaCsv("PL123")).toBe("PL123");
    expect(komorkaCsv('a;b')).toBe('"a;b"');
    expect(komorkaCsv('a"b')).toBe('"a""b"');
    expect(komorkaCsv(2)).toBe("2");
  });
});

describe("przesyłki zamówień partnera", () => {
  let s: SrodowiskoTestowe;
  let katalog: string;
  beforeEach(() => {
    katalog = mkdtempSync(join(tmpdir(), "bridge-256-"));
  });
  afterEach(() => {
    s.posprzataj();
    rmSync(katalog, { recursive: true, force: true });
  });

  const przygotuj = async (katalogi?: ReadonlyMap<string, string>) => {
    s = await stworzSrodowiskoTestowe(undefined, { katalogiTrackingu: katalogi });
    const partnerId = Number(s.db.insert(partnerzy).values({ nazwa: "Adtyres", aktywny: true, utworzono: "x", zmieniono: "x" }).run().lastInsertRowid);
    s.db.insert(products).values({
      kod: "011200284", nazwa: "OPONA", marka: "CEAT", kategoria: "Rolnicze", dostawca: "MO1", magazyn: "MO1", stan: 9, cenaZakupu: 100, cenaSprzedazy: 150, marzaPct: 50,
      dataAktualizacji: "2026-10-10T00:00:00.000Z", kodImportu: "I1", ean: "8907375028320",
    }).run();
    const id = zapiszZamowienie(s.db, partnerId, XML_PRZYKLAD).id; // pozycje: 011200284 × 2 oraz „0102 00001” × 1
    s.db.update(partnerZamowienia).set({ status: "przyjete" }).where(eq(partnerZamowienia.id, id)).run();
    const login = await request(s.app).post("/api/login").send({ email: s.dane.email, password: s.dane.haslo });
    const auth = { Authorization: `Bearer ${(login.body as { token: string }).token}` };
    const url = `/api/partnerzy/${partnerId}/zamowienia/${id}/przesylki`;
    const pozycje = s.db.select().from(partnerZamowieniaPozycje).where(eq(partnerZamowieniaPozycje.zamowienieId, id)).all();
    return { partnerId, id, auth, url, pozycje };
  };

  it("numer listu → przesyłka i plik CSV w katalogu partnera: nagłówek, linia na pozycję, EAN z katalogu, numer zamówienia ZAM-<id> (jeszcze bez Selly)", async () => {
    const { id, auth, url } = await przygotuj(new Map([["adtyres", katalog]]));
    const odp = await request(s.app).post(url).set(auth).send({ przewoznik: "GEIS", numerPrzesylki: "PL2309159791276001", wyslano: "2026-10-13T11:30:00Z" });
    expect(odp.status).toBe(200);
    expect(odp.body.plik).toBe("zapisany");
    const pliki = readdirSync(katalog);
    expect(pliki).toHaveLength(1);
    expect(pliki[0]).toMatch(/^tracking_A01UF90224_20261013-133000_\d+\.csv$/);
    const linie = readFileSync(join(katalog, pliki[0]!), "utf8").trimEnd().split("\n");
    expect(linie[0]).toBe(NAGLOWEK_TRACKINGU.join(";"));
    expect(linie).toHaveLength(3);
    expect(linie[1]).toBe(`ZAM-${id};A01UF90224;011200284;8907375028320;GEIS;PL2309159791276001;delivery;2;2026-10-13T13:30:00+02:00`);
    expect(linie[2]).toMatch(/^ZAM-\d+;A01UF90224;0102 00001;;GEIS;PL2309159791276001;delivery;1;/); // pozycja bez dopasowania w katalogu: EAN pusty
    expect(odp.body.przesylki[0]).toMatchObject({ przewoznik: "GEIS", numerPrzesylki: "PL2309159791276001", typ: "delivery", plikStatus: "zapisany" });
  });

  it("po utworzeniu zamówienia w Selly order_id to numer z Selly", async () => {
    const { id, auth, url } = await przygotuj(new Map([["adtyres", katalog]]));
    s.db.update(partnerZamowienia).set({ numerWlasny: "10/2026", status: "wyslane" }).where(eq(partnerZamowienia.id, id)).run();
    await request(s.app).post(url).set(auth).send({ przewoznik: "GEIS", numerPrzesylki: "N1" });
    expect(readFileSync(join(katalog, readdirSync(katalog)[0]!), "utf8")).toMatch(/\n10\/2026;A01UF90224;011200284;/);
  });

  it("bez skonfigurowanego katalogu: przesyłka zapisana, status pliku „brak_katalogu”, plik do pobrania w panelu", async () => {
    const { auth, url } = await przygotuj();
    const odp = await request(s.app).post(url).set(auth).send({ przewoznik: "GEIS", numerPrzesylki: "N1" });
    expect(odp.body.plik).toBe("brak_katalogu");
    const w = odp.body.przesylki[0] as { id: number };
    const plik = await request(s.app).get(`${url}/${w.id}/plik`).set(auth);
    expect(plik.status).toBe(200);
    expect(plik.body.nazwa).toMatch(/^tracking_A01UF90224_/);
    expect(plik.body.tresc.split("\n")[0]).toBe(NAGLOWEK_TRACKINGU.join(";"));
    expect((await request(s.app).get(url).set(auth)).body.katalogSkonfigurowany).toBe(false);
  });

  it("błąd zapisu pliku nie cofa przesyłki: status „blad”, a „ponów” po utworzeniu katalogu zapisuje plik", async () => {
    const brakujacy = join(katalog, "nie-ma");
    const { auth, url } = await przygotuj(new Map([["adtyres", brakujacy]]));
    const odp = await request(s.app).post(url).set(auth).send({ przewoznik: "GEIS", numerPrzesylki: "N1" });
    expect(odp.status).toBe(200);
    expect(odp.body.plik).toBe("blad");
    expect(odp.body.przesylki[0].plikBlad).toMatch(/nie powiódł się/);
    mkdirSync(brakujacy);
    const ponow = await request(s.app).post(`${url}/${odp.body.przesylki[0].id}/ponow`).set(auth);
    expect(ponow.body.plik).toBe("zapisany");
    expect(existsSync(join(brakujacy, ponow.body.przesylki[0].plikNazwa))).toBe(true);
    expect(ponow.body.przesylki[0].plikBlad).toBeNull();
  });

  it("walidacja: przewoźnik i numer wymagane, typ delivery/pickup, duplikat numeru 409, ilości nie przekraczają zamówionych (łącznie), status zamówienia", async () => {
    const { id, auth, url, pozycje } = await przygotuj();
    const wyslij = (cialo: object) => request(s.app).post(url).set(auth).send(cialo);
    expect((await wyslij({ numerPrzesylki: "N1" })).status).toBe(400);
    expect((await wyslij({ przewoznik: "GEIS" })).status).toBe(400);
    expect((await wyslij({ przewoznik: "GEIS", numerPrzesylki: "N1", typ: "zwrot" })).status).toBe(400);
    expect((await wyslij({ przewoznik: "GEIS", numerPrzesylki: "N1", wyslano: "nie-data" })).status).toBe(400);
    const p1 = pozycje[0]!.id;
    expect((await wyslij({ przewoznik: "GEIS", numerPrzesylki: "N1", pozycje: [{ pozycjaId: p1, ilosc: 3 }] })).status).toBe(409); // zamówiono 2
    expect((await wyslij({ przewoznik: "GEIS", numerPrzesylki: "N1", pozycje: [{ pozycjaId: 999999, ilosc: 1 }] })).status).toBe(400);
    expect((await wyslij({ przewoznik: "GEIS", numerPrzesylki: "N1", typ: "pickup", pozycje: [{ pozycjaId: p1, ilosc: 1 }] })).status).toBe(200);
    expect((await wyslij({ przewoznik: "GEIS", numerPrzesylki: "N1", pozycje: [{ pozycjaId: p1, ilosc: 1 }] })).status).toBe(409); // duplikat numeru
    expect((await wyslij({ przewoznik: "GEIS", numerPrzesylki: "N2", pozycje: [{ pozycjaId: p1, ilosc: 2 }] })).status).toBe(409); // 1 już wysłana + 2 > 2
    const druga = await wyslij({ przewoznik: "DHL", numerPrzesylki: "N3" }); // domyślnie: reszta niewysłanego (1 szt. + druga pozycja)
    expect(druga.status).toBe(200);
    const ostatnia = s.db.select().from(partnerWysylki).all().at(-1)!;
    expect(JSON.parse(ostatnia.pozycje)).toEqual([{ pozycjaId: p1, ilosc: 1 }, { pozycjaId: pozycje[1]!.id, ilosc: 1 }]);
    expect((await wyslij({ przewoznik: "DHL", numerPrzesylki: "N4" })).status).toBe(400); // wszystko już wysłane
    s.db.update(partnerZamowienia).set({ status: "blad_importu" }).where(eq(partnerZamowienia.id, id)).run();
    expect((await wyslij({ przewoznik: "DHL", numerPrzesylki: "N5" })).status).toBe(409);
  });

  it("cudze/nieistniejące zamówienie i przesyłka: 404; bez zalogowania 401", async () => {
    const { partnerId, id, auth, url } = await przygotuj();
    const inny = Number(s.db.insert(partnerzy).values({ nazwa: "Inny", aktywny: true, utworzono: "x", zmieniono: "x" }).run().lastInsertRowid);
    expect((await request(s.app).get(url)).status).toBe(401);
    expect((await request(s.app).post(`/api/partnerzy/${inny}/zamowienia/${id}/przesylki`).set(auth).send({ przewoznik: "GEIS", numerPrzesylki: "N1" })).status).toBe(404);
    expect((await request(s.app).get(`/api/partnerzy/${partnerId}/zamowienia/999/przesylki`).set(auth)).status).toBe(404);
    expect((await request(s.app).get(`${url}/999/plik`).set(auth)).status).toBe(404);
    expect((await request(s.app).post(`${url}/999/ponow`).set(auth)).status).toBe(404);
  });
});
