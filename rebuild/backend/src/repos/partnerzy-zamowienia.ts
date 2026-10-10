// Zamówienia partnerów — zapis i odczyt (karta PARTNERZY, ticket 228 / PRT-7.1). Walidacja biznesowa (7.4) i Selly (7.5) to osobne tickety.

import { createHash } from "node:crypto";

import { and, asc, desc, eq, sql } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { partnerZamowienia, partnerZamowieniaPozycje } from "../db/schema.js";
import { parsujZamowienie } from "../partnerzy/zamowienie-xml.js";

export type WynikZapisu = {
  id: number;
  /** true — utworzono nowe zamówienie; false — numer partnera już był (idempotencja). */
  nowe: boolean;
  /** Tylko przy `nowe = false`: treść pliku różni się od zapisanej. Zapisanej NIE nadpisujemy — decyzja należy do człowieka. */
  zmieniony: boolean;
};

/**
 * Parsuje i zapisuje zamówienie partnera. Idempotentne po `NUMBER`: ponowny plik z tym samym numerem nie tworzy duplikatu.
 * Błąd strukturalny pliku → `BladZamowienia` (nic nie jest zapisane).
 */
export function zapiszZamowienie(db: Baza, partnerId: number, xml: string, teraz: Date = new Date()): WynikZapisu {
  const z = parsujZamowienie(xml);
  // Skrót z TREŚCI (sparsowanej), nie z bajtów — białe znaki, BOM i kolejność deklaracji nie udają zmiany zamówienia.
  const skrot = createHash("sha256").update(JSON.stringify(z)).digest("hex");
  return db.transaction((tx) => {
    const istniejace = tx
      .select({ id: partnerZamowienia.id, skrot: partnerZamowienia.skrotXml })
      .from(partnerZamowienia)
      .where(and(eq(partnerZamowienia.partnerId, partnerId), eq(partnerZamowienia.numerPartnera, z.numerPartnera)))
      .get();
    if (istniejace) return { id: istniejace.id, nowe: false, zmieniony: istniejace.skrot !== skrot };

    const id = Number(
      tx
        .insert(partnerZamowienia)
        .values({
          partnerId,
          numerPartnera: z.numerPartnera,
          dataZamowienia: z.dataZamowienia,
          dataDostawy: z.dataDostawy,
          waluta: z.waluta,
          kosztDostawy: z.kosztDostawy,
          krajDostawy: z.krajDostawy,
          fakturaJson: JSON.stringify(z.faktura),
          dostawaJson: JSON.stringify(z.dostawa),
          surowyXml: xml,
          skrotXml: skrot,
          pobrano: teraz.toISOString(),
        })
        .run().lastInsertRowid,
    );
    for (const p of z.pozycje) {
      tx.insert(partnerZamowieniaPozycje).values({ zamowienieId: id, lp: p.lp, kod: p.kod, nazwa: p.nazwa, ilosc: p.ilosc, cenaSprzedazy: p.cenaSprzedazy }).run();
    }
    return { id, nowe: true, zmieniony: false };
  }, { behavior: "immediate" });
}

/** Zamówienia partnera, najnowsze pobrane najpierw (bez surowego XML — jest duży). `liczbaPozycji` liczona w SQL. */
export function listaZamowien(db: Baza, partnerId: number, limit = 100, offset = 0) {
  return db
    .select({
      id: partnerZamowienia.id,
      numerPartnera: partnerZamowienia.numerPartnera,
      numerWlasny: partnerZamowienia.numerWlasny,
      status: partnerZamowienia.status,
      dataZamowienia: partnerZamowienia.dataZamowienia,
      waluta: partnerZamowienia.waluta,
      krajDostawy: partnerZamowienia.krajDostawy,
      pobrano: partnerZamowienia.pobrano,
      // Jawne nazwy tabel: Drizzle w podzapytaniu renderuje kolumny bez kwalifikatora, a `id` zasłoniłoby wtedy tabelę zewnętrzną.
      liczbaPozycji: sql<number>`(SELECT count(*) FROM partner_zamowienia_pozycje p WHERE p.zamowienie_id = partner_zamowienia.id)`,
    })
    .from(partnerZamowienia)
    .where(eq(partnerZamowienia.partnerId, partnerId))
    .orderBy(desc(partnerZamowienia.pobrano), desc(partnerZamowienia.id))
    .limit(limit)
    .offset(offset)
    .all();
}

export function szczegolyZamowienia(db: Baza, id: number) {
  const zamowienie = db.select().from(partnerZamowienia).where(eq(partnerZamowienia.id, id)).get();
  if (!zamowienie) return null;
  const pozycje = db.select().from(partnerZamowieniaPozycje).where(eq(partnerZamowieniaPozycje.zamowienieId, id)).orderBy(asc(partnerZamowieniaPozycje.lp)).all();
  return { ...zamowienie, faktura: JSON.parse(zamowienie.fakturaJson) as Record<string, string>, dostawa: JSON.parse(zamowienie.dostawaJson) as Record<string, string>, pozycje };
}

/** Szczegóły zamówienia do API/panelu: bez `surowy_xml`, skrótu i surowych JSON-ów (są odpowiednio ciężkie lub zdublowane w `faktura`/`dostawa`). */
export function szczegolyZamowieniaDlaPartnera(db: Baza, partnerId: number, zamowienieId: number) {
  const z = szczegolyZamowienia(db, zamowienieId);
  if (!z || z.partnerId !== partnerId) return null;
  const { surowyXml: _xml, skrotXml: _skrot, fakturaJson: _f, dostawaJson: _d, ...reszta } = z;
  return reszta;
}
