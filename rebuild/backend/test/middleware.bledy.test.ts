/**
 * Handler błędów — statusy 4xx z parserów ciała (SyntaxError 400, PayloadTooLargeError 413)
 * mają wracać do klienta ze swoim kodem, a nie być maskowane jako 500 (review SHOULD-FIX).
 */
import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { bladHandler } from "../src/middleware/errors.js";

function atrapaOdpowiedzi() {
  const stan = { status: 0, cialo: undefined as unknown };
  const res = {
    headersSent: false,
    status(kod: number) {
      stan.status = kod;
      return this;
    },
    json(cialo: unknown) {
      stan.cialo = cialo;
      return this;
    },
  };
  return { res: res as unknown as Response, stan };
}

const zadanie = { method: "POST", originalUrl: "/api/login" } as Request;

describe("bladHandler", () => {
  it("oddaje status 413 (za duże ciało) zamiast 500", () => {
    const { res, stan } = atrapaOdpowiedzi();
    bladHandler(
      Object.assign(new Error("request entity too large"), { status: 413 }),
      zadanie,
      res,
      vi.fn() as unknown as NextFunction,
    );
    expect(stan.status).toBe(413);
    expect(stan.cialo).toEqual({ error: "Błędne żądanie" });
  });

  it("oddaje status 400 (zepsuty JSON)", () => {
    const { res, stan } = atrapaOdpowiedzi();
    bladHandler(
      Object.assign(new SyntaxError("Unexpected token"), { status: 400 }),
      zadanie,
      res,
      vi.fn() as unknown as NextFunction,
    );
    expect(stan.status).toBe(400);
  });

  it("nieoczekiwany błąd → 500 bez wycieku treści błędu", () => {
    const { res, stan } = atrapaOdpowiedzi();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    bladHandler(new Error("sekretny szczegół implementacji"), zadanie, res,
      vi.fn() as unknown as NextFunction);
    spy.mockRestore();
    expect(stan.status).toBe(500);
    expect(stan.cialo).toEqual({ error: "Błąd serwera" });
    expect(JSON.stringify(stan.cialo)).not.toContain("sekretny");
  });

  it("gdy nagłówki już wysłane — deleguje dalej, nie próbuje pisać drugi raz", () => {
    const { res, stan } = atrapaOdpowiedzi();
    (res as unknown as { headersSent: boolean }).headersSent = true;
    const next = vi.fn();
    const blad = new Error("za późno");
    bladHandler(blad, zadanie, res, next as unknown as NextFunction);
    expect(next).toHaveBeenCalledWith(blad);
    expect(stan.status).toBe(0);
  });
});
