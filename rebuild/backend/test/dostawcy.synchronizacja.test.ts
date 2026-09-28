/**
 * `POST /api/dostawcy/{kod}/synchronizuj-teraz` i port `L4()` — blok 3f-2.
 *
 * ⚠ NIC TU NIE JEST MOCKOWANE. Każdy scenariusz stawia PRAWDZIWY serwer HTTP na porcie
 * efemerycznym (`listen(0)`) i wpisuje jego adres do kolumny `suppliers.url`. To jest
 * wymóg gate'u tej sesji i ma powód: podmiana `fetch` atrapą wycięłaby dokładnie tę
 * warstwę, o którą chodzi — transport, timeout, `AbortController` i treść komunikatu
 * błędu, która trafia wprost do alertu.
 *
 * Awarię „serwer nie odpowiada” symuluje serwer ZRYWAJĄCY połączenie (`socket.destroy()`),
 * a nie zamknięty port: zachowanie jest deterministyczne i nie zależy od tego, czy
 * system zdążył zwolnić port po innym teście.
 *
 * Port: deminified/backend-index.cjs:48038-48116 (`L4`) i :48238-48242 (trasa).
 */
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { alerts, auditLog, stagingItems, suppliers } from "../src/db/schema.js";
import { synchronizujDostawce } from "../src/import/synchronizuj.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";

const CENNIK_MO1 = readFileSync(join(import.meta.dirname, "charakteryzacja", "probki", "MO1.csv"));

type Serwer = { url: (sciezka?: string) => string; zamknij: () => Promise<void> };

/** Serwer na porcie efemerycznym — `listen(0)`, żeby nie kolidować z niczym na maszynie. */
async function postawSerwer(
  obsluga: Parameters<typeof createServer>[1],
  naPolaczeniu?: (s: Server) => void,
): Promise<Serwer> {
  const serwer = createServer(obsluga);
  naPolaczeniu?.(serwer);
  await new Promise<void>((gotowe) => serwer.listen(0, "127.0.0.1", gotowe));
  const port = (serwer.address() as AddressInfo).port;
  return {
    url: (sciezka = "/cennik.csv") => `http://127.0.0.1:${port}${sciezka}`,
    zamknij: () =>
      new Promise<void>((gotowe) => {
        serwer.closeAllConnections?.();
        serwer.close(() => gotowe());
      }),
  };
}

describe("synchronizacja dostawcy spod URL (3f-2)", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;
  const doPosprzatania: Serwer[] = [];

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });

  afterAll(async () => {
    await Promise.all(doPosprzatania.map((s) => s.zamknij()));
    srodowisko.posprzataj();
  });

  beforeEach(() => {
    srodowisko.db.delete(stagingItems).run();
    srodowisko.db.delete(auditLog).run();
    srodowisko.db.delete(alerts).run();
    srodowisko.db.delete(suppliers).run();
  });

  const zapamietaj = async (serwer: Promise<Serwer>) => {
    const s = await serwer;
    doPosprzatania.push(s);
    return s;
  };

  const zasiej = (nadpisania: Record<string, unknown> = {}) => {
    srodowisko.db
      .insert(suppliers)
      .values({
        kod: "MO1",
        nazwa: "Bohnenkamp",
        formatPliku: "csv",
        sposobDostarczania: "url",
        czestotliwoscMinuty: 60,
        ...nadpisania,
      })
      .run();
  };

  const synchronizujTeraz = (kod = "MO1") =>
    request(srodowisko.app)
      .post(`/api/dostawcy/${kod}/synchronizuj-teraz`)
      .set("Authorization", `Bearer ${token}`)
      .send({});

  const alerty = () => srodowisko.sqlite.prepare("SELECT * FROM alerts").all() as Record<string, unknown>[];
  const dostawca = () =>
    srodowisko.sqlite.prepare("SELECT * FROM suppliers WHERE kod = 'MO1'").get() as Record<
      string,
      unknown
    >;
  const audyt = () =>
    srodowisko.sqlite.prepare("SELECT * FROM audit_log").all() as Record<string, unknown>[];

  describe("GATE — sukces", () => {
    it("pobiera cennik, zapisuje staging, alert „Synchronizacja” i oba znaczniki czasu", async () => {
      const serwer = await zapamietaj(
        postawSerwer((_zad, odp) => {
          odp.writeHead(200, { "content-type": "text/csv" });
          odp.end(CENNIK_MO1);
        }),
      );
      zasiej({ url: serwer.url() });

      const odp = await synchronizujTeraz();

      expect(odp.status).toBe(200);
      const cialo = odp.body as Record<string, unknown>;
      expect(cialo.ok).toBe(true);
      expect(Number(cialo.liczbaProduktow)).toBeGreaterThan(0);

      // 1. pozycje fizycznie w stagingu
      const wStagingu = (
        srodowisko.sqlite.prepare("SELECT count(*) AS c FROM staging_items").get() as { c: number }
      ).c;
      expect(wStagingu).toBe(Number(cialo.doStagingu));
      expect(wStagingu).toBeGreaterThan(0);

      // 2. alert informacyjny, rozwiązany od razu
      const lista = alerty();
      expect(lista).toHaveLength(1);
      expect(lista[0]!.typ).toBe("Synchronizacja");
      expect(lista[0]!.poziom).toBe("info");
      expect(lista[0]!.status).toBe("rozwiazany");
      expect(String(lista[0]!.opis)).toContain("MO1 (Bohnenkamp): pobrano");

      // 3. GATE: ostatniaSync, ostatniPlik, liczbaProduktow, status aktywny
      const wiersz = dostawca();
      expect(wiersz.ostatnia_sync).toBeTruthy();
      expect(wiersz.ostatni_plik).toBeTruthy();
      expect(wiersz.ostatnia_sync).toBe(wiersz.ostatni_plik);
      expect(Number(wiersz.liczba_produktow)).toBe(Number(cialo.liczbaProduktow));
      expect(wiersz.status).toBe("aktywny");
    });

    it("zapisuje audyt `synchronizacja_reczna`", async () => {
      const serwer = await zapamietaj(
        postawSerwer((_zad, odp) => {
          odp.writeHead(200);
          odp.end(CENNIK_MO1);
        }),
      );
      zasiej({ url: serwer.url() });

      await synchronizujTeraz();

      const wpisy = audyt();
      expect(wpisy).toHaveLength(1);
      expect(wpisy[0]!.akcja).toBe("synchronizacja_reczna");
      expect(wpisy[0]!.encja_typ).toBe("dostawca");
      expect(wpisy[0]!.encja_id).toBe("MO1");
    });
  });

  describe("GATE — awaria", () => {
    it("serwer zwraca 500 → alert „Błąd HTTP” i status `blad` na dostawcy", async () => {
      const serwer = await zapamietaj(
        postawSerwer((_zad, odp) => {
          odp.writeHead(500);
          odp.end("boom");
        }),
      );
      zasiej({ url: serwer.url(), status: "aktywny" });

      const odp = await synchronizujTeraz();

      expect(odp.status).toBe(200); // status siedzi w ciele, nie w kodzie HTTP — jak w oryginale
      expect(odp.body).toMatchObject({ ok: false, error: "HTTP 500" });

      const lista = alerty();
      expect(lista).toHaveLength(1);
      expect(lista[0]!.typ).toBe("Błąd HTTP");
      expect(lista[0]!.poziom).toBe("ostrzezenie");
      expect(lista[0]!.status).toBe("nowy");
      expect(lista[0]!.dostawca).toBe("MO1");
      expect(String(lista[0]!.opis)).toBe("MO1 (Bohnenkamp): HTTP 500");

      const wiersz = dostawca();
      expect(wiersz.status).toBe("blad");
      // `ostatniaSync` = „kiedy PRÓBOWALIŚMY”; `ostatniPlik` zostaje nietknięty.
      expect(wiersz.ostatnia_sync).toBeTruthy();
      expect(wiersz.ostatni_plik).toBeNull();
    });

    it("serwer nie odpowiada (zrywa połączenie) → alert „Błąd pobierania” i status `blad`", async () => {
      const serwer = await zapamietaj(
        postawSerwer(
          () => {
            /* nigdy nie dochodzi — połączenie ginie wcześniej */
          },
          (s) => s.on("connection", (gniazdo) => gniazdo.destroy()),
        ),
      );
      zasiej({ url: serwer.url(), status: "aktywny" });

      const odp = await synchronizujTeraz();

      expect(odp.body).toMatchObject({ ok: false });
      expect(String((odp.body as { error: string }).error)).toBeTruthy();

      const lista = alerty();
      expect(lista).toHaveLength(1);
      expect(lista[0]!.typ).toBe("Błąd pobierania");
      expect(lista[0]!.poziom).toBe("ostrzezenie");
      expect(lista[0]!.status).toBe("nowy");
      // Treść to dosłowny komunikat undici — tak samo wyglądają alerty w produkcji.
      expect(String(lista[0]!.opis)).toMatch(/^MO1 \(Bohnenkamp\): .+/);

      expect(dostawca().status).toBe("blad");
    });

    it("KAŻDA nieudana próba zostawia OSOBNY alert — bez dławika (decyzja 2026-09-01)", async () => {
      const serwer = await zapamietaj(
        postawSerwer((_zad, odp) => {
          odp.writeHead(503);
          odp.end();
        }),
      );
      zasiej({ url: serwer.url() });

      await synchronizujTeraz();
      await synchronizujTeraz();
      await synchronizujTeraz();

      // Zwijanie powtórek należy do WIDOKU alertów (Iteracja 6), nie do zapisu.
      expect(alerty()).toHaveLength(3);
    });
  });

  describe("GATE — blokada `wstrzymany`", () => {
    it("ręcznie PRZECHODZI mimo statusu `wstrzymany`", async () => {
      const serwer = await zapamietaj(
        postawSerwer((_zad, odp) => {
          odp.writeHead(200);
          odp.end(CENNIK_MO1);
        }),
      );
      zasiej({ url: serwer.url(), status: "wstrzymany" });

      const odp = await synchronizujTeraz();

      expect(odp.body).toMatchObject({ ok: true });
      expect(dostawca().status).toBe("aktywny");
    });

    it("automatem NIE przechodzi — bez flagi „ręcznie” wraca `Wstrzymany`", async () => {
      const serwer = await zapamietaj(
        postawSerwer((_zad, odp) => {
          odp.writeHead(200);
          odp.end(CENNIK_MO1);
        }),
      );
      zasiej({ url: serwer.url(), status: "wstrzymany" });

      // Ścieżka schedulera z 3f-3: `L4(kod)` BEZ opcji.
      const synchronizuj = synchronizujDostawce({
        db: srodowisko.db,
        katalogArchiwum: srodowisko.katalogArchiwum,
      });
      const wynik = await synchronizuj("MO1");

      expect(wynik).toEqual({ ok: false, error: "Wstrzymany" });
      // Odmowa NIE jest awarią: żadnego alertu, status bez zmian.
      expect(alerty()).toHaveLength(0);
      expect(dostawca().status).toBe("wstrzymany");
    });
  });

  describe("bramki wejściowe — port 1:1", () => {
    it("nieznany dostawca → `Dostawca nie istnieje`, ale audyt ZAMIARU i tak powstaje", async () => {
      const odp = await synchronizujTeraz("MO404");

      expect(odp.status).toBe(200);
      expect(odp.body).toEqual({ ok: false, error: "Dostawca nie istnieje" });
      // Oryginał pisze audyt PRZED synchronizacją i bezwarunkowo (`:48240`).
      expect(audyt()).toHaveLength(1);
      expect(audyt()[0]!.encja_id).toBe("MO404");
      expect(alerty()).toHaveLength(0);
    });

    it("dostawca bez URL → `Brak URL`, bez alertu", async () => {
      zasiej({ url: null });

      const odp = await synchronizujTeraz();

      expect(odp.body).toEqual({ ok: false, error: "Brak URL" });
      expect(alerty()).toHaveLength(0);
      expect(dostawca().status).toBe("aktywny");
    });

    it("dostawca wyłączony z importu (MO6, migracja 002) → odmowa", async () => {
      const serwer = await zapamietaj(
        postawSerwer((_zad, odp) => {
          odp.writeHead(200);
          odp.end(CENNIK_MO1);
        }),
      );
      zasiej({ url: serwer.url(), importWylaczony: 1 });

      const odp = await synchronizujTeraz();

      expect(odp.body).toMatchObject({ ok: false });
      expect(String((odp.body as { error: string }).error)).toContain("wyłączony z importu");
      expect(alerty()).toHaveLength(0);
    });

    it("bez tokenu → 401", async () => {
      zasiej({ url: "http://127.0.0.1:1/cennik.csv" });
      const odp = await request(srodowisko.app).post("/api/dostawcy/MO1/synchronizuj-teraz").send({});
      expect(odp.status).toBe(401);
    });
  });

  describe("odporność parsera", () => {
    it("plik nieparsowalny → alert „Błąd pobierania” (jeden `catch` wokół całości, jak w oryginale)", async () => {
      const serwer = await zapamietaj(
        postawSerwer((_zad, odp) => {
          odp.writeHead(200, { "content-type": "text/csv" });
          odp.end("to nie jest cennik\nżadnych kolumn\n");
        }),
      );
      zasiej({ url: serwer.url() });

      const odp = await synchronizujTeraz();

      expect(odp.body).toMatchObject({ ok: false });
      const lista = alerty();
      expect(lista).toHaveLength(1);
      // Nazwa typu jest myląca, ale WIERNA: oryginał ma jeden blok `catch` (`:48105`),
      // a po usunięciu fallbacku `Wc()` błąd parsera trafia tam bezpośrednio.
      expect(lista[0]!.typ).toBe("Błąd pobierania");
      expect(dostawca().status).toBe("blad");
    });
  });
});
