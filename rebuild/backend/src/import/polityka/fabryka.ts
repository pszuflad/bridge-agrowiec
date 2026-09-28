// Rdzeń importu — port `importer()` zwracanego przez `staging_policy.install()`
// (`88fa31c`, `mirror/backend/staging_policy.cjs:332-616`). Karta I15.4b.
//
// ⭐ CO TO ZASTĘPUJE. W `mirror/backend/index.cjs` @ `88fa31c` silnik `tk` NIE jest już
// funkcją bundla — jest wprost wynikiem instalacji tej polityki:
//
//   tk = require("./staging_policy.cjs").install({U, db:Qi, normalize:Hq, classify:Zc,
//                                                 badName:Kq, ext:__BRIDGE_EXT});
//
// Stary `tk()` (`deminified/backend-index.cjs:47584`) jest w produkcji MARTWY. Nasz dawny
// port w `tk.ts` odtwarzał więc silnik, którego produkcja już nie używa.
//
// ⭐ DLACZEGO FABRYKA, A NIE ZBIÓR FUNKCJI. Oryginalne `install()` to jedno domknięcie, w
// którym `importer()` dzieli stan z funkcjami akceptacji (`acceptStaging`, `resolveStaging`,
// `closeAbsenceReview`, `chooseAbsenceCard` — karta I15.4c). Wspólne są `suspend()`,
// `odswiezDostepnosc()`, `wyczyscZgloszenie`, `dopasowanieZapamietane`, `kartaPoKodzie`
// i flaga `dostepnoscZmieniona`. Rozcięcie tego na luźne funkcje zgubiłoby współdzielony
// stan, dlatego fabryka odtwarza domknięcie, a helpery wystawia jawnie — I15.4c ma je
// wołać BEZ zmian w tym pliku (decyzja użytkownika D-130.2).
//
// ⭐ `U.updateProduct` KONTRA `originalUpdate`. Oryginał nadpisuje `U.updateProduct` tak, żeby
// jawna zmiana `status` kasowała wpis z `product_auto_suspensions` (`:112-119`) — to jest
// cały mechanizm „ręczne wstrzymania chronione". Wewnątrz `importer()` ma to jednak ZERO
// znaczenia: sprawdzone miejsce po miejscu, każde wywołanie `U.updateProduct` w importerze
// podaje patch BEZ klucza `status` (`:494`, `:533`, `:543`, `:613`), a tam, gdzie status
// faktycznie się zmienia (`suspend()` i auto-powrót), oryginał celowo woła `originalUpdate`,
// żeby obejść nadpisanie. Dlatego importer w całości używa zwykłego `aktualizujProdukt()`,
// a nadpisanie żyje w `repos/products.ts` i dotyczy `PATCH /api/products/:id` (D-130.3).

import type { Baza } from "../../db/index.js";
import {
  aktualizujProdukt,
  katalogDoImportu,
  type ProduktWewnetrzny,
} from "../../repos/products.js";
import {
  listaStagingu,
  zapiszPozycjeStagingu,
  type NowaPozycjaStagingu,
  type PozycjaStagingu,
} from "../../repos/staging.js";
import { zapiszHistorieCen } from "../../repos/historia.js";
import {
  czyAutomatycznieWstrzymany,
  czyZnanaWersjaOferty,
  decyzjaONieobecnej,
  dopasowanieStagingu,
  dowodyNieobecnosci,
  kodProduktuDlaWybranegoZrodla,
  stanOfertyDostawcy,
  usunAutomatyczneWstrzymanie,
  usunDecyzjeONieobecnej,
  usunDowodyNieobecnosci,
  zapiszDowodyNieobecnosci,
  zapiszStanOfertyDostawcy,
  zapiszWersjeOferty,
} from "../../repos/staging-polityka.js";
import { czyOpona } from "../silnik/klasyfikator.js";
import { applyDims, applyLinkMemory, applyNazwaPamiec, uchwytSqlite } from "../silnik/bridge-ext.js";
import {
  bladZapisuNazwy,
  znormalizujPozycje,
  type PozycjaZnormalizowana,
} from "../silnik/pozycja.js";
import type { MetaCennika, RekordSurowy } from "../typy.js";
import {
  BladOdczytuCennikaBlad,
  CennikMasowoNierozpoznanyBlad,
  CennikPodejrzanieMalyBlad,
  PustyImportBlad,
} from "./bledy.js";
// Prymitywy WSPÓLNE z kartą I15.4c — jedna definicja w repo (`helpery.ts`, ticket 129).
import {
  compatibility,
  hash,
  identity,
  KEYS,
  norm,
  rawEan,
  syntheticCode,
  validateEan,
  version,
} from "./helpery.js";
// Prymitywy używane wyłącznie przez importer — oryginał ich nie eksportuje.
import { codeKey, LABEL, separateDotBatch, sourceKey } from "./podstawy.js";
// Wspólne operacje domknięcia `install()` — też z I15.4c. `suspend()` i `protect()` mają
// w repo JEDNĄ implementację; importer dokłada do nich wyłącznie flagę dostępności.
import {
  chron,
  produktPoKodzie,
  usunZgloszeniaPary,
  wstrzymajAutomatycznie,
} from "./kontekst.js";

/** Luźny worek na pozycję w trakcie obróbki — odpowiednik `d` z oryginału. */
type Pozycja = Record<string, unknown>;

/** Statystyki przebiegu — obiekt `stats` (`staging_policy.cjs:346`). */
export type StatystykiImportu = {
  doStagingu: number;
  odrzuconeNieOpony: number;
  odrzuconeBrakDanych: number;
  odrzuconeSmieciMO2: number;
  nowe: number;
  zmienione: number;
  wycofane: number;
  bezZmian: number;
  autoZatwierdzone: number;
  szczegolyOdrzuconych: { nazwa: string; powod: string }[];
  /** Wyjaśnienie, dlaczego braków nie zliczono w tym przebiegu (`:528-529`). */
  pominieteWycofania?: string;
};

export function pusteStatystyki(): StatystykiImportu {
  return {
    doStagingu: 0,
    odrzuconeNieOpony: 0,
    odrzuconeBrakDanych: 0,
    odrzuconeSmieciMO2: 0,
    nowe: 0,
    zmienione: 0,
    wycofane: 0,
    bezZmian: 0,
    autoZatwierdzone: 0,
    szczegolyOdrzuconych: [],
  };
}

/** Opcje przebiegu — obiekt `options` (`staging_policy.cjs:332`). */
export type OpcjeImportu = {
  /** Metadane źródła z `feed_safety` (#103). Brak = oferta traktowana jako niekompletna. */
  meta?: MetaCennika;
  /** Twarde zaprzeczenie kompletności, niezależnie od `meta.complete`. */
  feedComplete?: boolean;
  /** Przebieg kontrolny: liczy i melduje, ale nie zmienia katalogu (`:494`, `:516`, `:558`). */
  reconcileOnly?: boolean;
  /** Pozwala przebiegowi kontrolnemu mimo to potwierdzić nieobecności (`:466`). */
  verifyAbsence?: boolean;
  /** Liczba błędów parsera podana z zewnątrz — blokuje kompletność (`:464`). */
  parserErrors?: number;
};

/**
 * Punkt wpięcia „zmiana dostępności" — `refreshAvailability()` (`staging_policy.cjs:131-135`).
 *
 * ⚠ W oryginale funkcja jest NO-OPEM poza produkcją: wychodzi natychmiast, jeśli
 * `path.resolve(db.name) !== '/home/admin/private_apps/bridge/data.db'`. Kopie testowe nigdy
 * nie wołają sklepu ani nie publikują produkcyjnego CSV. Nasz domyślny no-op odtwarza
 * dokładnie to zachowanie; różnica jest wyłącznie w sposobie wstrzyknięcia.
 *
 * Realną implementację dowiozła karta I15.10 (ticket 119):
 * `src/selly/dostepnosc.ts` → `zadajOdswiezenie(dostawca)`. Leży jeszcze na niezmergowanej
 * gałęzi `feature/119-selly-dostepnosc-zawor`, więc wpięcie to osobne zadanie domykające
 * (decyzja D-130.5, opisane w „Do koordynatora" karty I15.4b).
 */
export type ZaleznosciPolityki = {
  odswiezDostepnosc?: (dostawca: string) => void;
};

/** Co fabryka oddaje na zewnątrz. Helpery są API międzykartowym dla I15.4c. */
export type PolitykaStagingu = {
  importer: (
    dostawca: string,
    wejscie: RekordSurowy[],
    opcje?: OpcjeImportu,
  ) => StatystykiImportu;
  /** `suspend()` (`:120-130`) — wstrzymanie automatyczne ze znacznikiem pochodzenia. */
  wstrzymaj: (
    produkt: ProduktWewnetrzny,
    czas: string,
    odcisk: string,
    powod: string,
  ) => void;
  /** `clear` (`:136`) — skasowanie zgłoszenia stagingu dla pary dostawca + kod. */
  wyczyscZgloszenie: (dostawca: string, kod: string) => void;
  /** `aliases` (`:137`) — świadome dopasowanie zapamiętane dla klucza źródłowego. */
  dopasowanieZapamietane: (dostawca: string, kluczZrodlowy: string) => string | undefined;
  /** `find` (`:138`) — karta katalogowa po kodzie, czytana świeżo z bazy. */
  kartaPoKodzie: (kod: string) => ProduktWewnetrzny | undefined;
  /** `protect()` (`:158-162`) — nałożenie poprawek Marty na pozycję. */
  nalozPoprawki: (dostawca: string, pozycja: Pozycja, kod: string) => Pozycja;
  /** Odczyt i zerowanie flagi `availabilityChanged` — dla wspólnego użycia z I15.4c. */
  dostepnoscZmieniona: () => boolean;
  oznaczZmianeDostepnosci: () => void;
  odswiezDostepnosc: (dostawca: string) => void;
};

const DOBA_MS = 24 * 3600 * 1000;

/**
 * Buduje politykę stagingu dla danej bazy — odpowiednik `install()`.
 *
 * `zaleznosci.odswiezDostepnosc` jest szwem na moduł dostępności z I15.10 (D-130.5).
 */
export function stworzPolitykeStagingu(
  db: Baza,
  zaleznosci: ZaleznosciPolityki = {},
): PolitykaStagingu {
  const sqlite = uchwytSqlite(db);
  const odswiezDostepnosc = zaleznosci.odswiezDostepnosc ?? (() => {});
  let dostepnoscZmieniona = false;

  /**
   * `find = code => U.getProductByKod(code)` (`staging_policy.cjs:134`).
   *
   * ⚠ Czyta ŚWIEŻO z bazy, nie z listy `produkty` zebranej na wejściu — `version(find(kod))`
   * ma opisywać kartę po zmianach naniesionych w tej samej transakcji.
   */
  const kartaPoKodzie = (kod: string): ProduktWewnetrzny | undefined =>
    produktPoKodzie(db, kod);

  /** `clear` (`staging_policy.cjs:132`) — wspólne z akceptacją, patrz `kontekst.ts`. */
  const wyczyscZgloszenie = (dostawca: string, kod: string): void =>
    usunZgloszeniaPary(db, dostawca, kod);

  const dopasowanieZapamietane = (dostawca: string, kluczZrodlowy: string) =>
    dopasowanieStagingu(db, dostawca, kluczZrodlowy);

  /**
   * `protect()` (`:158-162`) — poprawki Marty nakładane na pozycję. Wspólne z akceptacją.
   *
   * ⚠ RÓŻNICA WOBEC STAREGO `tk()`: ta wersja nakłada poprawki CICHO. Stary silnik
   * raportował konflikt („plik nadpisuje poprawke Marty") przez `Gq()` i zapisywał
   * `_srcConflict` do snapshotu. `staging_policy` tego nie robi — po prostu podmienia
   * wartość. Odtwarzamy wiernie; rozjazd widać we wzorcach charakteryzacji.
   */
  const nalozPoprawki = (dostawca: string, pozycja: Pozycja, kod: string): Pozycja =>
    chron(db, dostawca, pozycja, kod);

  /**
   * `suspend()` (`:120-130`) — automatyczne wstrzymanie produktu.
   *
   * Sama operacja jest WSPÓLNA z akceptacją (`wstrzymajAutomatycznie` w `kontekst.ts`) i nie
   * jest tu powielana. Importer dokłada do niej jedyną rzecz, której akceptacja nie potrzebuje:
   * podniesienie flagi `availabilityChanged` (`:127`), od której zależy, czy na końcu przebiegu
   * zawołamy punkt wpięcia dostępności.
   *
   * ⚠ Warunek flagi musi być policzony PRZED wywołaniem, bo `wstrzymajAutomatycznie` nie
   * raportuje, czy faktycznie coś zmieniła — a oryginał podnosi flagę tylko wtedy, gdy
   * `UPDATE` naprawdę poszedł.
   */
  const wstrzymaj = (
    produkt: ProduktWewnetrzny,
    czas: string,
    odcisk: string,
    powod: string,
  ): void => {
    const zmieniStan = produkt.status !== "wstrzymany" || Number(produkt.stan) !== 0;
    wstrzymajAutomatycznie(db, produkt, czas, odcisk, powod);
    if (zmieniStan) dostepnoscZmieniona = true;
  };

  function importer(
    dostawca: string,
    wejscie: RekordSurowy[],
    opcje: OpcjeImportu = {},
  ): StatystykiImportu {
    dostepnoscZmieniona = false;
    if (!Array.isArray(wejscie)) throw new Error("Nieprawidłowy cennik");

    const meta = opcje.meta;
    // Blokady źródła — `:336-337`. Kolejność jak w oryginale: najpierw błędy odczytu.
    if ((meta?.parserErrors ?? 0) > 0) throw new BladOdczytuCennikaBlad();
    if (!wejscie.length) throw new PustyImportBlad(dostawca);

    const czas = new Date().toISOString();
    const produkty = katalogDoImportu(db, dostawca);

    // ——— Mapy dopasowania (`:339-345`) ———
    const poKodzie = new Map<string, ProduktWewnetrzny>(
      produkty.map((p) => [String(p.kod), p]),
    );
    const poKodzieNorm = new Map<string, ProduktWewnetrzny | null>();
    const poKodzieDostawcy = new Map<string, ProduktWewnetrzny | null>();
    const poEanie = new Map<string, ProduktWewnetrzny[]>();

    /** `addUnique` (`:340`) — drugie trafienie w ten sam klucz UNIEWAŻNIA go (`null`). */
    const dodajUnikalny = (
      mapa: Map<string, ProduktWewnetrzny | null>,
      klucz: string,
      p: ProduktWewnetrzny,
    ): void => {
      if (!klucz) return;
      const stary = mapa.get(klucz);
      mapa.set(klucz, stary === undefined ? p : null);
    };

    for (const p of produkty) {
      dodajUnikalny(poKodzieNorm, codeKey(dostawca, p.kod), p);
      dodajUnikalny(poKodzieDostawcy, codeKey(dostawca, p.kodDostawcy), p);
    }
    for (const p of produkty) {
      const ev = validateEan(p.ean);
      if (ev.valid && ev.value) {
        if (!poEanie.has(ev.value)) poEanie.set(ev.value, []);
        poEanie.get(ev.value)!.push(p);
      }
    }

    const stats = pusteStatystyki();
    const zaobserwowane = new Set<number>();
    const przygotowane = new Map<string, PozycjaWTrakcie>();
    const staraKolejka = new Map<string, PozycjaStagingu>(
      listaStagingu(db)
        .filter((s) => s.dostawca === dostawca)
        .map((s) => [s.kod, s]),
    );

    for (const surowy of wejscie) {
      const raw = surowy as unknown as Pozycja;

      // Filtr śmieci MO2 (`:348`).
      if (
        dostawca === "MO2" &&
        /^999991$/.test(String(raw.kod ?? "").replace(/^MO2_/, "")) &&
        (!raw.ean ||
          !raw.marka ||
          (/^\d/.test(String(raw.marka)) && !/[A-Za-z]{3,}/.test(String(raw.marka))))
      ) {
        stats.odrzuconeSmieciMO2 += 1;
        continue;
      }

      const klasyfikacja = czyOpona(
        (raw.nazwa as string) || "",
        raw.kategoria as string | null,
      );
      const znanyKod =
        poKodzie.get(String(raw.kod ?? "")) ??
        produkty.find((p) => norm(p.kod) === norm(raw.kod));

      // `:352` — niepełna nazwa/rozmiar nie może zamienić znanego wiersza w „nieobecny".
      if (!klasyfikacja.isTire && !znanyKod) {
        stats.odrzuconeNieOpony += 1;
        stats.szczegolyOdrzuconych.push({
          nazwa: String(raw.nazwa ?? ""),
          powod: "nie opona (" + klasyfikacja.reason + ")",
        });
        continue;
      }

      const zrodlo: Pozycja = { ...raw };
      const ev = validateEan(rawEan(raw), Boolean(raw.ean_lossy || raw._eanLossy));
      // `:354` — normalizacja liczy WYŁĄCZNIE rozmiary i parametry; EAN idzie ścisłą ścieżką.
      let d: Pozycja = znormalizujPozycje({
        ...(surowy as unknown as PozycjaZnormalizowana),
        ean: null,
      }).poz as unknown as Pozycja;
      Object.assign(d, {
        ean: ev.value,
        eanRaw: ev.raw,
        eanIsValid: ev.valid === null ? null : Number(ev.valid),
        eanSourceStatus: ev.status,
        eanCandidates: null,
      });

      let kod = String(raw.kod ?? "");
      const klucz = sourceKey(dostawca, zrodlo);
      let biezacy: ProduktWewnetrzny | null = null;
      let problemDopasowania: string | null = null;
      let kandydaci: ProduktWewnetrzny[] = [];

      // ——— 1. Ręczny wybór operatora (`:357-367`) ———
      const wybranyRecznie = kodProduktuDlaWybranegoZrodla(db, dostawca, kod);
      if (wybranyRecznie) {
        const wskazany = poKodzie.get(wybranyRecznie);
        if (wskazany && compatibility(d, wskazany).ok && norm(d.dot) === norm(wskazany.dot)) {
          biezacy = wskazany;
          // Operator ŚWIADOMIE zostawił starą kartę. Nowy kod źródłowy opisuje jego ofertę,
          // a nie żądanie podmiany kodu i EAN-u tej karty.
          d.kodDostawcy = wskazany.kodDostawcy;
          d.ean = wskazany.ean;
        }
      }

      // ——— 2. Zapamiętane świadome dopasowanie (`:368-369`) ———
      const zapamietane = dopasowanieZapamietane(dostawca, klucz);
      if (!biezacy && zapamietane) biezacy = poKodzie.get(zapamietane) ?? null;

      const syntetyczny =
        Boolean(raw._kodSynthetic) ||
        !kod ||
        kod.includes("_AUTO_") ||
        Boolean(ev.value && kod.replace(new RegExp("^" + dostawca + "_"), "") === ev.value);

      // ——— 3. Dokładny kod, z ochroną DOT (`:371-379`) ———
      if (!biezacy && kod && !syntetyczny) {
        biezacy = poKodzie.get(kod) ?? null;
        if (biezacy && norm(d.dot) !== norm(biezacy.dot)) biezacy = null;
        const kanoniczny = poKodzieNorm.get(codeKey(dostawca, kod));
        // Zmiana samej wielkości liter w tej samej przestrzeni nazw jest stabilna.
        // Stare nieprefiksowane identyfikatory CSV (zwłaszcza MO9) NIE są identyfikatorami API.
        if (
          !biezacy &&
          kanoniczny &&
          norm(kanoniczny.kod) === norm(kod) &&
          norm(d.dot) === norm(kanoniczny.dot)
        ) {
          biezacy = kanoniczny;
        }
        if (!biezacy && kanoniczny && compatibility(d, kanoniczny).ok) biezacy = kanoniczny;
      }

      // ——— 4. Jednoznaczny kod dostawcy (`:380-384`) ———
      if (!biezacy && d.kodDostawcy) {
        const p = poKodzieDostawcy.get(codeKey(dostawca, d.kodDostawcy));
        if (p && compatibility(d, p).ok && (!ev.valid || p.ean === ev.value)) {
          biezacy = p;
        } else if (p && !separateDotBatch(d, p)) {
          kandydaci = [p];
          problemDopasowania =
            "Kod dostawcy wskazuje starą kartę, ale cechy są inne lub niepełne. Sprawdź dopasowanie.";
        }
      }

      // ——— 5. Kod syntetyczny wskazujący istniejącą kartę (`:385-387`) ———
      if (!biezacy && syntetyczny && kod && poKodzie.has(kod)) {
        const p = poKodzie.get(kod)!;
        if (compatibility(d, p).ok) biezacy = p;
      }

      // ——— 6. EAN — WYŁĄCZNIE gdy jedna zgodna opona (`:388-395`) ———
      if (!biezacy && ev.valid && ev.value) {
        kandydaci = poEanie.get(ev.value) ?? [];
        const zgodni = kandydaci.filter((p) => compatibility(d, p).ok);
        if (
          zgodni.length === 1 &&
          !wejscie.some(
            (r) => (r as unknown as Pozycja) !== raw && norm(r.kod) === norm(zgodni[0]!.kod),
          )
        ) {
          biezacy = zgodni[0]!;
        } else if (kandydaci.length && !kandydaci.every((p) => separateDotBatch(d, p))) {
          problemDopasowania =
            zgodni.length > 1
              ? "Kilka zgodnych produktów z tym EAN. Wybierz właściwą oponę."
              : "Ten EAN występuje w katalogu, ale cechy są inne lub niepełne. Sprawdź dopasowanie.";
        }
      }

      // ——— 7. Zgodne cechy pod innym kodem — NIE auto-dopasowuje (`:396-402`) ———
      if (!biezacy && !problemDopasowania) {
        const zgodniPoCechach = produkty.filter((p) => compatibility(d, p).ok);
        if (zgodniPoCechach.length) {
          kandydaci = zgodniPoCechach;
          problemDopasowania =
            "Podobna opona jest już w katalogu, ale ma inny kod lub EAN. Sprawdź dopasowanie.";
        }
      }

      if (!biezacy && !kod) kod = syntheticCode(dostawca, d);
      if (!biezacy && poKodzie.has(kod)) {
        const istniejacy = poKodzie.get(kod)!;
        kandydaci = [istniejacy];
        kod = syntheticCode(dostawca, d);
        if (!separateDotBatch(d, istniejacy)) {
          problemDopasowania = "Oznaczenie wskazuje inną oponę. Sprawdź dopasowanie.";
        }
      }

      if (biezacy) {
        kod = biezacy.kod;
        zaobserwowane.add(biezacy.id);
        // Nazwy świadomie ujednolicone przez użytkownika mają tę samą ochronę co pojedyncze
        // poprawki ręczne — ale dopiero PO bezpiecznym dopasowaniu produktu.
        d.kodImportu = biezacy.kodImportu;
        applyNazwaPamiec(sqlite, d);
        d = nalozPoprawki(dostawca, d, kod);
      }

      // Kandydat w trakcie przeglądu NIE może zostać uznany za wycofany (`:417`).
      if (problemDopasowania) for (const p of kandydaci) zaobserwowane.add(p.id);

      d.kod = kod;
      if (!d.ean && biezacy?.ean) d.ean = biezacy.ean;

      const bledy: string[] = [];
      if (ev.error) {
        bledy.push(`Błędny EAN „${ev.raw}”: ${ev.error}. Numer nie zostanie zapisany.`);
      }
      const bladNazwy = bladZapisuNazwy((d.nazwa as string) || "");
      if (bladNazwy) bledy.push("Błędny zapis nazwy: " + bladNazwy);
      if (!d.rozmiar) bledy.push("Nie wykryto rozmiaru opony.");
      if (!raw.kod && !ev.valid) bledy.push("Brak kodu dostawcy i poprawnego EAN.");
      if (problemDopasowania) bledy.push(problemDopasowania);

      const zmiany = biezacy
        ? KEYS.filter(
            (k) => norm((biezacy as unknown as Pozycja)[k]) !== norm(d[k]),
          ).map(
            (k) =>
              `${LABEL[k]}: ${(biezacy as unknown as Pozycja)[k] ?? "brak"} → ${d[k] ?? "brak"}`,
          )
        : [];

      Object.assign(d, {
        _policyVersion: 2,
        _sourceKey: klucz,
        _catalogVersion: version(biezacy as unknown as Pozycja | null),
        _eanIssue: ev.error,
        _matchIssue: problemDopasowania,
        _candidates: kandydaci.map((p) => ({
          kod: p.kod,
          nazwa: p.nazwa,
          marka: p.marka,
          model: p.model,
          rozmiar: p.rozmiar,
          dot: p.dot,
          ean: p.ean,
        })),
      });

      const pozycja: PozycjaWTrakcie = { kod, biezacy, d, bledy, zmiany, zrodlo };

      // ——— Sprzeczne pozycje wskazujące tę samą oponę (`:430-441`) ———
      const poprzednia = przygotowane.get(kod);
      if (
        poprzednia &&
        (poprzednia.d._duplicateSource ||
          hash([
            identity(poprzednia.d),
            poprzednia.d.ean,
            poprzednia.d.cenaZakupu,
            poprzednia.d.stan,
          ]) !== hash([identity(d), d.ean, d.cenaZakupu, d.stan]))
      ) {
        pozycja.bledy.push(
          "Kilka różnych pozycji dostawcy wskazuje tę samą oponę. Wymaga sprawdzenia pliku.",
        );
        d._matchIssue = "Sprzeczne pozycje w jednym cenniku";
        d._duplicateSource = true;
        const pola: [string, string][] = [
          ["kod dostawcy", "kodDostawcy"],
          ["marka", "marka"],
          ["model", "model"],
          ["rozmiar", "rozmiar"],
          ["DOT", "dot"],
          ["EAN", "ean"],
          ["cena zakupu", "cenaZakupu"],
          ["stan", "stan"],
        ];
        const wczesniejsza = poprzednia.d._sourceConflict as
          | { earlier?: Record<string, unknown> }
          | undefined;
        d._sourceConflict = {
          earlier:
            wczesniejsza?.earlier ?? {
              kod: poprzednia.zrodlo.kod,
              ...Object.fromEntries(pola.map(([label, key]) => [label, poprzednia.d[key] ?? null])),
            },
          later: {
            kod: zrodlo.kod,
            ...Object.fromEntries(pola.map(([label, key]) => [label, d[key] ?? null])),
          },
          different: pola
            .filter(([, key]) => norm(poprzednia.d[key]) !== norm(d[key]))
            .map(([label]) => label),
        };
      }
      przygotowane.set(kod, pozycja);
    }

    /** `stage()` (`:444-454`) — zapis jednego zgłoszenia do stagingu. */
    const doStagingu = (
      { kod, biezacy, d, bledy, zmiany }: PozycjaWTrakcie,
      typ: string,
    ): void => {
      d._completeSource = meta?.complete === true && opcje.feedComplete !== false;
      d._catalogVersion = version(
        (biezacy ? (kartaPoKodzie(biezacy.kod) ?? null) : null) as unknown as Pozycja | null,
      );
      const p = biezacy;
      const cenaZakupuStara = p?.cenaZakupu ?? null;
      dodajZgloszenie({
        typZmiany: typ,
        kod,
        nazwa: (d.nazwa as string) || p?.nazwa || "",
        dostawca,
        magazyn: (d.magazyn as string) || p?.magazyn || dostawca,
        magazynRaw: (d.magazynRaw as string) ?? null,
        stanStary: p?.stan ?? null,
        stanNowy: (d.stan as number) ?? p?.stan ?? 0,
        cenaZakupuStara,
        cenaZakupuNowa: (d.cenaZakupu as number) ?? p?.cenaZakupu ?? 0,
        cenaSprzedazyNowa: (d.cenaSprzedazy as number) ?? null,
        zmianaPct:
          cenaZakupuStara != null && cenaZakupuStara > 0
            ? (((d.cenaZakupu as number) ?? cenaZakupuStara) - cenaZakupuStara) /
              cenaZakupuStara *
              100
            : null,
        powod:
          [...zmiany, ...bledy].join(" • ") || (p ? "Zmiana danych" : "Nowa pozycja w cenniku"),
        ostrzezenie: bledy.join(" • ") || null,
        snapshotJson: JSON.stringify(d),
        eanRaw: (d.eanRaw as string) ?? null,
        eanIsValid: (d.eanIsValid as number) ?? null,
        eanSourceStatus: (d.eanSourceStatus as string) ?? null,
        eanCandidates: null,
        edytowanePola: null,
        utworzono: czas,
      });
      stats.doStagingu += 1;
      if (p) stats.zmienione += 1;
      else stats.nowe += 1;
    };

    function dodajZgloszenie(poz: NowaPozycjaStagingu): void {
      // `U.addStaging` jest w oryginale nadpisane (`:163-167`): każde nowe zgłoszenie
      // ZASTĘPUJE poprzednie dla pary (dostawca, kod) — reguła Staging v2 (#99), pilnowana
      // dodatkowo indeksem unikalnym `staging_one_current_product` z migracji 012.
      wyczyscZgloszenie(poz.dostawca, poz.kod);
      zapiszPozycjeStagingu(db, [poz]);
    }

    // ——— Bezpieczeństwo źródła: progi (`:455-461`) ———
    const stanOferty = stanOfertyDostawcy(db, dostawca);
    const liczbaPozycji = przygotowane.size;
    const minimum = stanOferty?.maxItemCount
      ? Math.max(1, Math.ceil(stanOferty.maxItemCount * 0.8))
      : 1;
    if (liczbaPozycji < minimum) {
      throw new CennikPodejrzanieMalyBlad(liczbaPozycji, minimum);
    }
    if (
      stanOferty &&
      liczbaPozycji >= 20 &&
      zaobserwowane.size < Math.min(liczbaPozycji, produkty.length) * 0.5
    ) {
      throw new CennikMasowoNierozpoznanyBlad();
    }

    // ——— Odcisk oferty i jej kompletność (`:462-466`) ———
    const odcisk = hash(
      wejscie
        .map((r) => {
          const p = r as unknown as Pozycja;
          return [p.kod, p.kodDostawcy, identity(p), rawEan(p), p.cenaZakupu, p.stan];
        })
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    );
    const znanaWersja = czyZnanaWersjaOferty(db, dostawca, odcisk);
    const kompletna =
      meta?.complete === true &&
      opcje.feedComplete !== false &&
      !((opcje.parserErrors ?? 0) > 0);
    const minelaDoba =
      !stanOferty?.lastCountedAt ||
      Date.now() - Date.parse(stanOferty.lastCountedAt) >= DOBA_MS;
    /** Nowa, RÓŻNA kompletna oferta — jedyny przebieg, który liczy dowody nieobecności. */
    const nowaKompletnaOferta =
      kompletna &&
      !znanaWersja &&
      minelaDoba &&
      (!opcje.reconcileOnly || Boolean(opcje.verifyAbsence));

    // Wiersz odrzucony po kategorii NIE jest dowodem nieobecności produktu (`:470-473`).
    for (const id of meta?.excludedCodes ?? []) {
      const p = poKodzie.get(id) ?? produkty.find((x) => norm(x.kod) === norm(id));
      if (p) zaobserwowane.add(p.id);
    }

    const wynik = db.transaction(() => {
      // Sprzątanie nieaktualnej kolejki (`:476-478`).
      for (const stara of staraKolejka.values()) {
        if (
          kompletna &&
          !przygotowane.has(stara.kod) &&
          stara.typZmiany !== "wycofana" &&
          !(JSON.parse(stara.snapshotJson || "{}") as Pozycja)._absenceReview
        ) {
          wyczyscZgloszenie(dostawca, stara.kod);
        }
      }

      for (const pozycja of przygotowane.values()) {
        const { kod, biezacy, d, bledy, zmiany } = pozycja;

        // Niejednoznaczne dopasowanie wstrzymuje kandydatów (`:481-486`).
        if (kompletna && !opcje.reconcileOnly && d._matchIssue) {
          for (const c of (d._candidates as { kod: string }[]) ?? []) {
            const p = poKodzie.get(c.kod);
            if (p) wstrzymaj(p, czas, odcisk, "Niejednoznaczne dopasowanie w aktualnym cenniku");
          }
        }

        // Powrót wstrzymanej karty wymaga potwierdzenia cech (`:487-489`).
        if (
          biezacy &&
          czyAutomatycznieWstrzymany(db, dostawca, biezacy.kod) &&
          !compatibility(d, biezacy as unknown as Pozycja).ok &&
          !zmiany.length &&
          !bledy.length
        ) {
          bledy.push(
            "Powrót opony wymaga sprawdzenia: cechy nie potwierdzają zgodności ze wstrzymaną kartą.",
          );
        }

        if (biezacy && biezacy.nieobecnoscPodRzad && !opcje.reconcileOnly) {
          aktualizujProdukt(db, biezacy.id, { nieobecnoscPodRzad: 0 });
        }

        if (!biezacy || bledy.length || zmiany.length) {
          doStagingu(pozycja, bledy.length ? "blad" : biezacy ? "zmiana_kluczowa" : "nowa");
          continue;
        }

        // Rozstrzygnięta różnica kasuje WSZYSTKIE nieaktualne sprawy, w tym wycofanie (`:493`).
        wyczyscZgloszenie(dostawca, kod);

        const patch: Record<string, unknown> = {};
        for (const k of ["cenaZakupu", "cenaSprzedazy", "marzaPct", "stan", "magazyn"]) {
          if (d[k] != null && norm(d[k]) !== norm((biezacy as unknown as Pozycja)[k])) {
            patch[k] = d[k];
          }
        }
        if (validateEan(d.ean).valid && d.ean !== biezacy.ean) {
          Object.assign(patch, {
            ean: d.ean,
            eanRaw: d.eanRaw,
            eanIsValid: 1,
            eanSourceStatus: "ok",
          });
        }

        // ——— Pewny powrót (`:502-512`) ———
        // Automatycznie przywracamy WYŁĄCZNIE produkt, który został wstrzymany automatycznie,
        // bo zniknął z kompletnego cennika. Wstrzymania RĘCZNE zostają nietknięte.
        const automat = czyAutomatycznieWstrzymany(db, dostawca, biezacy.kod);
        if (biezacy.status === "wstrzymany") {
          if (
            automat &&
            kompletna &&
            !opcje.reconcileOnly &&
            Number(d.cenaZakupu) > 0 &&
            Number((d.cenaSprzedazy as number) ?? biezacy.cenaSprzedazy) > 0
          ) {
            patch.status = "aktywny";
            usunAutomatyczneWstrzymanie(db, dostawca, biezacy.kod);
            usunDowodyNieobecnosci(db, dostawca, biezacy.kod);
            dostepnoscZmieniona = true;
          } else {
            patch.stan = 0;
          }
        }

        if (Object.keys(patch).length && !opcje.reconcileOnly) {
          patch.dataAktualizacji = czas;
          applyDims(patch, biezacy.rozmiar);
          applyLinkMemory(sqlite, patch, biezacy as unknown as Record<string, unknown>);
          aktualizujProdukt(db, biezacy.id, patch as Partial<ProduktWewnetrzny>);
          stats.autoZatwierdzone += 1;
          // ⚠ Pola tożsamości pochodzą z karty SPRZED zmiany, ceny i stan — z wartości PO.
          zapiszHistorieCen(db, {
            produktId: biezacy.id,
            kod: biezacy.kod,
            ean: (d.ean as string) ?? null,
            dostawca,
            marka: biezacy.marka,
            model: biezacy.model,
            rozmiar: biezacy.rozmiar,
            indeksNosnosci: biezacy.indeksNosnosci,
            indeksPredkosci: biezacy.indeksPredkosci,
            kategoria: biezacy.kategoria,
            cenaZakupu: (patch.cenaZakupu as number) ?? biezacy.cenaZakupu,
            cenaSprzedazy: (patch.cenaSprzedazy as number) ?? biezacy.cenaSprzedazy,
            stan: (patch.stan as number) ?? biezacy.stan,
            zarejestrowanoAt: czas,
          });
        } else {
          stats.bezZmian += 1;
        }
      }

      // ——— Stan oferty dostawcy (`:521-527`) ———
      if (kompletna && (!opcje.reconcileOnly || opcje.verifyAbsence)) {
        zapiszStanOfertyDostawcy(db, {
          supplier: dostawca,
          lastIdentityHash: odcisk,
          lastItemCount: liczbaPozycji,
          // ⚠ Podajemy już policzone maksimum, mimo że SQL i tak robi `MAX(…)`.
          // Oryginał zabezpiecza to podwójnie — oba zabezpieczenia zostają.
          maxItemCount: Math.max(liczbaPozycji, stanOferty?.maxItemCount ?? 0),
          updatedAt: czas,
          lastCountedAt: nowaKompletnaOferta ? czas : (stanOferty?.lastCountedAt ?? null),
        });
        // ⚠ Goły INSERT, bez ON CONFLICT — wołany WYŁĄCZNIE pod `nowaKompletnaOferta`,
        // prawdziwym tylko wtedy, gdy `czyZnanaWersjaOferty()` było fałszem.
        if (nowaKompletnaOferta) zapiszWersjeOferty(db, dostawca, odcisk, czas);
      }

      if (!kompletna) {
        stats.pominieteWycofania = "Niepotwierdzona kompletność źródła; braków nie zliczono";
      } else if (!nowaKompletnaOferta) {
        stats.pominieteWycofania =
          "Powtórzona oferta lub nie minęły 24 godziny od poprzedniego potwierdzenia";
      }

      // ——— Produkty nieobecne w cenniku (`:530-613`) ———
      for (const p of produkty) {
        if (zaobserwowane.has(p.id)) {
          if (!opcje.reconcileOnly) {
            usunDowodyNieobecnosci(db, dostawca, p.kod);
            if (p.nieobecnoscPodRzad) aktualizujProdukt(db, p.id, { nieobecnoscPodRzad: 0 });
          }
          // Niejednoznaczny kandydat ma własny błąd, nie stare wycofanie.
          if (!przygotowane.has(p.kod) && staraKolejka.get(p.kod)?.typZmiany === "wycofana") {
            wyczyscZgloszenie(dostawca, p.kod);
          }
          continue;
        }

        // ——— „Wstrzymane/0 nie wracają" (`:540-552`) ———
        if (p.status === "wstrzymany" && Number(p.stan || 0) === 0) {
          if (staraKolejka.get(p.kod)?.typZmiany === "wycofana") wyczyscZgloszenie(dostawca, p.kod);
          if (!opcje.reconcileOnly) usunDowodyNieobecnosci(db, dostawca, p.kod);
          if (!opcje.reconcileOnly && p.nieobecnoscPodRzad) {
            aktualizujProdukt(db, p.id, { nieobecnoscPodRzad: 0 });
          }
          const zamknieta = decyzjaONieobecnej(db, dostawca, p.kod);
          if (!zamknieta) continue;
          const alternatywyTeraz = alternatywy(p);
          if (zamknieta === hash(alternatywyTeraz.map((r) => [r.kod, r.ean, r.dot]).sort())) {
            continue;
          }
          // Zmieniony zestaw kandydatów zasługuje na świeży przegląd, choć stara karta
          // zostaje bezpiecznie wstrzymana. Stanu NIGDY się tu nie przywraca.
          usunDecyzjeONieobecnej(db, dostawca, p.kod);
        }

        // Poprawna, kompletna oferta jest źródłem prawdy o dostępności. Brakujące produkty
        // są wstrzymywane NATYCHMIAST — nikt nie może kupić towaru na podstawie starego
        // stanu. Osobny znacznik pozwala na bezpieczny automatyczny powrót (`:556-561`).
        if (kompletna && !opcje.reconcileOnly) {
          wstrzymaj(p, czas, odcisk, "Brak w aktualnym, kompletnym cenniku dostawcy");
          usunDowodyNieobecnosci(db, dostawca, p.kod);
          if (staraKolejka.get(p.kod)?.typZmiany === "wycofana") wyczyscZgloszenie(dostawca, p.kod);
        }

        // ——— Zgodne cechy pod innym oznaczeniem (`:562-582`) ———
        const alternatywne = alternatywy(p);
        if (alternatywne.length) {
          const hashKandydatow = hash(alternatywne.map((r) => [r.kod, r.ean, r.dot]).sort());
          const zamknieta = decyzjaONieobecnej(db, dostawca, p.kod);
          if (zamknieta === hashKandydatow) {
            wyczyscZgloszenie(dostawca, p.kod);
            stats.bezZmian += 1;
            continue;
          }
          const snap: Pozycja = {
            ...(p as unknown as Pozycja),
            _policyVersion: 2,
            _catalogVersion: version((kartaPoKodzie(p.kod) ?? null) as unknown as Pozycja | null),
            _absenceReview: true,
            _candidates: alternatywne.map((r) => ({
              kod: r.kod,
              nazwa: r.nazwa,
              ean: r.ean,
              rozmiar: r.rozmiar,
              dot: r.dot,
              stan: r.stan,
              cenaZakupu: r.cenaZakupu,
              cenaSprzedazy: r.cenaSprzedazy,
              sourceKey: sourceKey(dostawca, r),
            })),
          };
          dodajZgloszenie({
            typZmiany: "blad",
            kod: p.kod,
            nazwa: p.nazwa,
            dostawca,
            magazyn: p.magazyn,
            stanStary: p.stan,
            stanNowy: p.stan,
            cenaZakupuStara: p.cenaZakupu,
            cenaZakupuNowa: p.cenaZakupu,
            powod:
              "Brak starego kodu, ale zgodne cechy są w bieżącej ofercie pod innym oznaczeniem. Sprawdź starą kartę.",
            snapshotJson: JSON.stringify(snap),
            utworzono: czas,
          });
          if (!opcje.reconcileOnly) usunDowodyNieobecnosci(db, dostawca, p.kod);
          stats.doStagingu += 1;
          stats.zmienione += 1;
          continue;
        }

        const stara = staraKolejka.get(p.kod);
        if (stara && (JSON.parse(stara.snapshotJson || "{}") as Pozycja)._absenceReview) {
          wyczyscZgloszenie(dostawca, p.kod);
        }

        // ——— Stare karty bez stabilnego oznaczenia (`:586-596`) ———
        // Nie mają ani prefiksowanego identyfikatora, ani kodu dostawcy. Nie da się orzec
        // ich braku na podstawie innego schematu źródła.
        if (!norm(p.kod).startsWith(norm(dostawca) + "_") && !p.kodDostawcy) {
          const snap: Pozycja = {
            ...(p as unknown as Pozycja),
            _policyVersion: 2,
            _catalogVersion: version((kartaPoKodzie(p.kod) ?? null) as unknown as Pozycja | null),
            _absenceReview: true,
            _candidates:
              (JSON.parse(stara?.snapshotJson || "{}") as Pozycja)._candidates ?? [],
          };
          dodajZgloszenie({
            typZmiany: "blad",
            kod: p.kod,
            nazwa: p.nazwa,
            dostawca,
            magazyn: p.magazyn,
            stanStary: p.stan,
            stanNowy: p.stan,
            cenaZakupuStara: p.cenaZakupu,
            cenaZakupuNowa: p.cenaZakupu,
            powod:
              "Stara karta z dawnego importu. Nie można potwierdzić braku po jej oznaczeniu. Sprawdź starą kartę.",
            snapshotJson: JSON.stringify(snap),
            utworzono: czas,
          });
          usunDowodyNieobecnosci(db, dostawca, p.kod);
          stats.doStagingu += 1;
          stats.zmienione += 1;
          continue;
        }

        if (kompletna && !opcje.reconcileOnly) continue;
        if (!nowaKompletnaOferta) continue;

        // ——— Dowody nieobecności: trzy różne kompletne oferty (`:598-612`) ———
        const zapisane = dowodyNieobecnosci(db, dostawca, p.kod);
        const dowody = JSON.parse(zapisane || "[]") as unknown[];
        dowody.push({
          fingerprint: odcisk,
          checkedAt: czas,
          source: meta?.source || "supplier",
          items: liczbaPozycji,
        });
        // ⚠ Zapamiętujemy WYŁĄCZNIE trzy ostatnie — `evidence.slice(-3)` z oryginału.
        const ostatnie = dowody.slice(-3);
        zapiszDowodyNieobecnosci(db, dostawca, p.kod, JSON.stringify(ostatnie));
        const licznik = ostatnie.length;

        if (licznik >= 3) {
          const snap: Pozycja = {
            ...(p as unknown as Pozycja),
            _policyVersion: 2,
            _catalogVersion: version((kartaPoKodzie(p.kod) ?? null) as unknown as Pozycja | null),
            _withdrawal: true,
            _absenceEvidence: ostatnie,
          };
          dodajZgloszenie({
            typZmiany: "wycofana",
            kod: p.kod,
            nazwa: p.nazwa,
            dostawca,
            magazyn: p.magazyn,
            stanStary: p.stan,
            stanNowy: 0,
            cenaZakupuStara: p.cenaZakupu,
            cenaZakupuNowa: null,
            powod: "Brak w trzech różnych, kompletnych cennikach — sprawdź przed wstrzymaniem",
            snapshotJson: JSON.stringify(snap),
            utworzono: czas,
          });
          stats.wycofane += 1;
          stats.doStagingu += 1;
        }
        if (!opcje.reconcileOnly) {
          aktualizujProdukt(db, p.id, { nieobecnoscPodRzad: licznik });
        }
      }

      return stats;

      /** Zgodne pozycje z bieżącej oferty pod INNYM oznaczeniem (`:546-547`, `:563-564`). */
      function alternatywy(p: ProduktWewnetrzny): Pozycja[] {
        return (wejscie as unknown as Pozycja[]).filter(
          (r) =>
            compatibility(p as unknown as Pozycja, r).ok &&
            codeKey(dostawca, r.kod) !== codeKey(dostawca, p.kod) &&
            (!poKodzie.get(String(r.kod)) ||
              compatibility(r, poKodzie.get(String(r.kod))! as unknown as Pozycja).ok),
        );
      }
    });

    if (dostepnoscZmieniona && !opcje.reconcileOnly) odswiezDostepnosc(dostawca);
    return wynik;
  }

  return {
    importer,
    wstrzymaj,
    wyczyscZgloszenie,
    dopasowanieZapamietane,
    kartaPoKodzie,
    nalozPoprawki,
    dostepnoscZmieniona: () => dostepnoscZmieniona,
    oznaczZmianeDostepnosci: () => {
      dostepnoscZmieniona = true;
    },
    odswiezDostepnosc,
  };
}

/** Pozycja w trakcie obróbki — obiekt `item` (`staging_policy.cjs:429`). */
type PozycjaWTrakcie = {
  kod: string;
  biezacy: ProduktWewnetrzny | null;
  d: Pozycja;
  bledy: string[];
  zmiany: string[];
  zrodlo: Pozycja;
};
