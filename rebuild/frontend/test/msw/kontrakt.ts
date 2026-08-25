import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Uzytkownik } from "@/lib/api";

const katalogTestow = dirname(fileURLToPath(import.meta.url));
const korzenRepo = resolve(katalogTestow, "../../../..");

/**
 * Użytkownik do mocków brany PROSTO z `contract/fixtures/GET_me.json` — nagranej
 * odpowiedzi żywej produkcji. Dzięki temu testy sprawdzają zgodność z kontraktem,
 * a nie z moim wyobrażeniem o nim: zmiana kształtu fixtura wywali test.
 */
export function uzytkownikZFixtura(): Uzytkownik {
  const sciezka = resolve(korzenRepo, "contract/fixtures/GET_me.json");
  const fixture = JSON.parse(readFileSync(sciezka, "utf8")) as {
    body: { id: number; email: string; imieNazwisko: string };
  };
  const { id, email, imieNazwisko } = fixture.body;
  return { id, email, imieNazwisko };
}

/** Token o kształcie JWT — wartość nieistotna, liczy się, że FE go zapisze i odeśle. */
export const TOKEN_TESTOWY = "naglowek.tresc.podpis";
