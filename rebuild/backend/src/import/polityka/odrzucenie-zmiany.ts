// „Odrzuć” w szczegółach pozycji stagingu: ZOSTAW KARTĘ BEZ ZMIAN i zapamiętaj to jak poprawkę Marty.
//
// ⚠ NOWE ZACHOWANIE, NIE PORT (decyzja użytkowniczki, 2026-10-05). Gdy plik dostawcy proponuje zmianę
// nazwy/modelu/marki/rozmiaru istniejącej karty, a proponowana wartość jest gorsza, do tej pory były
// dwie drogi: ręcznie wpisać starą wartość w pola edycji albo „Odrzuć” z listy, które nic nie
// zapamiętywało (ta sama propozycja wracała przy następnym imporcie).
//
// Tu decyzja: karta zostaje DOKŁADNIE taka, jaka jest (żadnej zmiany w katalogu), a dla każdego pola
// tożsamości, które się różni, powstaje poprawka Marty (`manual_overrides`) z OBECNĄ wartością karty
// i `acknowledgedSourceValue` = wartość z pliku. Skutek jest ten sam, co przy ręcznej edycji:
//  • kolejny import podstawia wartość karty i nie zgłasza różnicy,
//  • ⚠ TAK SAMO JAK KAŻDA POPRAWKA MARTY: Staging v2 nakłada poprawki CICHO (`fabryka.ts`, `nalozPoprawki`) —
//    także gdy dostawca zmieni wartość jeszcze raz, karta zostaje przy wartości z poprawki i nic nie
//    alarmuje (alarm „plik chciał nadpisać poprawkę” istniał tylko w starym `tk()`),
//  • poprawka jest widoczna na karcie produktu i można ją usunąć (`DELETE /api/overrides/{id}`),
//    wtedy plik znów decyduje.
// Zgłoszenie znika.
//
// ⚠ Cena, marża, stan i magazyn z pliku WCHODZĄ OD RAZU (z wpisem do historii cen). Importer odkłada cały
// wiersz do stagingu i nie rusza wtedy karty (`fabryka.ts`: `doStagingu` + `continue`), więc dopóki
// zgłoszenie czeka, cena i stan na karcie są nieświeże. Bez tego po „Odrzuć” zostawałyby takie aż do
// następnego importu. Tożsamość (nazwa, model…) zostaje z karty. Karty WSTRZYMANEJ nie dotykamy stanem
// (tak samo jak cicha aktualizacja importera: wstrzymana zostaje ze stanem 0).

import { and, eq } from "drizzle-orm";
import type { Baza } from "../../db/index.js";
import { manualOverrides, markups, promotions } from "../../db/schema.js";
import { cenaSprzedazyPoZmianieZakupu } from "../../repos/ceny.js";
import { zapiszHistorieCen } from "../../repos/historia.js";
import { zapiszPoprawke } from "../../repos/overrides.js";
import { aktualizujProdukt, type ProduktWewnetrzny } from "../../repos/products.js";
import { odrzucPozycjeStagingu } from "../akceptacja.js";
import { uchwytSqlite } from "../silnik/bridge-ext.js";
import { KEYS, norm, odmow } from "./helpery.js";
import { pozycjaStagingu, produktPoKodzie, type Snapshot } from "./kontekst.js";

export type WynikOdrzuceniaZmiany = {
  kod: string;
  /** Pola, dla których powstała poprawka z wartością karty. */
  zachowanePola: string[];
  /** Pola, które się różnią, ale karta ma je puste — nie da się ich zachować poprawką. */
  pominietePola: string[];
  /** Pola handlowe zaktualizowane z pliku od razu (cena, marża, stan, magazyn). */
  zaktualizowanePola: string[];
};

/** Pola handlowe, które cicha aktualizacja importera zmienia bez akceptacji (`fabryka.ts`). */
const POLA_HANDLOWE = ["cenaZakupu", "cenaSprzedazy", "marzaPct", "stan", "magazyn"] as const;

export function odrzucZmianeKarty(db: Baza, id: number, uzytkownikId: number): WynikOdrzuceniaZmiany {
  const row = pozycjaStagingu(db, id);
  if (!row) odmow("Zgłoszenie już nie istnieje. Odśwież staging.");
  if (row.typZmiany !== "zmiana_kluczowa") {
    odmow(
      "„Odrzuć” zostawia kartę bez zmian, więc działa tylko dla zmiany istniejącego produktu. " +
        "Pozycję innego typu odrzucisz na liście.",
    );
  }
  const karta = produktPoKodzie(db, row.kod);
  if (!karta) odmow("W katalogu nie ma karty tej pozycji — nie ma czego zachować.");

  let snap: Snapshot = {};
  try {
    snap = JSON.parse(row.snapshotJson || "{}") as Snapshot;
  } catch {
    odmow("Zgłoszenie ma uszkodzone dane z pliku — nie można ustalić, co się zmieniło.");
  }

  const doZachowania: { pole: string; wartoscKarty: string; wartoscZPliku: string }[] = [];
  const pominiete: string[] = [];
  const kartaJakRekord = karta as unknown as Record<string, unknown>;
  for (const pole of KEYS) {
    const zPliku = snap[pole];
    const zKarty = kartaJakRekord[pole];
    if (norm(zPliku) === norm(zKarty)) continue;
    if (zKarty == null || String(zKarty).trim() === "") {
      pominiete.push(pole);
      continue;
    }
    doZachowania.push({
      pole,
      wartoscKarty: String(zKarty),
      wartoscZPliku: zPliku == null ? "" : String(zPliku),
    });
  }

  if (!doZachowania.length) {
    odmow(
      pominiete.length
        ? "Karta ma puste pola, w których plik się różni — nie da się ich zachować poprawką."
        : "Pozycja nie różni się już od karty — nic do odrzucenia.",
    );
  }

  const teraz = new Date().toISOString();

  // Wartości handlowe z pliku — te same, co w cichej aktualizacji importera (tylko niepuste i różne od karty).
  const wKolumnach: Record<string, unknown> = {
    cenaZakupu: row.cenaZakupuNowa,
    stan: row.stanNowy,
    magazyn: row.magazyn,
  };
  const patch: Record<string, unknown> = {};
  for (const pole of POLA_HANDLOWE) {
    const wartosc = snap[pole] ?? wKolumnach[pole];
    if (wartosc == null || norm(wartosc) === norm(kartaJakRekord[pole])) continue;
    if (pole === "stan" && karta.status === "wstrzymany") continue;
    patch[pole] = wartosc;
  }

  // Ticket 191: nowa cena zakupu z pliku przelicza cenę sprzedaży z narzutu — chyba że plik niesie
  // własną cenę sprzedaży albo karta ma ręczną poprawkę ceny sprzedaży (`manual_overrides`).
  if (patch.cenaZakupu != null && patch.cenaSprzedazy == null) {
    const poprawkaCeny = db
      .select()
      .from(manualOverrides)
      .where(and(eq(manualOverrides.supplierProductId, karta.kod), eq(manualOverrides.fieldName, "cenaSprzedazy")))
      .get();
    if (!poprawkaCeny) {
      const wynikCeny = cenaSprzedazyPoZmianieZakupu(
        { ...kartaJakRekord, ...patch },
        db.select().from(markups).all(),
        db.select().from(promotions).all(),
      );
      if (wynikCeny) {
        if (norm(wynikCeny.cenaSprzedazy) !== norm(kartaJakRekord.cenaSprzedazy)) {
          patch.cenaSprzedazy = wynikCeny.cenaSprzedazy;
        }
        if (norm(wynikCeny.marzaPct) !== norm(kartaJakRekord.marzaPct)) patch.marzaPct = wynikCeny.marzaPct;
      }
    }
  }

  uchwytSqlite(db).transaction(() => {
    for (const { pole, wartoscKarty, wartoscZPliku } of doZachowania) {
      zapiszPoprawke(db, {
        supplierKod: row.dostawca,
        supplierProductId: row.kod,
        fieldName: pole,
        overrideValue: wartoscKarty,
        reason: `Odrzucona zmiana z pliku dostawcy (staging): plik podał „${wartoscZPliku}”`,
        createdBy: uzytkownikId,
        createdAt: teraz,
        // Wartość z pliku zapamiętana jako „widziana” — ten sam wpis nie wraca; inny wywoła alarm.
        acknowledgedSourceValue: wartoscZPliku || null,
      });
    }
    if (Object.keys(patch).length) {
      aktualizujProdukt(db, karta.id, { ...patch, dataAktualizacji: teraz } as Partial<ProduktWewnetrzny>);
      // Tożsamość z karty (sprzed zmiany), ceny i stan — z wartości PO (tak samo jak w imporcie).
      zapiszHistorieCen(db, {
        produktId: karta.id,
        kod: karta.kod,
        ean: karta.ean ?? null,
        dostawca: row.dostawca,
        marka: karta.marka,
        model: karta.model,
        rozmiar: karta.rozmiar,
        indeksNosnosci: karta.indeksNosnosci,
        indeksPredkosci: karta.indeksPredkosci,
        kategoria: karta.kategoria,
        cenaZakupu: (patch.cenaZakupu as number) ?? karta.cenaZakupu,
        cenaSprzedazy: (patch.cenaSprzedazy as number) ?? karta.cenaSprzedazy,
        stan: (patch.stan as number) ?? karta.stan,
        zarejestrowanoAt: teraz,
      });
    }
    odrzucPozycjeStagingu(db, id);
  })();

  return {
    kod: row.kod,
    zachowanePola: doZachowania.map((d) => d.pole),
    pominietePola: pominiete,
    zaktualizowanePola: Object.keys(patch),
  };
}
