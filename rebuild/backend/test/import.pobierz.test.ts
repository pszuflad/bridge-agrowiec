/**
 * Pobieranie cennika po HTTP (`src/import/pobierz.ts`) — przeciw PRAWDZIWEMU serwerowi.
 *
 * Bez mocków `http`/`https`: mockowanie transportu sprawdzałoby tylko, czy poprawnie
 * mockujemy, a stawką jest właśnie zachowanie transportu (przekierowania, kody błędów,
 * składanie kawałków odpowiedzi). Serwer nasłuchuje na porcie EFEMERYCZNYM (`listen(0)`),
 * więc nie ma ryzyka kolizji z równolegle pracującym agentem ani z lokalnym dev-serwerem.
 */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MAX_PRZEKIEROWAN, pobierzZUrl, TIMEOUT_MS } from "../src/import/pobierz.js";

const TRESC = Buffer.from("kod;nazwa;cena\nMO1_1;Opona;199.99\n", "utf8");

describe("pobierzZUrl", () => {
  let serwer: Server;
  let baza: string;
  let licznikPetli = 0;

  beforeAll(async () => {
    serwer = createServer((req, res) => {
      const sciezka = req.url ?? "/";

      if (sciezka === "/cennik.csv") {
        // Wysyłamy w dwóch kawałkach — to sprawdza sklejanie strumienia.
        res.writeHead(200, { "Content-Type": "text/csv" });
        res.write(TRESC.subarray(0, 10));
        res.end(TRESC.subarray(10));
        return;
      }
      if (sciezka === "/przekierowanie") {
        res.writeHead(302, { Location: `${baza}/cennik.csv` });
        res.end();
        return;
      }
      if (sciezka === "/petla") {
        licznikPetli += 1;
        res.writeHead(302, { Location: `${baza}/petla` });
        res.end();
        return;
      }
      if (sciezka === "/pusty") {
        res.writeHead(200);
        res.end();
        return;
      }
      res.writeHead(404);
      res.end("nie ma");
    });

    await new Promise<void>((resolve) => serwer.listen(0, "127.0.0.1", resolve));
    const adres = serwer.address() as AddressInfo;
    baza = `http://127.0.0.1:${adres.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      serwer.close((e) => (e ? reject(e) : resolve())),
    );
  });

  it("pobiera plik i skleja kawałki odpowiedzi", async () => {
    const bufor = await pobierzZUrl(`${baza}/cennik.csv`);
    expect(bufor.equals(TRESC)).toBe(true);
  });

  it("podąża za przekierowaniem 3xx", async () => {
    const bufor = await pobierzZUrl(`${baza}/przekierowanie`);
    expect(bufor.equals(TRESC)).toBe(true);
  });

  it("kod inny niż 200 kończy się czytelnym błędem", async () => {
    await expect(pobierzZUrl(`${baza}/nie-ma`)).rejects.toThrow(
      new RegExp(`HTTP 404 dla ${baza}/nie-ma`),
    );
  });

  it("pusta odpowiedź 200 daje pusty bufor, nie błąd", async () => {
    const bufor = await pobierzZUrl(`${baza}/pusty`);
    expect(bufor).toHaveLength(0);
  });

  /**
   * ODSTĘPSTWO ŚWIADOME (`src/import/pobierz.ts`): oryginał wywołuje się rekurencyjnie
   * bez licznika skoków (extensions.cjs:30-33), więc pętla przekierowań A→A kończy się
   * przepełnieniem stosu albo wiszącym żądaniem. Dokładamy limit; reszta bez zmian.
   */
  it("pętla przekierowań kończy się błędem, a nie wiszącym żądaniem", async () => {
    licznikPetli = 0;
    await expect(pobierzZUrl(`${baza}/petla`)).rejects.toThrow(/Za dużo przekierowań/);
    expect(licznikPetli).toBe(MAX_PRZEKIEROWAN + 1);
  });

  it("nieistniejący host kończy się odrzuceniem obietnicy", async () => {
    await expect(pobierzZUrl("http://127.0.0.1:1/cokolwiek")).rejects.toThrow();
  });

  /** Timeout z oryginału (extensions.cjs:44) — 60 s; sam upływ czasu nie jest tu testowany. */
  it("trzyma timeout z oryginału", () => {
    expect(TIMEOUT_MS).toBe(60_000);
  });
});
