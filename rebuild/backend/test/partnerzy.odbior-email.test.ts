/** Odbiór zamówień partnerów przez e-mail (ticket 229, PRT-7.3) — na atrapie skrzynki; testy NIGDY nie łączą się z prawdziwą pocztą. */
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { partnerErrorLog, partnerLogi, partnerzy } from "../src/db/schema.js";
import { odbierzDlaWszystkich, odbierzZamowieniaEmail, stworzHarmonogramOdbioru, type UstawieniaOdbioru } from "../src/partnerzy/odbior-email.js";
import type { KonfiguracjaSkrzynki, OtworzSkrzynke, WiadomoscPoczty, ZalacznikPoczty } from "../src/partnerzy/poczta.js";
import { listaZamowien } from "../src/repos/partnerzy-zamowienia.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";
import { XML_PRZYKLAD } from "./partnerzy.zamowienie-przyklad.js";

const xmlZ = (z: ZalacznikPoczty["nazwa"], tresc: string): ZalacznikPoczty => ({ nazwa: z, typ: "application/xml", tresc: Buffer.from(tresc, "utf-8") });

class AtrapaSkrzynki {
  polaczenia: KonfiguracjaSkrzynki[] = [];
  przetworzone: string[] = [];
  zamknieta = 0;
  awariaPolaczenia: Error | null = null;
  constructor(public wiadomosci: Omit<WiadomoscPoczty, "oznaczPrzetworzona">[]) {}
  otworz: OtworzSkrzynke = async (konfig) => {
    this.polaczenia.push(konfig);
    if (this.awariaPolaczenia) throw this.awariaPolaczenia;
    return {
      pobierzNieprzeczytane: async () =>
        this.wiadomosci
          .filter((w) => !this.przetworzone.includes(w.id))
          .map((w) => ({ ...w, oznaczPrzetworzona: async () => void this.przetworzone.push(w.id) })),
      zamknij: async () => void this.zamknieta++,
    };
  };
}
const wiad = (id: string, zalaczniki: ZalacznikPoczty[]) => ({ id, temat: `Zamówienie ${id}`, od: "partner@example.test", zalaczniki });
const USTAWIENIA: UstawieniaOdbioru = { host: "imap.example.test", port: 993, haslo: (id) => (id > 0 ? "tajne" : undefined) };

describe("odbiór zamówień przez e-mail", () => {
  let s: SrodowiskoTestowe;
  let partnerId: number;

  const dodaj = (nazwa: string, pola: Partial<typeof partnerzy.$inferInsert> = {}): number =>
    Number(
      s.db
        .insert(partnerzy)
        .values({ nazwa, aktywny: true, kanalEmail: true, emailSkrzynka: `${nazwa.toLowerCase()}@example.test`, utworzono: "2026-10-10", zmieniono: "2026-10-10", ...pola })
        .run().lastInsertRowid,
    );
  const bledy = (id = partnerId) => s.db.select().from(partnerErrorLog).where(eq(partnerErrorLog.partnerId, id)).all();
  const logi = (id = partnerId) => s.db.select().from(partnerLogi).where(eq(partnerLogi.partnerId, id)).all();

  beforeEach(async () => {
    s = await stworzSrodowiskoTestowe();
    partnerId = dodaj("TyreWorld");
  });
  afterEach(() => s.posprzataj());

  it("zapisuje zamówienie z załącznika XML, loguje jedną linię i oznacza wiadomość jako przetworzoną", async () => {
    const skrzynka = new AtrapaSkrzynki([wiad("1", [xmlZ("zamowienie.xml", XML_PRZYKLAD)])]);
    const w = await odbierzZamowieniaEmail(s.db, skrzynka.otworz, partnerId, USTAWIENIA);
    expect(w).toEqual({ polaczono: true, wiadomosci: 1, nowe: 1, duplikaty: 0, bledy: 0 });
    expect(listaZamowien(s.db, partnerId).map((z) => z.numerPartnera)).toEqual(["A01UF90224"]);
    expect(skrzynka.przetworzone).toEqual(["1"]);
    expect(skrzynka.zamknieta).toBe(1);
    expect(skrzynka.polaczenia[0]).toEqual({ host: "imap.example.test", port: 993, uzytkownik: "tyreworld@example.test", haslo: "tajne" });
    expect(logi()).toHaveLength(1);
    expect(logi()[0]).toMatchObject({ operacja: "odbior-zamowien-email", liczbaPozycji: 1 });
  });

  it("ten sam plik odebrany drugi raz nie tworzy duplikatu", async () => {
    const skrzynka = new AtrapaSkrzynki([wiad("1", [xmlZ("a.xml", XML_PRZYKLAD)]), wiad("2", [xmlZ("b.xml", XML_PRZYKLAD)])]);
    const w = await odbierzZamowieniaEmail(s.db, skrzynka.otworz, partnerId, USTAWIENIA);
    expect(w).toMatchObject({ wiadomosci: 2, nowe: 1, duplikaty: 1, bledy: 0 });
    expect(listaZamowien(s.db, partnerId)).toHaveLength(1);
    expect(bledy()).toHaveLength(0);
  });

  it("ostrzega, gdy ten sam numer przyszedł z inną treścią (zapisanego nie nadpisuje)", async () => {
    const inny = XML_PRZYKLAD.replace("<ORDERQUANTITY>2</ORDERQUANTITY>", "<ORDERQUANTITY>7</ORDERQUANTITY>");
    const skrzynka = new AtrapaSkrzynki([wiad("1", [xmlZ("a.xml", XML_PRZYKLAD)]), wiad("2", [xmlZ("b.xml", inny)])]);
    await odbierzZamowieniaEmail(s.db, skrzynka.otworz, partnerId, USTAWIENIA);
    expect(bledy().map((b) => b.poziom)).toEqual(["ostrzezenie"]);
    expect(bledy()[0]!.komunikat).toMatch(/inną treścią/);
  });

  it("błędny XML trafia do error_log, a wiadomość jest oznaczona (nie wraca w kółko)", async () => {
    const skrzynka = new AtrapaSkrzynki([wiad("1", [xmlZ("zly.xml", "<DOCUMENTORDER><NUMBER>1</NUMBER></DOCUMENTORDER>")])]);
    const w = await odbierzZamowieniaEmail(s.db, skrzynka.otworz, partnerId, USTAWIENIA);
    expect(w).toMatchObject({ nowe: 0, bledy: 1 });
    expect(bledy()[0]).toMatchObject({ poziom: "blad", operacja: "odbior-zamowien-email" });
    expect(bledy()[0]!.komunikat).toMatch(/zly\.xml.*Brak pozycji/);
    expect(skrzynka.przetworzone).toEqual(["1"]);
  });

  it("wiadomość bez załącznika XML: ostrzeżenie i oznaczenie; załączniki innego typu są ignorowane", async () => {
    const pdf: ZalacznikPoczty = { nazwa: "faktura.pdf", typ: "application/pdf", tresc: Buffer.from("%PDF") };
    const skrzynka = new AtrapaSkrzynki([wiad("1", [pdf]), wiad("2", [])]);
    const w = await odbierzZamowieniaEmail(s.db, skrzynka.otworz, partnerId, USTAWIENIA);
    expect(w).toMatchObject({ wiadomosci: 2, nowe: 0, bledy: 0 });
    expect(bledy().map((b) => b.poziom)).toEqual(["ostrzezenie", "ostrzezenie"]);
    expect(skrzynka.przetworzone).toEqual(["1", "2"]);
  });

  it("rozpoznaje XML po typie MIME, gdy nazwa nie ma rozszerzenia", async () => {
    const skrzynka = new AtrapaSkrzynki([wiad("1", [{ nazwa: "zamowienie", typ: "text/xml", tresc: Buffer.from(XML_PRZYKLAD) }])]);
    expect((await odbierzZamowieniaEmail(s.db, skrzynka.otworz, partnerId, USTAWIENIA)).nowe).toBe(1);
  });

  it("bez hosta lub hasła w konfiguracji kanał jest pomijany z wpisem w logu — bez łączenia się i bez wyjątku", async () => {
    const skrzynka = new AtrapaSkrzynki([wiad("1", [xmlZ("a.xml", XML_PRZYKLAD)])]);
    const bezHasla = await odbierzZamowieniaEmail(s.db, skrzynka.otworz, partnerId, { ...USTAWIENIA, haslo: () => undefined });
    const bezHosta = await odbierzZamowieniaEmail(s.db, skrzynka.otworz, partnerId, { ...USTAWIENIA, host: undefined });
    expect(bezHasla.polaczono).toBe(false);
    expect(bezHosta.polaczono).toBe(false);
    expect(skrzynka.polaczenia).toHaveLength(0);
    expect(bledy().map((b) => b.komunikat)).toEqual([expect.stringContaining(`PARTNERZY_IMAP_HASLO_${partnerId}`), expect.stringContaining("PARTNERZY_IMAP_HOST")]);
    expect(listaZamowien(s.db, partnerId)).toHaveLength(0);
  });

  it("awaria połączenia kończy się wpisem w error_log, nie wyjątkiem", async () => {
    const skrzynka = new AtrapaSkrzynki([]);
    skrzynka.awariaPolaczenia = new Error("ECONNREFUSED");
    const w = await odbierzZamowieniaEmail(s.db, skrzynka.otworz, partnerId, USTAWIENIA);
    expect(w.polaczono).toBe(false);
    expect(bledy()[0]!.komunikat).toMatch(/ECONNREFUSED/);
  });

  it("wyjątek infrastruktury (nie błąd pliku) zostawia wiadomość nieprzeczytaną i zamyka skrzynkę", async () => {
    const skrzynka = new AtrapaSkrzynki([wiad("1", [xmlZ("a.xml", XML_PRZYKLAD)])]);
    s.sqlite.exec("DROP TABLE partner_zamowienia_pozycje"); // zapis zamówienia padnie błędem SQL, nie BladZamowienia
    await odbierzZamowieniaEmail(s.db, skrzynka.otworz, partnerId, USTAWIENIA);
    expect(skrzynka.przetworzone).toEqual([]);
    expect(skrzynka.zamknieta).toBe(1);
    expect(bledy()[0]!.komunikat).toMatch(/Odbiór przerwany/);
  });

  it("ignoruje partnera bez kanału e-mail, bez adresu skrzynki oraz nieaktywnego (odbierzDlaWszystkich)", async () => {
    dodaj("BezKanalu", { kanalEmail: false });
    dodaj("BezAdresu", { emailSkrzynka: null });
    dodaj("Nieaktywny", { aktywny: false });
    const skrzynka = new AtrapaSkrzynki([]);
    const wyniki = await odbierzDlaWszystkich(s.db, skrzynka.otworz, USTAWIENIA);
    expect([...wyniki.keys()]).toEqual([partnerId]);
    expect(skrzynka.polaczenia).toHaveLength(1);
  });

  it("zamówienia różnych partnerów nie mieszają się", async () => {
    const drugi = dodaj("Adtyres");
    const skrzynka = new AtrapaSkrzynki([wiad("1", [xmlZ("a.xml", XML_PRZYKLAD)])]);
    await odbierzZamowieniaEmail(s.db, skrzynka.otworz, partnerId, USTAWIENIA);
    skrzynka.przetworzone = [];
    await odbierzZamowieniaEmail(s.db, skrzynka.otworz, drugi, USTAWIENIA);
    expect(listaZamowien(s.db, partnerId)).toHaveLength(1);
    expect(listaZamowien(s.db, drugi)).toHaveLength(1);
  });

  it("harmonogram: nakładający się przebieg jest pomijany, wyjątek nie wywraca procesu", async () => {
    let zwolnij!: () => void;
    const brama = new Promise<void>((r) => (zwolnij = r));
    const wolna: OtworzSkrzynke = async () => {
      await brama;
      return { pobierzNieprzeczytane: async () => [], zamknij: async () => undefined };
    };
    const h = stworzHarmonogramOdbioru({ db: s.db, otworz: wolna, ustawienia: USTAWIENIA, interwalMs: 60_000 });
    const pierwszy = h.tick();
    expect(await h.tick()).toBe(false);
    zwolnij();
    expect(await pierwszy).toBe(true);
    expect(await h.tick()).toBe(true);
  });
});
