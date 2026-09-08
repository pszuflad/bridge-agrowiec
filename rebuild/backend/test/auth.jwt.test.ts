/**
 * Podpis i weryfikacja tokenu — przypięcie algorytmu (finalny audyt 12e, D2c).
 *
 * `jwt.verify` bez opcji `algorithms` przyjmuje każdy algorytm, który biblioteka uzna za
 * pasujący do przekazanego klucza. Przy sekrecie symetrycznym są to warianty HMAC, więc
 * realnego ryzyka nie było — ale bez przypięcia nic nie broni przed cichym rozjazdem, gdyby
 * ktoś kiedyś podmienił sekret na klucz asymetryczny.
 */
import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import {
  CZAS_ZYCIA_TOKENA,
  CZAS_ZYCIA_TOKENA_SEK,
  podpiszToken,
  zweryfikujToken,
} from "../src/auth/jwt.js";

const SEKRET = "sekret-tylko-do-testow-nigdy-do-produkcji";
const PAYLOAD = { id: 1, email: "ania@example.com", imieNazwisko: "Ania Testowa" };

describe("podpiszToken / zweryfikujToken", () => {
  it("token z podpisu przechodzi weryfikację i niesie payload oryginału", () => {
    const payload = zweryfikujToken(podpiszToken(PAYLOAD, SEKRET), SEKRET);
    expect(payload).toMatchObject(PAYLOAD);
    // 30 dni — wartość zamrożona fixture'em logowania (exp - iat = 2592000).
    expect(payload!.exp - payload!.iat).toBe(CZAS_ZYCIA_TOKENA_SEK);
  });

  it("podpisuje HS256 — tym samym algorytmem co oryginał", () => {
    const naglowekB64 = podpiszToken(PAYLOAD, SEKRET).split(".")[0] ?? "";
    const naglowek = JSON.parse(Buffer.from(naglowekB64, "base64url").toString("utf8"));
    expect(naglowek.alg).toBe("HS256");
  });

  it("odrzuca token podpisany innym algorytmem HMAC, mimo poprawnego sekretu", () => {
    const obcy = jwt.sign(PAYLOAD, SEKRET, {
      expiresIn: CZAS_ZYCIA_TOKENA,
      algorithm: "HS512",
    });
    // Bez `algorithms: ["HS256"]` w `jwt.verify` ten token BY PRZESZEDŁ — to jest asercja
    // pilnująca samego przypięcia, nie zachowania widocznego przez API.
    expect(zweryfikujToken(obcy, SEKRET)).toBeNull();
  });

  it("odrzuca token z algorytmem `none` (brak podpisu)", () => {
    const bezPodpisu = jwt.sign(PAYLOAD, "", { algorithm: "none", noTimestamp: false });
    expect(zweryfikujToken(bezPodpisu, SEKRET)).toBeNull();
  });

  it("odrzuca zły sekret, śmieci i token wygasły", () => {
    expect(zweryfikujToken(podpiszToken(PAYLOAD, SEKRET), "inny-sekret")).toBeNull();
    expect(zweryfikujToken("to-nie-jest-token", SEKRET)).toBeNull();
    const wygasly = jwt.sign(PAYLOAD, SEKRET, { algorithm: "HS256", expiresIn: -10 });
    expect(zweryfikujToken(wygasly, SEKRET)).toBeNull();
  });
});
