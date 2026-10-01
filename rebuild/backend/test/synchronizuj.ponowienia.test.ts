// Ticket 179 — Etap 4 SPEC 2026-10-01: ponowienia pobierania cenników (4a) i próg „podejrzanie mały” (4b).
// Prawdziwy serwer HTTP na porcie efemerycznym i prawdziwy SQLite — bez mocków transportu.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";

import { suppliers } from "../src/db/schema.js";
import {
  ODSTEP_PONOWIEN_MS,
  PONOWIENIA_SYNCHRONIZACJI,
  synchronizujDostawce,
  TIMEOUT_SYNCHRONIZACJI_MS,
} from "../src/import/synchronizuj.js";
import { stworzTestowaBaze, type TestowaBaza } from "./gate/baza.js";

let baza: TestowaBaza | null = null;
const serwery: Server[] = [];
afterEach(async () => {
  await Promise.all(
    serwery.splice(0).map(
      (s) =>
        new Promise<void>((r) => {
          s.closeAllConnections?.();
          s.close(() => r());
        }),
    ),
  );
  baza?.posprzataj();
  baza = null;
});

async function serwer(obsluga: Parameters<typeof createServer>[1]): Promise<string> {
  const s = createServer(obsluga);
  serwery.push(s);
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  return `http://127.0.0.1:${(s.address() as AddressInfo).port}/cennik.csv`;
}

function zasiej(url: string): TestowaBaza {
  baza = stworzTestowaBaze();
  baza.db
    .insert(suppliers)
    .values({ kod: "MO1", nazwa: "Bohnenkamp", formatPliku: "csv", sposobDostarczania: "url", czestotliwoscMinuty: 60, url, status: "aktywny" })
    .run();
  return baza;
}
const alerty = () => baza!.sqlite.prepare("SELECT typ, opis FROM alerts").all() as { typ: string; opis: string }[];

const CSV = "kod;nazwa\n"; // pusty cennik — parser go odrzuci, ale po pobraniu; tu liczy się tylko transport

describe("4a — limity i ponowienia pobierania", () => {
  it("stałe: 120 s, 2 ponowienia, odstęp 120 s", () => {
    expect(TIMEOUT_SYNCHRONIZACJI_MS).toBe(120_000);
    expect(PONOWIENIA_SYNCHRONIZACJI).toBe(2);
    expect(ODSTEP_PONOWIEN_MS).toBe(120_000);
  });

  it("5xx dwa razy, potem sukces: bez alertu błędu, 3 żądania, odstępy przez wstrzyknięte czekanie", async () => {
    let zadania = 0;
    const url = await serwer((_z, o) => {
      zadania += 1;
      if (zadania < 3) {
        o.writeHead(503);
        o.end();
      } else {
        o.writeHead(200);
        o.end(CSV);
      }
    });
    const b = zasiej(url);
    const odstepy: number[] = [];
    const wynik = await synchronizujDostawce({
      db: b.db,
      odstepPonowienMs: 120_000,
      czekaj: async (ms) => void odstepy.push(ms),
    })("MO1");
    expect(zadania).toBe(3);
    expect(odstepy).toEqual([120_000, 120_000]);
    expect(alerty().filter((a) => a.typ === "Błąd HTTP")).toEqual([]);
    expect(wynik.ok === true || !/HTTP 5/.test((wynik as { error: string }).error)).toBe(true);
  });

  it("5xx za każdym razem: JEDEN alert po 3. próbie, z liczbą prób i czasami", async () => {
    let zadania = 0;
    const url = await serwer((_z, o) => {
      zadania += 1;
      o.writeHead(500);
      o.end();
    });
    const b = zasiej(url);
    const wynik = await synchronizujDostawce({ db: b.db, odstepPonowienMs: 0 })("MO1");
    expect(zadania).toBe(3);
    expect(wynik).toEqual({ ok: false, error: "HTTP 500" });
    expect(alerty()).toEqual([
      { typ: "Błąd HTTP", opis: "MO1 (Bohnenkamp): HTTP 500 (próby: 3, odstęp 0 s, limit 120 s)" },
    ]);
  });

  it("błąd sieci (zerwane połączenie) jest ponawiany, alert dopiero po 3. próbie", async () => {
    let polaczenia = 0;
    const s = createServer(() => undefined);
    s.on("connection", (g) => {
      polaczenia += 1;
      g.destroy();
    });
    serwery.push(s);
    await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
    const b = zasiej(`http://127.0.0.1:${(s.address() as AddressInfo).port}/cennik.csv`);
    const wynik = await synchronizujDostawce({ db: b.db, odstepPonowienMs: 0 })("MO1");
    expect(wynik.ok).toBe(false);
    expect(polaczenia).toBe(3);
    expect(alerty()).toHaveLength(1);
    expect(alerty()[0]!.opis).toContain("(próby: 3");
  });

  it("4xx NIE jest ponawiane: jedno żądanie, alert bez dopisku o próbach", async () => {
    let zadania = 0;
    const url = await serwer((_z, o) => {
      zadania += 1;
      o.writeHead(404);
      o.end();
    });
    const b = zasiej(url);
    await synchronizujDostawce({ db: b.db, odstepPonowienMs: 0 })("MO1");
    expect(zadania).toBe(1);
    expect(alerty()).toEqual([{ typ: "Błąd HTTP", opis: "MO1 (Bohnenkamp): HTTP 404" }]);
  });

  it("kolejna synchronizacja tego dostawcy w trakcie trwającej nie nakłada się (bez alertu)", async () => {
    let zwolnij: () => void = () => undefined;
    const trzymane = new Promise<void>((r) => (zwolnij = r));
    let zadania = 0;
    const url = await serwer((_z, o) => {
      zadania += 1;
      void trzymane.then(() => {
        o.writeHead(200);
        o.end(CSV);
      });
    });
    const b = zasiej(url);
    const sync = synchronizujDostawce({ db: b.db, odstepPonowienMs: 0 });
    const pierwsza = sync("MO1");
    await new Promise((r) => setTimeout(r, 100));
    expect(await sync("MO1")).toEqual({ ok: false, error: "Synchronizacja tego dostawcy już trwa" });
    zwolnij();
    await pierwsza;
    expect(zadania).toBe(1);
    expect(alerty().filter((a) => a.opis.includes("już trwa"))).toEqual([]);
  });
});
