// Dane do faktury i kontakt partnerów B2B (ticket 253) — krok wdrożenia `2026-10-13-partnerzy-dane-faktury`.
//
// Źródło: kartoteka kontrahentów użytkowniczki (zrzuty ekranu z 2026-10-13). To DANE REJESTROWE FIRM (nazwa, numer VAT UE, adres siedziby) i adresy
// ogólnych skrzynek firmowych — nie dane osób. Telefonów NIE wpisujemy do repozytorium (publiczne): użytkowniczka uzupełnia je w panelu.
// Zasada jak w `konfiguracja-startowa.ts`: UZUPEŁNIA tylko puste pola, niczego nie nadpisuje (użytkowniczka mogła coś już ustawić w panelu).
// NIE wpisujemy numerów VAT, których na zrzucie nie było w całości (LT, NL, SE — obcięte; ES — niepewny ostatni znak): użytkowniczka dopisuje je w panelu,
// a do tego czasu zamówienie z takim krajem dostawy jest zablokowane (brak NIP w danych kraju), a nie wystawione z błędnym numerem.

import { and, eq, isNull } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { partnerKraje, partnerzy } from "../db/schema.js";

type Faktura = { nazwa: string; nip: string | null; ulica: string; kod: string; miasto: string; kraj: string };

const TYREWORLD: Faktura & { email: string } = {
  nazwa: "B. Fuhrmann Einzelhandel GmbH", nip: "DE254343915", ulica: "Brennaborstr. 10", kod: "44149", miasto: "Dortmund", kraj: "DE",
  email: "buchhaltung@tyre-world.de",
};

const ADTYRES_SIEDZIBA = {
  nazwa: "AD Tyres International SLU", ulica: "Carrer Bonaventura Armengol 10, Edifici Monclar, Bloc N", kod: "AD500", miasto: "Andorra la Vella", kraj: "AD",
};
const ADTYRES_EMAIL = "bill@adtyre.com";

/** Numer VAT UE spółki Adtyres w danym kraju (z prefiksem kraju) — tylko te, które były czytelne w całości. */
export const ADTYRES_VAT_WG_KRAJU: Record<string, string> = {
  AT: "ATU71690869", BE: "BE0668751256", CZ: "CZ683941214", DE: "DE307418599", FR: "FR08822336640", HU: "HU30406090",
  IT: "IT01644590083", LU: "LU29012574", LV: "LV90010986441", RO: "RO36571660", SK: "SK4120053949",
};

/** Stawka VAT „0 % WDT” w Selly (potwierdzona przez użytkowniczkę 2026-10-13). */
export const SELLY_VAT_WDT = 101;

export function uzupelnijDanePartnerow(db: Baza): string {
  const opisy: string[] = [];
  const wszystkie = db.select().from(partnerzy).all();

  for (const p of wszystkie) {
    const nazwa = p.nazwa.toLowerCase();
    if (nazwa !== "tyreworld" && nazwa !== "adtyres") continue;
    const tw = nazwa === "tyreworld";
    const dane = tw ? TYREWORLD : { ...ADTYRES_SIEDZIBA, nip: null, email: ADTYRES_EMAIL };
    const zmiany: Record<string, unknown> = {};
    const ustaw = (pole: keyof typeof p, wartosc: string | number | null): void => {
      if (wartosc !== null && (p[pole] === null || p[pole] === undefined)) zmiany[pole] = wartosc;
    };
    ustaw("fakturaNazwa", dane.nazwa);
    ustaw("fakturaNip", dane.nip);
    ustaw("fakturaUlica", dane.ulica);
    ustaw("fakturaKod", dane.kod);
    ustaw("fakturaMiasto", dane.miasto);
    ustaw("fakturaKraj", dane.kraj);
    ustaw("kontaktEmail", dane.email);
    ustaw("sellyVatId", SELLY_VAT_WDT);
    if (Object.keys(zmiany).length) {
      db.update(partnerzy).set({ ...zmiany, zmieniono: new Date().toISOString() }).where(eq(partnerzy.id, p.id)).run();
    }
    let kraje = 0;
    if (!tw) {
      for (const [kraj, nip] of Object.entries(ADTYRES_VAT_WG_KRAJU)) {
        const r = db
          .update(partnerKraje)
          .set({ fakturaNazwa: ADTYRES_SIEDZIBA.nazwa, fakturaNip: nip, fakturaUlica: ADTYRES_SIEDZIBA.ulica, fakturaKod: ADTYRES_SIEDZIBA.kod, fakturaMiasto: ADTYRES_SIEDZIBA.miasto, fakturaKraj: ADTYRES_SIEDZIBA.kraj })
          .where(and(eq(partnerKraje.partnerId, p.id), eq(partnerKraje.kraj, kraj), isNull(partnerKraje.fakturaNazwa)))
          .run();
        kraje += r.changes;
      }
    }
    opisy.push(`${p.nazwa}: uzupełniono pól partnera: ${Object.keys(zmiany).length}${tw ? "" : `, krajów z danymi do faktury: ${kraje}`}`);
  }
  return opisy.length ? opisy.join("; ") : "brak partnerów TyreWorld/Adtyres — nic do uzupełnienia";
}
