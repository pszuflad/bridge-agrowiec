/** Tickety 248/249: podgląd zamówienia partnera przed Selly i jego ręczne utworzenie — dopasowanie, blokady, brak duplikatów. Zawsze atrapa Selly. */
import { eq } from "drizzle-orm";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { kursyNbp, partnerKraje, partnerZamowienia, partnerzy, products, sellyProducts } from "../src/db/schema.js";
import { podgladDlaSelly } from "../src/partnerzy/podglad-selly.js";
import { zapiszZamowienie } from "../src/repos/partnerzy-zamowienia.js";
import { BladSelly, type KlientSelly } from "../src/selly/klient.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";
import { stworzAtrapeSelly } from "./gate/selly-atrapa.js";
import { XML_PRZYKLAD } from "./partnerzy.zamowienie-przyklad.js";

type Nowy = typeof products.$inferInsert;
const produkt = (kod: string, n: Partial<Nowy> = {}): Nowy => ({
  kod, nazwa: "OPONA CEAT", marka: "CEAT", kategoria: "Rolnicze", dostawca: "MO1", magazyn: "MO1", stan: 10, cenaZakupu: 100, cenaSprzedazy: 150, marzaPct: 50,
  dataAktualizacji: "2026-10-10T00:00:00.000Z", kodImportu: `IMP_${kod}`, ...n,
});
const FAKTURA = { fakturaNazwa: "Adtyres SL", fakturaNip: "ATU1", fakturaUlica: "Calle 1", fakturaKod: "AD500", fakturaMiasto: "Andorra", fakturaKraj: "AD" };
const IDY_SELLY = { sellyStatusId: 3, kontaktEmail: "bill@partner.example", kontaktTelefon: "+376 111 222" };

describe("zamówienie partnera → Selly", () => {
  let s: SrodowiskoTestowe;
  const dodajPartnera = (nadpisania: Record<string, unknown> = {}): number =>
    Number(s.db.insert(partnerzy).values({ nazwa: "Adtyres", aktywny: true, utworzono: "x", zmieniono: "x", ...FAKTURA, ...IDY_SELLY, ...nadpisania }).run().lastInsertRowid);
  /** Katalog zgodny z XML_PRZYKLAD (011200284 i „0102 00001”), oba powiązane z Selly. */
  const katalogZSelly = () => {
    s.db.insert(products).values([produkt("011200284"), produkt("0102 00001")]).run();
    s.db.insert(sellyProducts).values([
      { kodImportu: "A", dostawca: "MO1", bridgeKod: "011200284", sellyProductId: 501, sellyVariantId: 601 },
      { kodImportu: "B", dostawca: "MO1", bridgeKod: "0102 00001", sellyProductId: 502, sellyVariantId: 602 },
    ]).run();
  };
  const kursEur = () => s.db.insert(kursyNbp).values({ data: "2026-10-12", kurs: 4.25, pobrano: "x" }).run();
  const przyjete = (partnerId: number): number => {
    const id = zapiszZamowienie(s.db, partnerId, XML_PRZYKLAD).id;
    s.db.update(partnerZamowienia).set({ status: "przyjete" }).where(eq(partnerZamowienia.id, id)).run();
    return id;
  };
  const zaloguj = async (): Promise<{ Authorization: string }> => {
    const odp = await request(s.app).post("/api/login").send({ email: s.dane.email, password: s.dane.haslo });
    return { Authorization: `Bearer ${(odp.body as { token: string }).token}` };
  };
  afterEach(() => s.posprzataj());

  describe("podgląd (248)", () => {
    beforeEach(async () => {
      s = await stworzSrodowiskoTestowe();
    });

    it("kompletne zamówienie: dopasowania z identyfikatorami Selly, ciało zamówienia, ostrzeżenie o braku adresu dostawy", () => {
      const partnerId = dodajPartnera();
      katalogZSelly();
      kursEur();
      const p = podgladDlaSelly(s.db, partnerId, przyjete(partnerId))!;
      expect(p.blokady).toEqual([]);
      expect(p.zamawiajacy).toMatchObject({ nazwa: "Adtyres SL", nip: "ATU1", kraj: "AD" });
      expect(p.dostawa.CUSTOMERNAME).toBe("Jan Kowalski");
      expect(p.pozycje[0]!.dopasowanie).toMatchObject({ kod: "011200284", dostawca: "MO1", sellyProductId: 501, sellyVariantId: 601 });
      expect(p.ostrzezenia).toEqual([expect.stringMatching(/pełnego adresu dostawy.*ulica, kod pocztowy, miasto/)]);
      expect(p.zadanie).toMatchObject({
        status_id: 3, payment_id: 10, delivery_id: 10, email: "bill@partner.example", phone: "+376 111 222", currency: "PLN", exchange_rate: 1,
        invoice_company: "Adtyres SL", invoice_nip: "ATU1", invoice_postcode: "AD500", ship_company: "Jan Kowalski", delivery_country_iso2: "AT",
      });
      expect((p.zadanie as { client_comment: string }).client_comment).toMatch(/Adtyres nr /);
      expect((p.zadanie as { products: unknown[] }).products).toEqual([
        { product_id: 501, variant_id: 601, quantity: 2, price_with_tax: 858.5, vat_rate_id: 101 },
        { product_id: 502, variant_id: 602, quantity: 1, price_with_tax: 422.88, vat_rate_id: 101 },
      ]);
    });

    it("blokady: brak identyfikatorów Selly, pozycje bez dopasowania/powiązania, brak kursu, zły status — i wtedy nie ma ciała zamówienia", () => {
      const partnerId = dodajPartnera({ sellyStatusId: null, kontaktEmail: null });
      s.db.insert(products).values([produkt("011200284")]).run(); // „0102 00001” bez dopasowania, 011200284 bez powiązania z Selly
      const id = zapiszZamowienie(s.db, partnerId, XML_PRZYKLAD).id; // status „nowe”
      const p = podgladDlaSelly(s.db, partnerId, id)!;
      const tekst = p.blokady.join(" | ");
      expect(tekst).toMatch(/statusu nowego zamówienia Selly/);
      expect(tekst).toMatch(/Brak adresu e-mail zamawiającego/);
      expect(tekst).toMatch(/bez dopasowania w katalogu: 1/);
      expect(tekst).toMatch(/nie ma jeszcze w Selly.*: 1/);
      expect(tekst).toMatch(/Brak zapisanego kursu EUR/);
      expect(tekst).toMatch(/status „nowe”/);
      expect(p.zadanie).toBeNull();
    });

    it("e-mail zamawiającego: z kontaktu partnera, a gdy go brak — z pliku zamówienia; płatność/dostawa/VAT to stałe, nadpisywalne kolumnami partnera", () => {
      const partnerId = dodajPartnera({ sellyPaymentId: 71, sellyDeliveryId: 201, sellyVatId: 5 });
      katalogZSelly();
      kursEur();
      const p = podgladDlaSelly(s.db, partnerId, przyjete(partnerId))!;
      expect(p.zadanie).toMatchObject({ payment_id: 71, delivery_id: 201 });
      expect((p.zadanie as { products: { vat_rate_id: number }[] }).products[0]!.vat_rate_id).toBe(5);
    });

    it("niejednoznaczne powiązanie z Selly i kraj dostawy niedwuliterowy blokują", () => {
      const partnerId = dodajPartnera();
      katalogZSelly();
      s.db.insert(sellyProducts).values({ kodImportu: "A2", dostawca: "MO2", bridgeKod: "011200284", sellyProductId: 777, sellyVariantId: 888 }).run(); // drugie, RÓŻNE powiązanie tego samego kodu
      kursEur();
      const id = przyjete(partnerId);
      s.db.update(partnerZamowienia).set({ dostawaJson: JSON.stringify({ CUSTOMERNAME: "Jan", COUNTRY: "Austria" }) }).where(eq(partnerZamowienia.id, id)).run();
      const p = podgladDlaSelly(s.db, partnerId, id)!;
      expect(p.blokady.join(" | ")).toMatch(/Niejednoznaczne powiązanie z Selly.*011200284/);
      expect(p.blokady.join(" | ")).toMatch(/dwuliterowego kodu kraju dostawy \(jest: „Austria”\)/);
      expect(p.zadanie).toBeNull();
    });

    it("kurs w podglądzie: wartość i data tabeli; stary kurs daje ostrzeżenie", () => {
      const partnerId = dodajPartnera();
      katalogZSelly();
      s.db.insert(kursyNbp).values({ data: "2020-01-02", kurs: 4.5, pobrano: "x" }).run();
      const p = podgladDlaSelly(s.db, partnerId, przyjete(partnerId))!;
      expect(p.kurs).toEqual({ kurs: 4.5, data: "2020-01-02" });
      expect(p.ostrzezenia.join(" ")).toMatch(/starszy niż 5 dni/);
    });

    it("dane do faktury wg kraju dostawy (ticket 252): kraj z własnymi danymi je wygrywa, inny kraj dostaje domyślne partnera, bez mieszania pól", () => {
      const partnerId = dodajPartnera();
      katalogZSelly();
      kursEur();
      // XML_PRZYKLAD dostarcza do AT. Dla AT: własne dane (bez NIP-u celowo — nie wolno dociągnąć NIP-u partnera).
      s.db.insert(partnerKraje).values({ partnerId, kraj: "AT", fakturaNazwa: "Adtyres Austria GmbH", fakturaUlica: "Ring 1", fakturaKod: "1010", fakturaMiasto: "Wien", fakturaKraj: "AT" }).run();
      const id = przyjete(partnerId);
      const at = podgladDlaSelly(s.db, partnerId, id)!;
      expect(at.zrodloFaktury).toBe("kraj");
      expect(at.krajFaktury).toBe("AT");
      expect(at.zamawiajacy).toMatchObject({ nazwa: "Adtyres Austria GmbH", nip: null, miasto: "Wien" });
      expect(at.blokady.join(" ")).toMatch(/Brak danych do faktury kraju AT: NIP/);
      // Kraj dostawy bez własnych danych → domyślne partnera.
      s.db.update(partnerKraje).set({ fakturaNazwa: null }).where(eq(partnerKraje.partnerId, partnerId)).run();
      const domyslne = podgladDlaSelly(s.db, partnerId, id)!;
      expect(domyslne.zrodloFaktury).toBe("partner");
      expect(domyslne.zamawiajacy).toMatchObject({ nazwa: "Adtyres SL", nip: "ATU1" });
      expect(domyslne.blokady).toEqual([]);
    });

    it("trasa PUT …/kraje/:kraj/faktura: zapis, wymóg nazwy, 404 dla nieistniejącego kraju, czyszczenie, 401", async () => {
      const partnerId = dodajPartnera();
      s.db.insert(partnerKraje).values({ partnerId, kraj: "DE" }).run();
      const url = `/api/partnerzy/${partnerId}/kraje/DE/faktura`;
      const auth = await zaloguj();
      expect((await request(s.app).put(url).send({})).status).toBe(401);
      expect((await request(s.app).put(`/api/partnerzy/${partnerId}/kraje/FR/faktura`).set(auth).send({ fakturaNazwa: "X" })).status).toBe(404);
      expect((await request(s.app).put(url).set(auth).send({ fakturaNip: "DE1" })).status).toBe(400); // pola bez nazwy firmy
      expect((await request(s.app).put(url).set(auth).send({ fakturaNazwa: "X", fakturaKraj: "GER" })).status).toBe(400);
      const ok = await request(s.app).put(url).set(auth).send({ fakturaNazwa: " Adtyres DE ", fakturaNip: "DE123", fakturaKraj: "de" });
      expect(ok.status).toBe(200);
      expect(ok.body.kraje.find((k: { kraj: string }) => k.kraj === "DE")).toMatchObject({ fakturaNazwa: "Adtyres DE", fakturaNip: "DE123", fakturaKraj: "DE", fakturaUlica: null });
      const czysc = await request(s.app).put(url).set(auth).send({});
      expect(czysc.status).toBe(200);
      expect(czysc.body.kraje.find((k: { kraj: string }) => k.kraj === "DE").fakturaNazwa).toBeNull();
    });

    it("zapis ustawień kraju (narzut itd.) NIE kasuje jego danych do faktury", async () => {
      const partnerId = dodajPartnera();
      const auth = await zaloguj();
      await request(s.app).put(`/api/partnerzy/${partnerId}/kraje/DE`).set(auth).send({ narzutProc: 5 });
      await request(s.app).put(`/api/partnerzy/${partnerId}/kraje/DE/faktura`).set(auth).send({ fakturaNazwa: "Adtyres DE" });
      const po = await request(s.app).put(`/api/partnerzy/${partnerId}/kraje/DE`).set(auth).send({ narzutProc: 7 });
      expect(po.body.kraje[0]).toMatchObject({ narzutProc: 7, fakturaNazwa: "Adtyres DE" });
    });

    it("brak danych do faktury partnera blokuje i wymienia brakujące pola", () => {
      const partnerId = dodajPartnera({ fakturaNip: null, fakturaUlica: null, fakturaKod: null, fakturaMiasto: null, fakturaKraj: null });
      const id = zapiszZamowienie(s.db, partnerId, XML_PRZYKLAD).id;
      expect(podgladDlaSelly(s.db, partnerId, id)!.blokady[0]).toMatch(/NIP, ulica, kod pocztowy, miasto, kraj/);
    });

    it("trasa podglądu: 404 dla cudzego/nieistniejącego zamówienia, 200 dla własnego; bez zalogowania 401", async () => {
      const partnerId = dodajPartnera();
      const inny = dodajPartnera({ nazwa: "Inny" });
      const id = zapiszZamowienie(s.db, partnerId, XML_PRZYKLAD).id;
      const auth = await zaloguj();
      expect((await request(s.app).get(`/api/partnerzy/${partnerId}/zamowienia/${id}/podglad-selly`)).status).toBe(401);
      expect((await request(s.app).get(`/api/partnerzy/${inny}/zamowienia/${id}/podglad-selly`).set(auth)).status).toBe(404);
      expect((await request(s.app).get(`/api/partnerzy/${partnerId}/zamowienia/999/podglad-selly`).set(auth)).status).toBe(404);
      const ok = await request(s.app).get(`/api/partnerzy/${partnerId}/zamowienia/${id}/podglad-selly`).set(auth);
      expect(ok.status).toBe(200);
      expect(ok.body.pozycje).toHaveLength(2);
      expect(ok.body.tworzenieWlaczone).toBe(false);
    });
  });

  describe("utworzenie w Selly (249)", () => {
    const url = (partnerId: number, id: number) => `/api/partnerzy/${partnerId}/zamowienia/${id}/utworz-w-selly`;
    const stan = (id: number) => s.db.select({ status: partnerZamowienia.status, numer: partnerZamowienia.numerWlasny }).from(partnerZamowienia).where(eq(partnerZamowienia.id, id)).get();

    it("flaga wyłączona: 403 i zero wywołań Selly", async () => {
      const atrapa = stworzAtrapeSelly();
      s = await stworzSrodowiskoTestowe(undefined, { klientSelly: atrapa.klient });
      const partnerId = dodajPartnera();
      katalogZSelly();
      kursEur();
      const id = przyjete(partnerId);
      const odp = await request(s.app).post(url(partnerId, id)).set(await zaloguj());
      expect(odp.status).toBe(403);
      expect(atrapa.wywolania.filter((w) => w.metoda === "createOrder")).toHaveLength(0);
      expect(stan(id)).toEqual({ status: "przyjete", numer: null });
    });

    it("flaga włączona: wysyła dokładnie ciało z podglądu RAZ, zapisuje numer i status; drugie kliknięcie to 409 bez drugiego zamówienia", async () => {
      const atrapa = stworzAtrapeSelly();
      s = await stworzSrodowiskoTestowe(undefined, { klientSelly: atrapa.klient, sellyZamowienia: true });
      const partnerId = dodajPartnera();
      katalogZSelly();
      kursEur();
      const id = przyjete(partnerId);
      const auth = await zaloguj();
      const podglad = (await request(s.app).get(`/api/partnerzy/${partnerId}/zamowienia/${id}/podglad-selly`).set(auth)).body;
      const odp = await request(s.app).post(url(partnerId, id)).set(auth);
      expect(odp.status).toBe(200);
      expect(odp.body).toEqual({ numerWlasny: "10/2026", idSelly: 100 });
      const wyslane = atrapa.wywolania.filter((w) => w.metoda === "createOrder");
      expect(wyslane).toHaveLength(1);
      expect(wyslane[0]!.argumenty[0]).toEqual(podglad.zadanie);
      expect(stan(id)).toEqual({ status: "wyslane", numer: "10/2026" });
      const drugi = await request(s.app).post(url(partnerId, id)).set(auth);
      expect(drugi.status).toBe(409);
      expect(atrapa.wywolania.filter((w) => w.metoda === "createOrder")).toHaveLength(1);
    });

    it("jednoznaczna odmowa Selly (4xx): 502 z komunikatem, zamówienie wraca do „przyjete” (można ponowić)", async () => {
      const atrapa = stworzAtrapeSelly();
      const klient: KlientSelly = { ...atrapa.klient, createOrder: () => Promise.reject(new BladSelly("[Selly] 422 niepoprawne pole", 422, null)) };
      s = await stworzSrodowiskoTestowe(undefined, { klientSelly: klient, sellyZamowienia: true });
      const partnerId = dodajPartnera();
      katalogZSelly();
      kursEur();
      const id = przyjete(partnerId);
      const odp = await request(s.app).post(url(partnerId, id)).set(await zaloguj());
      expect(odp.status).toBe(502);
      expect(odp.body.error).toMatch(/Selly odrzuciło.*niepoprawne pole/);
      expect(stan(id)).toEqual({ status: "przyjete", numer: null });
    });

    it("odmowa Selly wysyła e-mail do osoby od zamówień (ticket 263); blokada 409 nie wysyła; błąd SMTP nie psuje odpowiedzi", async () => {
      const atrapa = stworzAtrapeSelly();
      const klient: KlientSelly = { ...atrapa.klient, createOrder: () => Promise.reject(new BladSelly("[Selly] 422 niepoprawne pole", 422, null)) };
      const wyslane: { do: string[]; temat: string; tekst: string }[] = [];
      let psuj = false;
      const nadawca = { wyslij: async (w: { do: string[]; temat: string; tekst: string }) => { if (psuj) throw new Error("SMTP padł"); wyslane.push(w); } };
      s = await stworzSrodowiskoTestowe(undefined, { klientSelly: klient, sellyZamowienia: true, powiadomienia: { nadawca, odbiorcy: ["marta@firma.example"] } });
      const partnerId = dodajPartnera();
      katalogZSelly();
      kursEur();
      const id = przyjete(partnerId);
      const auth = await zaloguj();
      expect((await request(s.app).post(url(partnerId, id)).set(auth)).status).toBe(502);
      await vi.waitFor(() => expect(wyslane).toHaveLength(1));
      expect(wyslane[0]!.do).toEqual(["marta@firma.example"]);
      expect(wyslane[0]!.temat).toMatch(/błąd przy tworzeniu w Selly/);
      expect(wyslane[0]!.tekst).toMatch(/Selly odrzuciło.*niepoprawne pole/);
      psuj = true;
      expect((await request(s.app).post(url(partnerId, id)).set(auth)).status).toBe(502); // SMTP padł, użytkownik dalej dostaje swój błąd
      expect(wyslane).toHaveLength(1);
    });

    it("błąd niejednoznaczny (timeout / 5xx): zamówienie ZOSTAJE zablokowane w „wysylanie”, drugie kliknięcie nie tworzy duplikatu; „Zwolnij” odblokowuje", async () => {
      const atrapa = stworzAtrapeSelly();
      let proby = 0;
      const klient: KlientSelly = { ...atrapa.klient, createOrder: () => (proby++, Promise.reject(new BladSelly("[Selly] 504 timeout", 504, null))) };
      s = await stworzSrodowiskoTestowe(undefined, { klientSelly: klient, sellyZamowienia: true });
      const partnerId = dodajPartnera();
      katalogZSelly();
      kursEur();
      const id = przyjete(partnerId);
      const auth = await zaloguj();
      const pierwszy = await request(s.app).post(url(partnerId, id)).set(auth);
      expect(pierwszy.status).toBe(502);
      expect(pierwszy.body.error).toMatch(/Nie wiadomo, czy Selly utworzyło/);
      expect(stan(id)).toEqual({ status: "wysylanie", numer: null });
      expect((await request(s.app).post(url(partnerId, id)).set(auth)).status).toBe(409);
      expect(proby).toBe(1);
      expect((await request(s.app).post(`/api/partnerzy/${partnerId}/zamowienia/${id}/zwolnij-wysylanie`).set(auth)).status).toBe(200);
      expect(stan(id)).toEqual({ status: "przyjete", numer: null });
      expect((await request(s.app).post(`/api/partnerzy/${partnerId}/zamowienia/${id}/zwolnij-wysylanie`).set(auth)).status).toBe(409); // już zwolnione
    });

    it("blokady podglądu zatrzymują utworzenie (409) i nie wołają Selly", async () => {
      const atrapa = stworzAtrapeSelly();
      s = await stworzSrodowiskoTestowe(undefined, { klientSelly: atrapa.klient, sellyZamowienia: true });
      const partnerId = dodajPartnera({ sellyStatusId: null });
      katalogZSelly();
      kursEur();
      const id = przyjete(partnerId);
      const odp = await request(s.app).post(url(partnerId, id)).set(await zaloguj());
      expect(odp.status).toBe(409);
      expect(odp.body.error).toMatch(/statusu nowego zamówienia Selly/);
      expect(atrapa.wywolania.filter((w) => w.metoda === "createOrder")).toHaveLength(0);
    });

    it("bez zalogowania 401", async () => {
      s = await stworzSrodowiskoTestowe();
      expect((await request(s.app).post(url(1, 1))).status).toBe(401);
    });
  });
});
