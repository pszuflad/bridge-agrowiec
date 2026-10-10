/** Odbiór zamówień partnerów przez e-mail (ticket 229, PRT-7.3) — na atrapie skrzynki; testy NIGDY nie łączą się z prawdziwą pocztą. */
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { partnerErrorLog, partnerLogi, partnerzy, products } from "../src/db/schema.js";
import { LIMIT_ZAMKA_MS, OdbiorTrwaError, _zresetujZamkiOdbioru, odbierzDlaWszystkich, odbierzZamowieniaEmail, stworzHarmonogramOdbioru, type UstawieniaOdbioru } from "../src/partnerzy/odbior-email.js";
import type { KonfiguracjaSkrzynki, OtworzSkrzynke, WiadomoscPoczty, ZalacznikPoczty } from "../src/partnerzy/poczta.js";
import { listaZamowien } from "../src/repos/partnerzy-zamowienia.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";
import { XML_PRZYKLAD } from "./partnerzy.zamowienie-przyklad.js";

const xmlZ = (z: string, tresc: string): ZalacznikPoczty => ({ nazwa: z, typ: "application/xml", tresc: Buffer.from(tresc, "utf-8") });

type DefWiadomosci = { id: string; temat: string; od: string; zalaczniki: ZalacznikPoczty[]; wczytajRzuca?: Error; oznaczRzuca?: Error };

class AtrapaSkrzynki {
  polaczenia: KonfiguracjaSkrzynki[] = [];
  przetworzone: string[] = [];
  zamknieta = 0;
  awariaPolaczenia: Error | null = null;
  awariaListy: Error | null = null;
  constructor(public wiadomosci: DefWiadomosci[]) {}
  otworz: OtworzSkrzynke = async (konfig) => {
    this.polaczenia.push(konfig);
    if (this.awariaPolaczenia) throw this.awariaPolaczenia;
    return {
      pobierzNieprzeczytane: async () => {
        if (this.awariaListy) throw this.awariaListy;
        return this.wiadomosci
          .filter((w) => !this.przetworzone.includes(w.id))
          .map(
            (w): WiadomoscPoczty => ({
              id: w.id,
              wczytaj: async () => {
                if (w.wczytajRzuca) throw w.wczytajRzuca;
                return { temat: w.temat, od: w.od, zalaczniki: w.zalaczniki };
              },
              oznaczPrzetworzona: async () => {
                if (w.oznaczRzuca) throw w.oznaczRzuca;
                this.przetworzone.push(w.id);
              },
            }),
          );
      },
      zamknij: async () => void this.zamknieta++,
    };
  };
}
const wiad = (id: string, zalaczniki: ZalacznikPoczty[], reszta: Partial<DefWiadomosci> = {}): DefWiadomosci => ({ id, temat: `Zamówienie ${id}`, od: "partner@example.test", zalaczniki, ...reszta });
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
    _zresetujZamkiOdbioru();
    s = await stworzSrodowiskoTestowe();
    partnerId = dodaj("TyreWorld");
    // Katalog z pozycjami z przykładowego zamówienia — inaczej walidacja (ticket 232) dopisywałaby ostrzeżenia „błąd importu” do każdego testu.
    // Jej własne przypadki: partnerzy.walidacja-zamowien.test.ts.
    for (const kod of ["011200284", "0102 00001"]) {
      s.db.insert(products).values({
        kod, nazwa: "OPONA", marka: "CEAT", kategoria: "Rolnicze", dostawca: "MO1", magazyn: "MO1", stan: 100, cenaZakupu: 100, cenaSprzedazy: 150, marzaPct: 50,
        dataAktualizacji: "2026-10-10T00:00:00.000Z", kodImportu: `IMP_${kod}`,
      }).run();
    }
  });
  afterEach(() => s.posprzataj());

  it("zapisuje zamówienie z załącznika XML, loguje jedną linię i oznacza wiadomość jako przetworzoną", async () => {
    const skrzynka = new AtrapaSkrzynki([wiad("1", [xmlZ("zamowienie.xml", XML_PRZYKLAD)])]);
    const w = await odbierzZamowieniaEmail(s.db, skrzynka.otworz, partnerId, USTAWIENIA);
    expect(w).toEqual({ polaczono: true, powod: null, wiadomosci: 1, nowe: 1, duplikaty: 0, bledy: 0 });
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
    expect(bledy()[0]!.komunikat).toMatch(/wiadomość 1.*zostanie ponowiona/);
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

  it("jedna uszkodzona wiadomość nie blokuje pozostałych; jest oznaczona i opisana w error_log", async () => {
    const skrzynka = new AtrapaSkrzynki([
      wiad("1", [], { wczytajRzuca: new Error("uszkodzone MIME") }),
      wiad("2", [xmlZ("a.xml", XML_PRZYKLAD)]),
    ]);
    const w = await odbierzZamowieniaEmail(s.db, skrzynka.otworz, partnerId, USTAWIENIA);
    expect(w).toMatchObject({ wiadomosci: 2, nowe: 1, bledy: 1 });
    expect(skrzynka.przetworzone).toEqual(["1", "2"]);
    expect(bledy()[0]!.komunikat).toMatch(/wiadomość 1: uszkodzone MIME/);
  });

  it("awaria oznaczenia jednej wiadomości nie przerywa pętli (zostanie odebrana ponownie)", async () => {
    const skrzynka = new AtrapaSkrzynki([
      wiad("1", [xmlZ("a.xml", XML_PRZYKLAD)], { oznaczRzuca: new Error("sesja zerwana") }),
      wiad("2", [xmlZ("b.xml", XML_PRZYKLAD.replaceAll("A01UF90224", "B02"))]),
    ]);
    const w = await odbierzZamowieniaEmail(s.db, skrzynka.otworz, partnerId, USTAWIENIA);
    expect(w.nowe).toBe(2);
    expect(skrzynka.przetworzone).toEqual(["2"]);
    expect(bledy()[0]!.komunikat).toMatch(/nie udało się oznaczyć.*sesja zerwana/);
  });

  it("dwa XML w jednej wiadomości są oba zapisane", async () => {
    const drugi = XML_PRZYKLAD.replaceAll("A01UF90224", "A02");
    const skrzynka = new AtrapaSkrzynki([wiad("1", [xmlZ("a.xml", XML_PRZYKLAD), xmlZ("b.xml", drugi)])]);
    expect((await odbierzZamowieniaEmail(s.db, skrzynka.otworz, partnerId, USTAWIENIA)).nowe).toBe(2);
    expect(listaZamowien(s.db, partnerId)).toHaveLength(2);
  });

  it("awaria pobrania listy kończy się wpisem w error_log i zamknięciem skrzynki", async () => {
    const skrzynka = new AtrapaSkrzynki([]);
    skrzynka.awariaListy = new Error("SEARCH failed");
    const w = await odbierzZamowieniaEmail(s.db, skrzynka.otworz, partnerId, USTAWIENIA);
    expect(w).toMatchObject({ polaczono: true, bledy: 1, powod: expect.stringMatching(/Odbiór przerwany: SEARCH failed/) });
    expect(bledy()[0]!.komunikat).toMatch(/Odbiór przerwany: SEARCH failed/);
    expect(skrzynka.zamknieta).toBe(1);
  });

  it("hasło skrzynki nigdy nie trafia do logów, nawet gdy biblioteka wklei je do komunikatu", async () => {
    const skrzynka = new AtrapaSkrzynki([]);
    skrzynka.awariaPolaczenia = new Error("AUTH failed for pass=tajne");
    await odbierzZamowieniaEmail(s.db, skrzynka.otworz, partnerId, USTAWIENIA);
    expect(bledy()[0]!.komunikat).toMatch(/pass=\*\*\*/);
    expect(JSON.stringify(bledy())).not.toContain("tajne");
  });

  it("brak konfiguracji jest zgłaszany raz na dobę, nie przy każdym przebiegu", async () => {
    const skrzynka = new AtrapaSkrzynki([]);
    const bez = { ...USTAWIENIA, host: undefined };
    const t0 = new Date("2026-10-10T10:00:00Z");
    for (let i = 0; i < 5; i++) await odbierzZamowieniaEmail(s.db, skrzynka.otworz, partnerId, bez, new Date(t0.getTime() + i * 300_000));
    expect(bledy()).toHaveLength(1);
    await odbierzZamowieniaEmail(s.db, skrzynka.otworz, partnerId, bez, new Date(t0.getTime() + 25 * 3_600_000));
    expect(bledy()).toHaveLength(2);
  });

  it("odbierzDlaWszystkich: wyjątek jednego partnera nie zatrzymuje pozostałych, a stare logi są czyszczone", async () => {
    const drugi = dodaj("Adtyres");
    const skrzynka = new AtrapaSkrzynki([wiad("1", [xmlZ("a.xml", XML_PRZYKLAD)])]);
    let wywolania = 0;
    const ustawienia: UstawieniaOdbioru = { ...USTAWIENIA, haslo: (id) => { if (id === partnerId && wywolania++ === 0) throw new Error("env nie do odczytu"); return "tajne"; } };
    s.db.insert(partnerErrorLog).values({ partnerId, kiedy: "2020-01-01T00:00:00.000Z", operacja: "x", poziom: "blad", komunikat: "stary" }).run();
    const wyniki = await odbierzDlaWszystkich(s.db, skrzynka.otworz, ustawienia);
    expect([...wyniki.keys()]).toEqual([drugi]);
    expect(bledy().some((b) => b.komunikat === "stary")).toBe(false);
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

  it("harmonogram: zawieszony przebieg zwalnia zamek po limicie czasu", async () => {
    const zawieszona: OtworzSkrzynke = () => new Promise(() => undefined);
    const h = stworzHarmonogramOdbioru({ db: s.db, otworz: zawieszona, ustawienia: USTAWIENIA, interwalMs: 60_000, limitPrzebieguMs: 50 });
    expect(await h.tick()).toBe(true); // wraca po limicie, mimo że skrzynka nigdy nie odpowiada
    expect(await h.tick()).toBe(true); // zamek zwolniony — kolejny przebieg rusza
  });

  it("zamek: równoległy odbiór tego samego partnera rzuca OdbiorTrwaError, a po zakończeniu znów można odbierać; powód przy braku konfiguracji", async () => {
    let zwolnij!: () => void;
    const brama = new Promise<void>((r) => (zwolnij = r));
    const wolna: OtworzSkrzynke = async () => {
      await brama;
      return { pobierzNieprzeczytane: async () => [], zamknij: async () => undefined };
    };
    const pierwszy = odbierzZamowieniaEmail(s.db, wolna, partnerId, USTAWIENIA);
    await expect(odbierzZamowieniaEmail(s.db, wolna, partnerId, USTAWIENIA)).rejects.toBeInstanceOf(OdbiorTrwaError);
    // harmonogram pomija partnera, któremu odbiór właśnie trwa, bez błędu
    expect((await odbierzDlaWszystkich(s.db, wolna, USTAWIENIA)).size).toBe(0);
    zwolnij();
    expect((await pierwszy).polaczono).toBe(true);
    const bez = await odbierzZamowieniaEmail(s.db, wolna, partnerId, { ...USTAWIENIA, haslo: () => undefined });
    expect(bez).toMatchObject({ polaczono: false, powod: expect.stringContaining(`PARTNERZY_IMAP_HASLO_${partnerId}`) });
  });

  it("zawieszony odbiór nie blokuje partnera na zawsze: zamek wygasa po LIMIT_ZAMKA_MS", async () => {
    const zawieszona: OtworzSkrzynke = () => new Promise(() => undefined);
    void odbierzZamowieniaEmail(s.db, zawieszona, partnerId, USTAWIENIA); // nigdy się nie kończy
    await expect(odbierzZamowieniaEmail(s.db, zawieszona, partnerId, USTAWIENIA)).rejects.toBeInstanceOf(OdbiorTrwaError);
    const teraz = Date.now();
    const zegar = vi.spyOn(Date, "now").mockReturnValue(teraz + LIMIT_ZAMKA_MS + 1);
    try {
      const skrzynka = new AtrapaSkrzynki([]);
      expect((await odbierzZamowieniaEmail(s.db, skrzynka.otworz, partnerId, USTAWIENIA)).polaczono).toBe(true);
    } finally {
      zegar.mockRestore();
    }
  });
});
