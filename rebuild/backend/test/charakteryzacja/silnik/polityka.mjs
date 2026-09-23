// Uruchomienie ORYGINALNEJ polityki stagingu — `staging_policy.install()` @ `88fa31c`.
//
// ⭐ PO CO TO ZASTĄPIŁO `atrapy.mjs`. Do ticketu 130 charakteryzacja silnika porównywała nasz
// port z `tk = function` wyciętym z bundla. Na `88fa31c` ta funkcja jest MARTWA — ostatnią
// instrukcją, która przypisuje do `tk`, jest:
//
//   tk = require("./staging_policy.cjs").install({U, db:Qi, normalize:Hq, classify:Zc,
//                                                 badName:Kq, ext:__BRIDGE_EXT});
//
// Wzorzec nagrany ze starego `tk()` mierzył więc silnik, którego produkcja nie uruchamia.
// Ten moduł buduje oryginał tak, jak robi to produkcja.
//
// ⭐ DLACZEGO PRAWDZIWY SQLite, A NIE ATRAPY. `install()` nie da się obsłużyć obiektami
// w pamięci: wykonuje własne DDL sześciu tabel polityki, trzyma prepared statements na
// `staging_items`, `staging_matches`, `product_auto_suspensions`, `supplier_feed_state`,
// `supplier_feed_versions`, `product_absence_checks`, `staging_absence_decisions`, robi
// `db.transaction(...)` i sprawdza unikalność `products.kod_importu`. Atrapa musiałaby
// udawać SQL — a wtedy mierzylibyśmy atrapę, nie produkcję. Dlatego harness stawia bazę
// ze schematu odbudowy (`rebuild/schema/*.sql`, zgodnego z produkcją) i zasiewa ją realnym
// katalogiem ze zrzutu. Obie strony porównania gadają z prawdziwym SQLite.
//
// ⚠ Tabele polityki zakłada SAM `install()` (`staging_policy.cjs:86-107`) — migracji `012`
// tu NIE stosujemy, żeby zmierzyć dokładnie to DDL, które wykonuje produkcja.

import Database from "better-sqlite3";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { zastosujMigracje } from "../../../src/db/migrate.ts";
import { zaladujOryginal } from "./oryginal.mjs";

const wymagaj = createRequire(import.meta.url);
// .../test/charakteryzacja/silnik/polityka.mjs → .../rebuild/backend
const backendDir = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
const repoDir = join(backendDir, "..", "..");

/**
 * ORYGINALNY moduł polityki — z `mirror/`, nie z naszego portu w `legacy/`.
 *
 * Oba pliki są bajt w bajt identyczne (pilnuje tego gate sha256 w `charakteryzacja.test.ts`),
 * ale wzorzec ma pochodzić ze źródła prawdy, a nie z kopii, którą sami utrzymujemy.
 */
const SCIEZKA_POLITYKI = join(repoDir, "mirror", "backend", "staging_policy.cjs");

/**
 * Schemat stawiamy TYM SAMYM runnerem co reszta testów i co `npm run migrate`
 * (`src/db/migrate.ts`), a nie gołym `exec()` po plikach `.sql`.
 *
 * ⚠ To nie jest wygoda, tylko poprawność: migracje niosą dyrektywy `@pomin-jesli-…`
 * (m.in. `003`, `013`), które rozumie wyłącznie runner. Odtwarzanie ich gołym `exec()`
 * wywraca się na przebudowie tabeli w `003`, a pominięcie ich gubi kolumny, o których wie
 * model Drizzle (np. `products.uwaga_cena` z `002`) — i obie strony porównania jechałyby
 * wtedy na RÓŻNYCH schematach.
 *
 * Migracja `012` (tabele polityki) przechodzi, ale jest tu no-opem: `install()` zakłada te
 * tabele sam (`staging_policy.cjs:86-107`) przez `CREATE TABLE IF NOT EXISTS`. Kolejność
 * (najpierw migracje, potem `install()`) jest taka jak na produkcji po wdrożeniu `012`.
 */

/**
 * Kolumny `historia_cen` w kolejności z INSERT-a oryginału (`staging_policy.cjs:517-519`).
 *
 * Harness czyta je z tabeli, ale lista jest tu, bo strona PORTU porównuje wiersze pole po polu
 * i obie strony muszą patrzeć na ten sam zestaw.
 */
export const KOLUMNY_HISTORII = [
  "produktId",
  "kod",
  "ean",
  "dostawca",
  "marka",
  "model",
  "rozmiar",
  "indeksNosnosci",
  "indeksPredkosci",
  "kategoria",
  "cenaZakupu",
  "cenaSprzedazy",
  "stan",
  "zarejestrowanoAt",
];

/**
 * Pola produktu, po których liczymy `zmianyProduktow`.
 *
 * Nazwy są w camelCase — tak jak w modelu i tak, jak raportuje je strona PORTU
 * (`test/silnik.charakteryzacja.test.ts`). Do SQL-a tłumaczy je `naSnake()`; gdyby harness
 * oddawał `snake_case`, obie strony porównania różniłyby się samymi nazwami kluczy.
 */
export const POLA_PRODUKTU = [
  "cenaZakupu",
  "cenaSprzedazy",
  "marzaPct",
  "stan",
  "magazyn",
  "status",
  "nieobecnoscPodRzad",
  "dataAktualizacji",
  "wysokosc",
  "dlugosc",
  "szerokoscPaczki",
  "wysokoscPrzesylki",
  "linkZdjecia",
];

/**
 * Triggery z migracji `011`, zdejmowane po postawieniu schematu.
 *
 * ⚠ MUSI być tą samą listą, co `bezTriggerowBazy()` w `test/silnik.charakteryzacja.test.ts`.
 * Triggery uzupełniają `blokowane_formy_platnosci` i `zastosowanie` przy INSERT/UPDATE, więc
 * gdyby działały tylko po jednej stronie porównania, snapshot zgłoszenia różniłby się
 * wartością, której silnik w ogóle nie dotyka.
 */
const TRIGGERY_DO_ZDJECIA = [
  "products_blokowane_formy_ai",
  "products_blokowane_formy_au",
  "products_zastosowanie_ai",
  "products_zastosowanie_au",
  "manual_overrides_kategoria_ai",
  "manual_overrides_kategoria_au",
];

function postawSchemat(db) {
  zastosujMigracje(db, join(repoDir, "rebuild", "schema"));
  for (const t of TRIGGERY_DO_ZDJECIA) db.exec(`DROP TRIGGER IF EXISTS ${t}`);
}

const naSnake = (nazwa) => nazwa.replace(/[A-Z]/g, (z) => "_" + z.toLowerCase());

/**
 * Buduje oryginalną politykę stagingu gotową do uruchomienia.
 *
 * @param {object} opcje
 * @param {Array<Record<string, unknown>>} opcje.produkty katalog do zasiania (klucze camelCase)
 * @param {Array<Record<string, unknown>>} [opcje.overrides] wiersze `manual_overrides`
 */
export function stworzPolitykeOryginalu({ produkty, overrides = [] }) {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = OFF");
  postawSchemat(db);

  // ——— Zasianie katalogu ———
  const kolumnyProduktow = db
    .prepare("SELECT name FROM pragma_table_info('products')")
    .all()
    .map((r) => r.name);
  const wstawProdukt = db.prepare(
    `INSERT INTO products (${kolumnyProduktow.join(",")}) VALUES (${kolumnyProduktow
      .map(() => "?")
      .join(",")})`,
  );
  for (const p of produkty) {
    const wiersz = {};
    for (const [k, v] of Object.entries(p)) wiersz[naSnake(k)] = v;
    wstawProdukt.run(
      kolumnyProduktow.map((k) => {
        const v = wiersz[k];
        if (v === undefined || v === null) return null;
        return typeof v === "boolean" ? Number(v) : v;
      }),
    );
  }

  // ——— Zasianie poprawek Marty ———
  if (overrides.length) {
    const wstawPoprawke = db.prepare(
      `INSERT INTO manual_overrides
        (supplier_kod, supplier_product_id, field_name, override_value, acknowledged_source_value,
         reason, created_by, created_at)
       VALUES (?,?,?,?,?,?,?,?)`,
    );
    for (const o of overrides) {
      wstawPoprawke.run(
        o.supplierKod,
        o.supplierProductId,
        o.fieldName,
        o.overrideValue,
        o.acknowledgedSourceValue ?? null,
        o.reason ?? "charakteryzacja",
        o.createdBy ?? 1,
        o.createdAt ?? new Date(0).toISOString(),
      );
    }
  }

  const kolumnyStanu = POLA_PRODUKTU.map(naSnake);
  const czytajStan = () =>
    new Map(
      db
        .prepare(`SELECT id, ${kolumnyStanu.join(",")} FROM products`)
        .all()
        .map((r) => [
          r.id,
          Object.fromEntries(POLA_PRODUKTU.map((k, i) => [k, r[kolumnyStanu[i]] ?? null])),
        ]),
    );
  const stanPoczatkowy = czytajStan();

  // ——— Warstwa danych `U`, ta sama semantyka co `deminified/backend-index.cjs:44695-44950` ———
  const naCamelWiersz = (r) =>
    r == null
      ? r
      : Object.fromEntries(
          Object.entries(r).map(([k, v]) => [k.replace(/_([a-z0-9])/g, (_, z) => z.toUpperCase()), v]),
        );

  const wywolaniaStagingu = [];
  const wywolaniaBridgeExt = [];

  const U = {
    listProducts: () => db.prepare("SELECT * FROM products").all().map(naCamelWiersz),
    getProduct: (id) => naCamelWiersz(db.prepare("SELECT * FROM products WHERE id=?").get(id)),
    getProductByKod: (kod) =>
      naCamelWiersz(db.prepare("SELECT * FROM products WHERE kod=?").get(kod)),

    /** `U.updateProduct` (`:44728`) — bezpiecznik zerowej ceny wchodzi PRZED zapisem. */
    updateProduct(id, patch) {
      let doZapisu = patch;
      if (("cenaSprzedazy" in patch || "cenaZakupu" in patch) && !("status" in patch)) {
        const biezacy = this.getProduct(id);
        const cs =
          "cenaSprzedazy" in patch ? Number(patch.cenaSprzedazy) : Number(biezacy?.cenaSprzedazy);
        const cz = "cenaZakupu" in patch ? Number(patch.cenaZakupu) : Number(biezacy?.cenaZakupu);
        if (cs === 0 || cz === 0) doZapisu = { ...patch, status: "wstrzymany" };
      }
      const pola = Object.keys(doZapisu).filter((k) => kolumnyProduktow.includes(naSnake(k)));
      if (!pola.length) return this.getProduct(id);
      db.prepare(
        `UPDATE products SET ${pola.map((k) => `${naSnake(k)}=?`).join(",")} WHERE id=?`,
      ).run(...pola.map((k) => doZapisu[k] ?? null), id);
      return this.getProduct(id);
    },

    deleteProduct(id) {
      return db.prepare("DELETE FROM products WHERE id=?").run(id).changes > 0;
    },

    listStaging: () => db.prepare("SELECT * FROM staging_items").all().map(naCamelWiersz),
    getStaging: (id) =>
      naCamelWiersz(db.prepare("SELECT * FROM staging_items WHERE id=?").get(id)),

    /**
     * `U.addStaging` (`:44923`) — deduplikacja po (kod, typ_zmiany, COALESCE(powod,'')).
     *
     * ⚠ `install()` NADPISUJE tę funkcję (`:163-167`), dokładając kasowanie starego wiersza
     * dla pary (dostawca, kod). Oryginalna wersja zostaje pod `original.add` i jest wołana
     * z wnętrza nadpisania — dlatego musi tu być wierna.
     */
    addStaging(poz) {
      wywolaniaStagingu.push(poz);
      const powod = poz.powod ?? "";
      const istniejaca = db
        .prepare(
          "SELECT * FROM staging_items WHERE kod=? AND typ_zmiany=? AND COALESCE(powod,'')=?",
        )
        .get(poz.kod, poz.typZmiany, powod);
      if (istniejaca) return naCamelWiersz(istniejaca);
      const kolumny = db
        .prepare("SELECT name FROM pragma_table_info('staging_items')")
        .all()
        .map((r) => r.name)
        .filter((n) => n !== "id");
      const wiersz = {};
      for (const [k, v] of Object.entries(poz)) wiersz[naSnake(k)] = v;
      const info = db
        .prepare(
          `INSERT INTO staging_items (${kolumny.join(",")}) VALUES (${kolumny
            .map(() => "?")
            .join(",")})`,
        )
        .run(kolumny.map((k) => wiersz[k] ?? null));
      return this.getStaging(info.lastInsertRowid);
    },

    updateStaging(id, patch) {
      const pola = Object.keys(patch);
      if (!pola.length) return this.getStaging(id);
      db.prepare(
        `UPDATE staging_items SET ${pola.map((k) => `${naSnake(k)}=?`).join(",")} WHERE id=?`,
      ).run(...pola.map((k) => patch[k] ?? null), id);
      return this.getStaging(id);
    },

    /** Akceptacja jest zakresem I15.4c — tutaj tylko po to, żeby `install()` miało co objąć. */
    acceptStaging() {
      throw new Error("acceptStaging nie jest częścią charakteryzacji importu (I15.4c)");
    },

    /** `U.getOverridesFor` (`:44915`) — kolejność wyniku to skan indeksu UNIQUE, czyli po `field_name`. */
    getOverridesFor: (supplierKod, supplierProductId) =>
      db
        .prepare(
          "SELECT * FROM manual_overrides WHERE supplier_kod=? AND supplier_product_id=?",
        )
        .all(supplierKod, supplierProductId)
        .map(naCamelWiersz),
  };

  // ——— `__BRIDGE_EXT`: REALNY port rozszerzeń, ten sam, którego używa produkcja ———
  const bridgeExt = wymagaj(join(repoDir, "mirror", "backend", "bridge_ext.cjs"));
  const ext = {
    applyDims(patch, rozmiarFallback) {
      wywolaniaBridgeExt.push({ funkcja: "applyDims", rozmiarFallback: rozmiarFallback ?? null });
      return bridgeExt.applyDims(patch, rozmiarFallback);
    },
    applyLinkMemory(uchwyt, patch, istniejacy) {
      wywolaniaBridgeExt.push({
        funkcja: "applyLinkMemory",
        kodProduktu: istniejacy?.kod ?? null,
      });
      return bridgeExt.applyLinkMemory(uchwyt, patch, istniejacy);
    },
    applyNazwaPamiec(uchwyt, produkt) {
      wywolaniaBridgeExt.push({ funkcja: "applyNazwaPamiec", kod: produkt?.kod ?? null });
      return bridgeExt.applyNazwaPamiec(uchwyt, produkt);
    },
    assignKodImportu(uchwyt, produkt, istniejacy) {
      wywolaniaBridgeExt.push({ funkcja: "assignKodImportu", kod: produkt?.kod ?? null });
      return bridgeExt.assignKodImportu(uchwyt, produkt, istniejacy);
    },
  };

  // `bridge_ext` sięga po własne tabele pamięci — muszą istnieć, inaczej rzuci.
  db.exec(
    "CREATE TABLE IF NOT EXISTS link_pamiec_kod (kod TEXT PRIMARY KEY, link TEXT NOT NULL, updated_at TEXT);" +
      "CREATE TABLE IF NOT EXISTS link_pamiec_mr (mrkey TEXT PRIMARY KEY, link TEXT NOT NULL, updated_at TEXT);" +
      "CREATE TABLE IF NOT EXISTS nazwa_pamiec (kod_importu TEXT PRIMARY KEY, nazwa TEXT NOT NULL, updated_at TEXT);" +
      "CREATE TABLE IF NOT EXISTS waga_pamiec (kod TEXT PRIMARY KEY, waga REAL, updated_at TEXT);",
  );

  // ——— Helpery z bundla: `normalize` (Hq), `classify` (Zc), `badName` (Kq) ———
  //
  // ⚠ Wycinane z `mirror/backend/index.cjs`, który na `develop` stoi na `86d9090`, nie na
  // `88fa31c`. Blok helperów jest między tymi commitami IDENTYCZNY (zweryfikowane bajtowo
  // w tickecie 130), więc wycięcie jest wiarygodne — ale sam plik jest nieaktualny i to
  // odnotowuje karta I15.4b w „Do koordynatora".
  const oryginal = zaladujOryginal({ U, ww: db, __BRIDGE_EXT: ext, Qi: db });

  const polityka = wymagaj(SCIEZKA_POLITYKI);
  const importer = polityka.install({
    U,
    db,
    normalize: oryginal.Hq,
    classify: oryginal.Zc,
    badName: oryginal.Kq,
    ext,
  });

  return {
    /** Oryginalny `importer(supplier, incoming, options)`. */
    importer,
    db,
    integralnosc: oryginal.integralnosc,
    staging: () => db.prepare("SELECT * FROM staging_items ORDER BY id").all().map(naCamelWiersz),
    wywolaniaStagingu,
    wywolaniaBridgeExt,
    historiaCen: () =>
      db.prepare("SELECT * FROM historia_cen ORDER BY id").all().map(naCamelWiersz),
    /** Zmiany STANU produktów: `{id, zmiany:{pole:{przed,po}}}`. */
    zmianyProduktow() {
      const teraz = czytajStan();
      const zmiany = [];
      for (const [id, przed] of stanPoczatkowy) {
        const po = teraz.get(id);
        if (!po) continue;
        const roznice = {};
        for (const pole of POLA_PRODUKTU) {
          if (przed[pole] !== po[pole]) roznice[pole] = { przed: przed[pole], po: po[pole] };
        }
        if (Object.keys(roznice).length > 0) zmiany.push({ id, zmiany: roznice });
      }
      return zmiany.sort((a, b) => a.id - b.id);
    },
    zamknij() {
      db.close();
    },
  };
}

/**
 * ORYGINALNE, nadpisane `ext.assignKodImportu` ze Staging v2 (`staging_policy.cjs:141-157`).
 *
 * ⭐ PO CO. `install()` PODMIENIA tę funkcję na obiekcie `ext`, więc w produkcji wszyscy
 * wołający — importer, `acceptStaging` i `addProductsBulk` — dostają wersję nową, a nie tę
 * z `bridge_ext.cjs`. Charakteryzacje `addProductsBulk` i `acceptStaging` porównywały się
 * dotąd z wersją STARĄ, czyli z funkcją, której produkcja już nie uruchamia.
 *
 * ⚠ BIERZEMY WYŁĄCZNIE `assignKodImportu`. `install()` nadpisuje przy okazji także
 * `U.updateProduct`, `U.addStaging`, `U.updateStaging` i dokłada `U.acceptStaging` —
 * to jest zakres kart I15.4b (importer) i I15.4c (akceptacja), a nie tych charakteryzacji.
 * Dlatego metody `U` są zapamiętywane przed instalacją i PRZYWRACANE po niej: test dostaje
 * dokładnie jedną zmianę, tę, o którą chodzi.
 *
 * Nadpisanie domyka się nad przekazanymi `U` i `db`, więc muszą to być te same obiekty,
 * na których pracuje test.
 */
export function oryginalneAssignKodImportu({ db, U }) {
  const bridgeExt = wymagaj(join(repoDir, "mirror", "backend", "bridge_ext.cjs"));
  const oryginal = zaladujOryginal({ U, ww: db, __BRIDGE_EXT: bridgeExt, Qi: db });

  // ⚠ `U` wycięte dla charakteryzacji AKCEPTACJI nie ma `listProducts` — tamten wycinek bierze
  // z bundla tylko metody, których dotyka `acceptStaging`. Nadpisane `assignKodImportu` woła
  // je jednak wprost (`staging_policy.cjs:145`), bo w produkcji `U` jest kompletne.
  // Dokładamy odpowiednik czytający z TEJ SAMEJ bazy — to nie jest atrapa, tylko ta sama
  // treść zapytania co `U.listProducts` w produkcji (`SELECT * FROM products`).
  if (typeof U.listProducts !== "function") {
    U.listProducts = () =>
      db
        .prepare("SELECT * FROM products")
        .all()
        .map((r) =>
          Object.fromEntries(
            Object.entries(r).map(([k, v]) => [
              k.replace(/_([a-z0-9])/g, (_, z) => z.toUpperCase()),
              v,
            ]),
          ),
        );
  }

  const przed = new Map(
    ["updateProduct", "addStaging", "updateStaging", "acceptStaging"].map((n) => [n, U[n]]),
  );
  const dodane = [];
  const ext = { ...bridgeExt };
  wymagaj(SCIEZKA_POLITYKI).install({
    U,
    db,
    normalize: oryginal.Hq,
    classify: oryginal.Zc,
    badName: oryginal.Kq,
    ext,
  });
  for (const [nazwa, metoda] of przed) {
    if (metoda === undefined) dodane.push(nazwa);
    else U[nazwa] = metoda;
  }
  for (const nazwa of dodane) delete U[nazwa];

  return ext.assignKodImportu;
}

/**
 * Ładuje oryginał charakteryzacji AKCEPTACJI/BULKU tak, jak widzi go produkcja po Staging v2:
 * z nadpisanym `ext.assignKodImportu`.
 *
 * Loader jest podawany jako argument (`zaladuj`), żeby nie robić cyklicznego importu między
 * katalogami charakteryzacji — ten moduł nie ma wiedzieć o `charakteryzacja/akceptacja/`.
 *
 * Sztuczka z kolejnością: `zaladuj(baza, ext)` musi dostać obiekt `ext` ZANIM powstanie `U`,
 * a nadpisanie domyka się nad `U`. Dlatego podajemy pusty obiekt, a wypełniamy go po
 * załadowaniu — moduł trzyma tę samą REFERENCJĘ, więc widzi uzupełnienie.
 */
export function zaladujOryginalZeStagingV2(zaladuj, baza) {
  const ext = {};
  const wynik = zaladuj(baza, ext);
  Object.assign(ext, wymagaj(join(repoDir, "mirror", "backend", "bridge_ext.cjs")), {
    assignKodImportu: oryginalneAssignKodImportu({ db: baza.sqlite, U: wynik.U }),
  });
  return wynik;
}
