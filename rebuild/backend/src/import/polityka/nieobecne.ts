// Decyzje o nieobecnych kartach (backlog #106) — `staging_policy.cjs:251-331`.
//
// Problem, który to rozwiązuje: stara karta produktu przestała się pojawiać w ofercie
// dostawcy, a w ofercie jest pozycja, która WYGLĄDA na tę samą oponę. Automat nie ma prawa
// tego scalić — może to być inna partia (DOT) albo inny produkt o zbliżonych cechach.
// Sprawa idzie więc do człowieka i kończy się jedną z dwóch decyzji, obie zapisywane
// w `staging_absence_decisions`, żeby nie wróciła przy następnym imporcie.
//
// ⭐ CO OTWIERA SPRAWĘ PONOWNIE: `candidates_hash` liczony z `[kod, ean, dot]` KAŻDEGO
// kandydata (posortowanych). Zmiana kodu, EAN-u albo DOT-u któregokolwiek kandydata zmienia
// hash — i sprawa wraca. Cokolwiek innego (cena, stan, nazwa) jej nie wskrzesza.

import type { Baza } from "../../db/index.js";
import { aktualizujProdukt, type ProduktWewnetrzny } from "../../repos/products.js";
import {
  usunAutomatyczneWstrzymanie,
  zamknijSpraweNieobecnej,
  zapiszDopasowanieStagingu,
  zapiszWyborBiezacejKarty,
  zapiszWyborKartyZrodlowej,
} from "../../repos/staging-polityka.js";
import { uchwytSqlite } from "../silnik/bridge-ext.js";
import { hash, KEYS, norm, odmow, version } from "./helpery.js";
import {
  pozycjaStagingu,
  produktPoKodzie,
  usunZgloszeniaPary,
  wstrzymajAutomatycznie,
  type Snapshot,
} from "./kontekst.js";

type Kandydat = Record<string, unknown>;

/**
 * `candidates_hash` — `staging_policy.cjs:260`, `:307`, `:321` (identycznie w trzech miejscach).
 *
 * ⚠ `.sort()` BEZ KOMPARATORA, na tablicy tablic — JavaScript porównuje wtedy reprezentacje
 * tekstowe elementów. Odtworzone dosłownie, bo od kolejności zależy wartość hasha,
 * a od niej to, czy zamknięta sprawa wróci.
 */
function hashKandydatow(snap: Snapshot): string {
  const kandydaci = (snap._candidates ?? []) as Kandydat[];
  return hash(kandydaci.map((c) => [c.kod, c.ean, c.dot]).sort());
}

/**
 * „Zostaw starą kartę wstrzymaną i zamknij sprawę" — `staging_policy.cjs:251-266`.
 *
 * Nie scala niczego. Zapisuje decyzję z ZACHOWANIEM `selected_source_code`, jeśli jakiś
 * już tam był (repo `zamknijSpraweNieobecnej` celowo go nie rusza — to jedna z trzech
 * różnic między zapisami na tej tabeli).
 */
export function zamknijPrzegladNieobecnej(db: Baza, id: number): { kod: string } {
  return uchwytSqlite(db).transaction(() => {
    const row = pozycjaStagingu(db, id);
    if (!row) odmow("Zgłoszenie zostało zastąpione. Odśwież staging.");

    const snap = JSON.parse(row.snapshotJson || "{}") as Snapshot;
    const current = produktPoKodzie(db, row.kod);

    if (!snap._absenceReview) odmow("To nie jest sprawa starej karty.");
    if (!current || current.status !== "wstrzymany" || Number(current.stan) !== 0) {
      odmow("Stan starej karty się zmienił. Odśwież staging i sprawdź ją ponownie.");
    }
    if (snap._catalogVersion !== version(current)) {
      odmow("Dane starej karty się zmieniły. Odśwież staging i sprawdź ją ponownie.");
    }

    zamknijSpraweNieobecnej(
      db,
      row.dostawca,
      row.kod,
      hashKandydatow(snap),
      new Date().toISOString(),
    );
    usunZgloszeniaPary(db, row.dostawca, row.kod);
    return { kod: row.kod };
  })();
}

/**
 * „Wybierz jedną kartę" — `staging_policy.cjs:267-330`.
 *
 * Dwie gałęzie, symetryczne co do skutku, różne co do tego, która karta zostaje w katalogu:
 *  • `selectedCode === row.kod` — STARA karta przejmuje bieżącą ofertę; kandydat zostaje
 *    wstrzymany, a `selected_source_code` zapamiętuje jego kod (indeks unikalny pilnuje,
 *    żeby ten sam kod źródłowy nie trafił do dwóch kart);
 *  • inaczej — kandydat przejmuje ofertę, STARA karta zostaje wstrzymana,
 *    a `selected_source_code` jest zerowany.
 *
 * ⚠ DOT ROZSTRZYGA. Kandydat wchodzi do gry tylko przy trójstronnej zgodności DOT: zapamiętany
 * DOT kandydata = DOT jego żywej karty = DOT starej karty. Różne DOT to różne partie i tych
 * opon nie wolno scalić — stąd komunikat o „różnym DOT" zamiast cichego połączenia.
 */
export function wybierzKarteNieobecnej(
  db: Baza,
  id: number,
  selectedCode: unknown,
  expectedCandidateVersion: unknown,
): { kod: string; dostawca: string } {
  return uchwytSqlite(db).transaction(() => {
    const row = pozycjaStagingu(db, id);
    if (!row) odmow("Zgłoszenie zostało już zmienione. Odśwież staging.");

    const snap = JSON.parse(row.snapshotJson || "{}") as Snapshot;
    const old = produktPoKodzie(db, row.kod);

    const taSamaOpona =
      !!old &&
      [...KEYS, "dot", "ean"].every(
        (k) => norm(snap[k]) === norm((old as unknown as Record<string, unknown>)[k]),
      );
    if (!snap._absenceReview || !old || !taSamaOpona) {
      odmow("Dane starej karty zmieniły się. Odśwież staging.");
    }

    const kandydaci = (snap._candidates ?? []) as Kandydat[];
    const options = kandydaci.filter((c) => {
      const p = produktPoKodzie(db, String(c.kod));
      return (
        !!p &&
        p.dostawca === row.dostawca &&
        norm(c.dot) === norm(p.dot) &&
        norm(c.dot) === norm(old.dot) &&
        norm(c.rozmiar) === norm(p.rozmiar) &&
        (!c.ean || !p.ean || norm(c.ean) === norm(p.ean))
      );
    });
    // Odpowiednik `if(!options.length)` (`:280`) — zapisane przez pierwszy element, żeby
    // TypeScript widział, że `pierwsza` jest dalej zdefiniowana (`noUncheckedIndexedAccess`).
    const pierwsza = options[0];
    if (!pierwsza) odmow("Różny DOT lub brak potwierdzonej karty. Tych opon nie można połączyć.");

    const chosen = options.find((c) => c.kod === selectedCode);
    if (selectedCode !== row.kod && !chosen) odmow("Wybierz jedną z widocznych kart.");
    if (selectedCode === row.kod && options.length !== 1) {
      odmow("Wybierz dokładnie jedną pozycję bieżącej oferty, aby przypisać ją starej karcie.");
    }

    const feed = chosen ?? pierwsza;
    const candidate = produktPoKodzie(db, String(feed.kod)) as ProduktWewnetrzny;

    if (!expectedCandidateVersion || expectedCandidateVersion !== version(candidate)) {
      odmow("Karta z bieżącej oferty została zmieniona. Odśwież cennik.");
    }

    // „Świeży odczyt oferty" to pozycja z `sourceKey` oraz stanem i ceną z pliku. Gdy jej
    // nie ma, zastępczo bierzemy aktywną kartę kandydata (`:303-305`).
    const liveOffer =
      feed.sourceKey && feed.stan != null && feed.cenaZakupu != null
        ? feed
        : candidate.status === "aktywny"
          ? (candidate as unknown as Kandydat)
          : null;
    const inStock = Number(liveOffer?.stan);
    const price = Number(liveOffer?.cenaZakupu);
    const hasFreshPriceAndStock =
      !!feed.sourceKey &&
      feed.stan != null &&
      feed.cenaZakupu != null &&
      Number.isFinite(Number(feed.stan)) &&
      Number.isFinite(Number(feed.cenaZakupu));

    const teraz = new Date().toISOString();

    if (selectedCode === row.kod) {
      if (!liveOffer || !Number.isFinite(inStock) || !Number.isFinite(price)) {
        odmow(
          "Potrzebny świeży odczyt tej oferty przed przeniesieniem jej na starą kartę. Wczytaj cennik ponownie.",
        );
      }
      if (candidate.kod === old.kod) odmow("Obie pozycje wskazują tę samą kartę.");

      const patch: Record<string, unknown> = {
        stan: inStock > 0 && price > 0 ? inStock : 0,
        cenaZakupu: price,
        status: inStock > 0 && price > 0 ? "aktywny" : "wstrzymany",
        dataAktualizacji: teraz,
      };
      if (Number.isFinite(Number(liveOffer.cenaSprzedazy)) && Number(liveOffer.cenaSprzedazy) > 0) {
        patch.cenaSprzedazy = Number(liveOffer.cenaSprzedazy);
      }
      // `originalUpdate` w oryginale (`:313`) — czyli wersja SPRZED nadpisania `U.updateProduct`.
      // Znacznik automatycznego wstrzymania zdejmuje osobny `DELETE` w następnej linii, tak
      // samo jak tam; łączenie tych dwóch kroków zgubiłoby kolejność.
      aktualizujProdukt(db, old.id, patch);
      usunAutomatyczneWstrzymanie(db, row.dostawca, old.kod);
      wstrzymajAutomatycznie(db, candidate, teraz, null, "Wybrano inną kartę dla bieżącej oferty");

      if (feed.sourceKey) {
        zapiszDopasowanieStagingu(db, row.dostawca, String(feed.sourceKey), old.kod, teraz);
      }
      zapiszWyborKartyZrodlowej(
        db,
        row.dostawca,
        old.kod,
        hashKandydatow(snap),
        teraz,
        candidate.kod,
      );
    } else {
      // Kandydat wraca do oferty tylko wtedy, gdy jest czym go ożywić — inaczej zostałby
      // aktywny z ceną 0 (`:325-329`).
      if (candidate.status === "wstrzymany") {
        if (!hasFreshPriceAndStock) {
          odmow("Nie ma aktualnego stanu i ceny tej karty. Wczytaj cennik ponownie.");
        }
        aktualizujProdukt(db, candidate.id, {
          stan: inStock > 0 && price > 0 ? inStock : 0,
          cenaZakupu: price,
          status: inStock > 0 && price > 0 ? "aktywny" : "wstrzymany",
          dataAktualizacji: teraz,
        });
        usunAutomatyczneWstrzymanie(db, row.dostawca, candidate.kod);
      }
      wstrzymajAutomatycznie(db, old, teraz, null, "Wybrano kartę z bieżącej oferty");
      zapiszWyborBiezacejKarty(db, row.dostawca, old.kod, hashKandydatow(snap), teraz);
    }

    usunZgloszeniaPary(db, row.dostawca, row.kod);
    return { kod: String(selectedCode), dostawca: row.dostawca };
  })();
}
