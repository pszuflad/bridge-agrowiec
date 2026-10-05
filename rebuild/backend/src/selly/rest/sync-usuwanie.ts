/**
 * TOR 3: usuwanie z Selly produktów, których NIE MA już w Bridge — ticket 186-FEATURE.
 *
 * ⚠ NOWA LOGIKA BIZNESOWA, NIE PORT. Produkcja nie ma żadnej ścieżki usuwania z Selly
 * (backlog #100, życzenie Ani). Decyzje użytkownika, 2026-10-05: usuwanie działa STAŁE (w harmonogramie,
 * razem z Torem 1), od początku naprawdę usuwa (bez etapu „tylko raport”), a historia ma zapisać DOKŁADNIE
 * który produkt został usunięty i o której godzinie.
 *
 * Model: sierotą jest wiersz mapowania `selly_products` (czyli coś, co Bridge sam założył albo zmapował
 * w Selly), dla którego nie ma już produktu w `products`. Produktów w Selly, których Bridge nigdy nie
 * mapował (założonych ręcznie), NIE dotykamy. Produkt wstrzymany nadal „jest w Bridge” — dostaje stan 0
 * (Tor 1), a nie usunięcie.
 *
 * Brak wiersza w `products` pod parą (dostawca, kod_importu) NIE wystarcza — kod importu bywa zmieniany
 * (`rozdziel-kod-importu`, scalenia), a stare mapowanie wskazuje wtedy wciąż ŻYWĄ ofertę. Dlatego sierota to
 * wiersz, który jednocześnie: (1) nie ma produktu o tym samym `kod` Bridge, (2) nie ma u tego dostawcy
 * produktu z tym samym EAN-em (EAN z `historia_cen`), (3) jego wariant nie jest używany przez inne mapowanie
 * mające produkt, (4) w Selly wariant należy do produktu i ma magazyn tego dostawcy (jak `sprawdzCelSelly`).
 *
 * Bezpieczniki zbiorcze (usunięcie jest nieodwracalne):
 *  • limit usunięć na jeden przebieg (`LIMIT_NA_PRZEBIEG`);
 *  • przy pustym `products` albo gdy sierot jest >`MAKS_UDZIAL_SIEROT` wszystkich mapowań (sygnał
 *    „wyczyszczono katalog” / awarii importu) przebieg się WSTRZYMUJE — nic nie usuwa, zapisuje wpis
 *    w dzienniku (throttling: ten sam wpis najwyżej raz na `WSTRZYMANIE_CISZA_GODZIN`).
 *
 * Historia (dwa miejsca): `audit_log` → widok „Historia” — jeden wpis na każdy usunięty produkt (kod Bridge,
 * nazwa, EAN, id w Selly, dostawca) z godziną usunięcia (`kiedy`, ISO UTC); oraz `selly_sync_log` — jeden wpis na
 * przebieg z listą usuniętych (panel Selly „Historia operacji”). Tabeli `history` NIE ruszamy: czyta ją goła
 * `GET /api/history` (Pulpit, cache edycji katalogu), więc obcy wiersz mógłby tam zaszkodzić.
 */

import type { Baza } from "../../db/index.js";
import { AKCJA_USUNIECIA_Z_SELLY } from "../../historia/mapowanie.js";
import { zapiszAudyt } from "../../repos/audit.js";
import type { ProduktSzczegolySelly, WariantSelly } from "../klient.js";
import type { Discovery } from "./discovery.js";
import type { TrybSelly } from "../tryb.js";

export const LIMIT_NA_PRZEBIEG = 20;
export const MAKS_UDZIAL_SIEROT = 0.3;
export const WSTRZYMANIE_CISZA_GODZIN = 6;

export type Sierota = {
  id: number;
  kod_importu: string;
  dostawca: string;
  bridge_kod: string;
  selly_product_id: number;
  selly_variant_id: number | null;
};

export type AkcjaUsuwania = "usunieto_wariant" | "usunieto_produkt" | "juz_nie_istnial" | "pominieto" | "blad";

export type WpisUsuniecia = {
  kod: string;
  dostawca: string;
  kod_importu: string;
  nazwa: string | null;
  ean: string | null;
  selly_product_id: number;
  selly_variant_id: number | null;
  akcja: AkcjaUsuwania;
  /** Moment decyzji (UTC, `YYYY-MM-DD HH:MM:SS`) — ten sam format co `datetime('now')` w bazie. */
  czas: string;
  powod?: string;
};

export type WynikUsuwania = {
  wstrzymano?: string;
  sieroty: number;
  usuniete_warianty: number;
  usuniete_produkty: number;
  juz_nie_istnialo: number;
  pominiete: number;
  bledy: number;
  wpisy: WpisUsuniecia[];
  logId?: number;
};

const komunikat = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const teraz = (): string => new Date().toISOString().replace("T", " ").slice(0, 19);
const status404 = (e: unknown): boolean => (e as { status?: number } | null)?.status === 404;

const CZESC_SELECT = `
  SELECT sp.id, sp.kod_importu, sp.dostawca, sp.bridge_kod, sp.selly_product_id, sp.selly_variant_id
  FROM selly_products sp
  WHERE sp.selly_product_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM products p WHERE p.dostawca = sp.dostawca AND p.kod_importu = sp.kod_importu)
    AND NOT EXISTS (SELECT 1 FROM products p WHERE p.kod = sp.bridge_kod)
    AND NOT EXISTS (
      SELECT 1 FROM products p
      WHERE p.dostawca = sp.dostawca AND p.ean IS NOT NULL AND p.ean != ''
        AND p.ean IN (SELECT h.ean FROM historia_cen h WHERE h.kod = sp.bridge_kod AND h.ean IS NOT NULL AND h.ean != '')
    )`;

/** Sieroty (bez sprawdzania w Selly) — najstarsze mapowania pierwsze. */
export function znajdzSieroty(db: Baza, limit = LIMIT_NA_PRZEBIEG): { sieroty: Sierota[]; wszystkie: number } {
  const sqlite = db.$client;
  const wszystkie = (sqlite.prepare(`SELECT COUNT(*) c FROM (${CZESC_SELECT})`).get() as { c: number }).c;
  const sieroty = sqlite.prepare(`${CZESC_SELECT} ORDER BY sp.id LIMIT ?`).all(limit) as Sierota[];
  return { sieroty, wszystkie };
}

/** Ostatnie znane dane produktu z historii cen — do sprawdzenia tożsamości w Selly i do wpisu w historii. */
function znaneDane(db: Baza, kod: string): { nazwa: string | null; ean: string | null } {
  const sqlite = db.$client;
  const ean = sqlite
    .prepare(
      "SELECT ean FROM historia_cen WHERE kod = ? AND ean IS NOT NULL AND ean != '' ORDER BY id DESC LIMIT 1",
    )
    .get(kod) as { ean: string } | undefined;
  const nazwa = sqlite
    .prepare("SELECT nazwa FROM history WHERE kod_produktu = ? AND nazwa IS NOT NULL AND nazwa != '' ORDER BY id DESC LIMIT 1")
    .get(kod) as { nazwa: string } | undefined;
  return { nazwa: nazwa?.nazwa ?? null, ean: ean?.ean ?? null };
}

/** Wariant współdzielony z INNYM mapowaniem, które ma jeszcze produkt w Bridge. */
function wariantUzywanyPrzezZywe(db: Baza, s: Sierota): string | null {
  if (s.selly_variant_id == null) return null;
  const r = db.$client
    .prepare(
      `SELECT o.bridge_kod FROM selly_products o
       WHERE o.id != ? AND o.selly_variant_id = ?
         AND EXISTS (SELECT 1 FROM products p WHERE p.dostawca = o.dostawca AND p.kod_importu = o.kod_importu)
       LIMIT 1`,
    )
    .get(s.id, s.selly_variant_id) as { bridge_kod: string } | undefined;
  return r?.bridge_kod ?? null;
}

/** Opis usunięcia — jedno zdanie z kodem, nazwą, identyfikatorami Selly i EAN-em (szukane w widoku Historia). */
function opisUsuniecia(w: WpisUsuniecia): string {
  const co =
    w.akcja === "usunieto_wariant"
      ? "usunięto wariant"
      : w.akcja === "usunieto_produkt"
        ? "usunięto produkt"
        : "już nie istniał, usunięto mapowanie";
  return (
    `Selly: ${co} — ${w.nazwa ?? w.kod} [${w.kod}]` +
    ` (produkt ${w.selly_product_id}${w.selly_variant_id != null ? `, wariant ${w.selly_variant_id}` : ""}` +
    `${w.ean ? `, EAN ${w.ean}` : ""}, ${w.dostawca}, kod importu ${w.kod_importu})`
  );
}

/**
 * Wpis w widoku „Historia” (`audit_log`, akcja `selly_usuniecie`): `encja_id` = kod produktu Bridge, `kiedy` =
 * godzina usunięcia (ISO, UTC), `szczegoly.zmiany` = opis z nazwą i identyfikatorami.
 */
function zapiszHistorie(db: Baza, w: WpisUsuniecia): void {
  zapiszAudyt(db, {
    uzytkownikId: null,
    uzytkownikImie: "System (Selly)",
    akcja: AKCJA_USUNIECIA_Z_SELLY,
    encjaTyp: "produkt",
    encjaId: w.kod,
    szczegoly: {
      dostawca: w.dostawca,
      zmiany: [opisUsuniecia(w)],
      nazwa: w.nazwa,
      ean: w.ean,
      kod_importu: w.kod_importu,
      selly_product_id: w.selly_product_id,
      selly_variant_id: w.selly_variant_id,
      akcja: w.akcja,
      czas: w.czas,
    },
  });
}

function otworzLog(db: Baza): number {
  const info = db.$client
    .prepare(
      `INSERT INTO selly_sync_log (operacja, dostawca_kod, liczba_ok, liczba_blad, liczba_skip, rozpoczeto, status)
       VALUES ('sync_delete', 'ALL', 0, 0, 0, datetime('now'), 'w_trakcie')`,
    )
    .run();
  return Number(info.lastInsertRowid);
}

function zamknijLog(db: Baza, id: number, w: WynikUsuwania, status: string): void {
  // `szczegoly_json` jest ucinany do 8000 znaków przez resztę kodu — trzymamy listę zwięzłą i obcinamy ją
  // po WPISACH, nie po znakach (ucięty JSON byłby nieczytelny w panelu).
  const lista = [...w.wpisy];
  let json = JSON.stringify({ ...w, wpisy: lista });
  while (json.length > 8000 && lista.length > 0) {
    lista.pop();
    json = JSON.stringify({ ...w, wpisy: lista, ucieto_wpisow: w.wpisy.length - lista.length });
  }
  db.$client
    .prepare(
      `UPDATE selly_sync_log SET liczba_ok = ?, liczba_blad = ?, liczba_skip = ?, szczegoly_json = ?,
         zakonczono = datetime('now'), status = ? WHERE id = ?`,
    )
    .run(
      w.usuniete_warianty + w.usuniete_produkty + w.juz_nie_istnialo,
      w.bledy,
      w.pominiete,
      json,
      status,
      id,
    );
}

/** Wstrzymanie zapisujemy najwyżej raz na `WSTRZYMANIE_CISZA_GODZIN` — przebieg leci co 15 minut. */
function czyJuzZapisanoWstrzymanie(db: Baza): boolean {
  const r = db.$client
    .prepare(
      `SELECT 1 FROM selly_sync_log
       WHERE operacja = 'sync_delete' AND status = 'wstrzymano'
         AND rozpoczeto > datetime('now', ?) LIMIT 1`,
    )
    .get(`-${WSTRZYMANIE_CISZA_GODZIN} hours`);
  return !!r;
}

async function usunJedna(db: Baza, discovery: Discovery, s: Sierota): Promise<WpisUsuniecia> {
  const znane = znaneDane(db, s.bridge_kod);
  const wpis: WpisUsuniecia = {
    kod: s.bridge_kod,
    dostawca: s.dostawca,
    kod_importu: s.kod_importu,
    nazwa: znane.nazwa,
    ean: znane.ean,
    selly_product_id: s.selly_product_id,
    selly_variant_id: s.selly_variant_id,
    akcja: "pominieto",
    czas: teraz(),
  };
  const sqlite = db.$client;
  const usunMapowanie = (): void => {
    sqlite.prepare("DELETE FROM selly_products WHERE id = ?").run(s.id);
  };

  const zywy = wariantUzywanyPrzezZywe(db, s);
  if (zywy) return { ...wpis, powod: `wariant współdzielony z żywym mapowaniem ${zywy}` };

  // 1. Odczyt produktu w Selly — 404 = już go nie ma, zostaje tylko posprzątać mapowanie.
  let produkt: ProduktSzczegolySelly | null;
  try {
    const odpowiedz = await discovery.apiWithRetry(`GET /api/products/${s.selly_product_id}`, () =>
      discovery.klient.getProduct(s.selly_product_id),
    );
    produkt = (odpowiedz?.data ?? odpowiedz) as ProduktSzczegolySelly | null;
  } catch (e) {
    if (status404(e)) {
      wpis.czas = teraz();
      usunMapowanie();
      return { ...wpis, akcja: "juz_nie_istnial" };
    }
    throw e;
  }
  if (!produkt || produkt.product_id !== s.selly_product_id) {
    return { ...wpis, akcja: "pominieto", powod: "niepełny odczyt produktu w Selly — nic nie usuwam" };
  }
  wpis.nazwa = produkt.name ?? wpis.nazwa;
  wpis.ean = produkt.ean ?? wpis.ean;

  // 2. Tożsamość: jeśli znamy EAN z historii, a Selly ma inny — to nie ten produkt.
  if (znane.ean && produkt.ean && znane.ean !== produkt.ean) {
    return { ...wpis, powod: `EAN w Selly (${produkt.ean}) różni się od znanego (${znane.ean})` };
  }

  // 3. Warianty produktu.
  let warianty: WariantSelly[] | undefined = produkt.variants;
  if (!Array.isArray(warianty)) {
    const lista = await discovery.apiWithRetry(`GET /api/products/${s.selly_product_id}/variants`, () =>
      discovery.klient.listVariants(s.selly_product_id),
    );
    warianty = lista?.data;
  }
  if (!Array.isArray(warianty)) return { ...wpis, powod: "brak odczytu wariantów w Selly — nic nie usuwam" };

  const inneMapowania = (
    sqlite
      .prepare("SELECT COUNT(*) c FROM selly_products WHERE selly_product_id = ? AND id != ?")
      .get(s.selly_product_id, s.id) as { c: number }
  ).c;

  if (s.selly_variant_id != null) {
    const wariant = warianty.find((v) => v.variant_id === s.selly_variant_id);
    if (!wariant) {
      // Mapowanie wskazuje wariant, którego w Selly już nie ma — nic do usunięcia.
      wpis.czas = teraz();
      usunMapowanie();
      return { ...wpis, akcja: "juz_nie_istnial", powod: "wariantu nie ma już w Selly" };
    }
    if (wariant.product_id != null && wariant.product_id !== s.selly_product_id) {
      return { ...wpis, powod: "wariant nie należy do tego produktu" };
    }
    const magazyn = wariant.features?.find((f) => f.name === "Magazyny")?.value;
    if (magazyn !== s.dostawca) {
      return { ...wpis, powod: `wariant ma inny magazyn (${String(magazyn ?? "brak")}) niż dostawca ${s.dostawca}` };
    }
  }

  const innePozostaja = warianty.filter((v) => v.variant_id !== s.selly_variant_id).length > 0 || inneMapowania > 0;

  try {
    if (s.selly_variant_id != null && innePozostaja) {
      wpis.czas = teraz();
      await discovery.apiWithRetry(`DELETE /api/products/${s.selly_product_id}/variants/${s.selly_variant_id}`, () =>
        discovery.klient.deleteVariant(s.selly_product_id, s.selly_variant_id as number),
      );
      wpis.akcja = "usunieto_wariant";
    } else if (inneMapowania === 0) {
      wpis.czas = teraz();
      await discovery.apiWithRetry(`DELETE /api/products/${s.selly_product_id}`, () =>
        discovery.klient.deleteProduct(s.selly_product_id),
      );
      wpis.akcja = "usunieto_produkt";
    } else {
      return { ...wpis, powod: "produkt ma inne mapowania Bridge, a ten wiersz nie ma wariantu" };
    }
  } catch (e) {
    if (!status404(e)) throw e;
    wpis.akcja = "juz_nie_istnial";
  }
  usunMapowanie();
  return wpis;
}

/**
 * Jeden przebieg Toru 3. `tryb` ≠ `pelny` → nic nie robi (także nie zapisuje do dziennika): blokada
 * środowiska zablokowałaby `DELETE` i każdy wiersz kończyłby się błędem.
 */
export async function usunSierotyZSelly(
  db: Baza,
  discovery: Discovery,
  opcje: { tryb: TrybSelly; limit?: number } = { tryb: "pelny" },
): Promise<WynikUsuwania | null> {
  if (opcje.tryb !== "pelny") return null;
  const limit = opcje.limit ?? LIMIT_NA_PRZEBIEG;
  const { sieroty, wszystkie } = znajdzSieroty(db, limit);
  if (wszystkie === 0) return null; // cichy przebieg: nic do zrobienia — żadnego wpisu w dzienniku

  const sqlite = db.$client;
  const produktow = (sqlite.prepare("SELECT COUNT(*) c FROM products").get() as { c: number }).c;
  const mapowan = (sqlite.prepare("SELECT COUNT(*) c FROM selly_products").get() as { c: number }).c;

  const wynik: WynikUsuwania = {
    sieroty: wszystkie,
    usuniete_warianty: 0,
    usuniete_produkty: 0,
    juz_nie_istnialo: 0,
    pominiete: 0,
    bledy: 0,
    wpisy: [],
  };

  const podejrzane =
    produktow === 0
      ? "katalog Bridge jest pusty"
      : mapowan > 0 && wszystkie / mapowan > MAKS_UDZIAL_SIEROT
        ? `sierot jest ${wszystkie} z ${mapowan} mapowań (>${Math.round(MAKS_UDZIAL_SIEROT * 100)}%)`
        : null;
  if (podejrzane) {
    if (czyJuzZapisanoWstrzymanie(db)) return null;
    wynik.wstrzymano = `Wstrzymano usuwanie z Selly: ${podejrzane} — wygląda na wyczyszczenie katalogu lub awarię importu, nic nie usunięto`;
    const logId = otworzLog(db);
    wynik.logId = logId;
    zamknijLog(db, logId, wynik, "wstrzymano");
    console.warn(`[Selly Tor3] ${wynik.wstrzymano}`);
    return wynik;
  }

  const logId = otworzLog(db);
  wynik.logId = logId;
  for (const s of sieroty) {
    let wpis: WpisUsuniecia;
    try {
      wpis = await usunJedna(db, discovery, s);
    } catch (e) {
      wpis = {
        kod: s.bridge_kod,
        dostawca: s.dostawca,
        kod_importu: s.kod_importu,
        nazwa: null,
        ean: null,
        selly_product_id: s.selly_product_id,
        selly_variant_id: s.selly_variant_id,
        akcja: "blad",
        czas: teraz(),
        powod: komunikat(e).slice(0, 200),
      };
    }
    wynik.wpisy.push(wpis);
    if (wpis.akcja === "usunieto_wariant") wynik.usuniete_warianty++;
    else if (wpis.akcja === "usunieto_produkt") wynik.usuniete_produkty++;
    else if (wpis.akcja === "juz_nie_istnial") wynik.juz_nie_istnialo++;
    else if (wpis.akcja === "blad") wynik.bledy++;
    else wynik.pominiete++;
    if (wpis.akcja === "usunieto_wariant" || wpis.akcja === "usunieto_produkt" || wpis.akcja === "juz_nie_istnial") {
      zapiszHistorie(db, wpis);
    }
  }

  const status = wynik.bledy > 0 && wynik.usuniete_warianty + wynik.usuniete_produkty + wynik.juz_nie_istnialo === 0 ? "blad" : "zakonczono";
  zamknijLog(db, logId, wynik, status);
  console.log(
    `[Selly Tor3] sieroty=${wszystkie}, usunięte: warianty=${wynik.usuniete_warianty}, produkty=${wynik.usuniete_produkty}, ` +
      `już nie istniało=${wynik.juz_nie_istnialo}, pominięte=${wynik.pominiete}, błędy=${wynik.bledy}`,
  );
  return wynik;
}
