/**
 * Testy samego harnessu GATE — będzie służył wszystkim kolejnym iteracjom,
 * więc jego porównywarka kształtu musi realnie wyłapywać rozjazdy (i nie zgłaszać fałszywek).
 */
import { describe, expect, it } from "vitest";
import { KATALOG_FIXTURES, katalogRepo } from "./gate/repo.js";
import { porownajKsztalt } from "./gate/ksztalt.js";
import { wczytajFixture } from "./gate/fixtures.js";
import { wczytajKontrakt } from "./gate/kontrakt.js";

describe("porownajKsztalt", () => {
  const bezRoznic = (a: unknown, w: unknown) => porownajKsztalt(a, w).roznice;

  it("przepuszcza identyczny kształt", () => {
    expect(bezRoznic({ id: 2, email: "x@y.z" }, { id: 1, email: "a@b.c" })).toEqual([]);
  });

  it("wyłapuje brakujący klucz", () => {
    const r = bezRoznic({ id: 1 }, { id: 1, email: "a@b.c" });
    expect(r).toHaveLength(1);
    expect(r[0]?.sciezka).toBe("$.email");
  });

  it("wyłapuje klucz nadmiarowy", () => {
    const r = bezRoznic({ id: 1, extra: true }, { id: 1 });
    expect(r).toHaveLength(1);
    expect(r[0]?.opis).toContain("nadmiarowy");
  });

  it("wyłapuje niezgodny typ", () => {
    const r = bezRoznic({ id: "1" }, { id: 1 });
    expect(r).toHaveLength(1);
    expect(r[0]?.opis).toContain("oczekiwano number");
  });

  it("schodzi w zagnieżdżenie", () => {
    const r = bezRoznic({ a: { b: { c: 1 } } }, { a: { b: { c: "tekst" } } });
    expect(r[0]?.sciezka).toBe("$.a.b.c");
  });

  it("sprawdza każdy element tablicy względem scalonego szablonu z fixture'a", () => {
    const wzorzec = [{ id: 1, nazwa: "a" }, { id: 2, nazwa: null }];
    expect(bezRoznic([{ id: 9, nazwa: "z" }], wzorzec)).toEqual([]);
    const r = bezRoznic([{ id: 9 }], wzorzec);
    expect(r[0]?.sciezka).toBe("$[0].nazwa");
  });

  it("null w fixture akceptuje dowolny typ (kolumna nullable)", () => {
    expect(bezRoznic({ pole: "cokolwiek" }, { pole: null })).toEqual([]);
  });

  it("null w odpowiedzi tam, gdzie fixture miał wartość → ostrzeżenie, nie różnica", () => {
    const wynik = porownajKsztalt({ pole: null }, { pole: "wartość" });
    expect(wynik.roznice).toEqual([]);
    expect(wynik.ostrzezenia).toHaveLength(1);
  });

  it("pomija klucze techniczne fixture'a (_przyciete)", () => {
    expect(bezRoznic({ dane: [] }, { dane: [], _przyciete: true })).toEqual([]);
  });

  it("pusta tablica we wzorcu nie narzuca kształtu elementów", () => {
    expect(bezRoznic([{ cokolwiek: 1 }], [])).toEqual([]);
  });
});

describe("wczytajKontrakt", () => {
  const kontrakt = wczytajKontrakt();

  it("znajduje operacje po metodzie i ścieżce", () => {
    expect(kontrakt.znajdzOperacje("GET", "/api/me")).toBeDefined();
    expect(kontrakt.znajdzOperacje("DELETE", "/api/me")).toBeUndefined();
    expect(kontrakt.znajdzOperacje("GET", "/api/nie-ma")).toBeUndefined();
  });

  it("dopasowuje ścieżki z parametrem", () => {
    const op = kontrakt.znajdzOperacje("DELETE", "/api/markups/42");
    expect(op?.wzorzecSciezki).toBe("/api/markups/{id}");
  });

  it("ignoruje query string", () => {
    expect(kontrakt.znajdzOperacje("GET", "/api/me?x=1")).toBeDefined();
  });

  it("rozpoznaje, które operacje wymagają auth", () => {
    expect(kontrakt.znajdzOperacje("POST", "/api/login")?.wymagaAuth).toBe(false);
    expect(kontrakt.znajdzOperacje("POST", "/api/password/change")?.wymagaAuth).toBe(true);
  });

  it("zgłasza status spoza kontraktu i odpowiedź nie-JSON", () => {
    expect(
      kontrakt.sprawdzOdpowiedz({ metoda: "GET", sciezka: "/api/me", status: 200,
        contentType: "application/json; charset=utf-8" }),
    ).toEqual([]);
    expect(
      kontrakt.sprawdzOdpowiedz({ metoda: "GET", sciezka: "/api/me", status: 418 }),
    ).toHaveLength(1);
    expect(
      kontrakt.sprawdzOdpowiedz({ metoda: "GET", sciezka: "/api/me", status: 200,
        contentType: "text/html" }),
    ).toHaveLength(1);
  });
});

describe("dostęp do źródeł prawdy", () => {
  it("znajduje repo, kontrakt i fixtures niezależnie od katalogu roboczego", () => {
    expect(katalogRepo()).toBeTruthy();
    expect(KATALOG_FIXTURES()).toContain("fixtures");
    expect(wczytajFixture("GET_me.json").endpoint).toBe("/api/me");
  });
});
