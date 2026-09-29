import { eq, sql } from "drizzle-orm";
import type { Baza } from "../db/index.js";
import { products } from "../db/schema.js";
import { wybierzPromocje, type Promocja, type RekordCenowy } from "./ceny.js";
import { KOLUMNY_POZA_KONTRAKTEM, projekcjaKontraktowa } from "./kolumny.js";
import { odsiejPola } from "./pola-edytowalne.js";

/**
 * Kolumny wychodzące do API — wszystkie z tabeli MINUS wewnętrzne (plan.md D6).
 * Bez tej projekcji `uwaga_cena` z migracji 002 dołożyłaby 73. klucz do odpowiedzi
 * i złamała zamrożony `contract/fixtures/GET_products.json` (72 klucze).
 */
const KOLUMNY_API = projekcjaKontraktowa(products, KOLUMNY_POZA_KONTRAKTEM.products);

export type Produkt = Omit<
  typeof products.$inferSelect,
  (typeof KOLUMNY_POZA_KONTRAKTEM.products)[number]
>;

/**
 * Odpowiednik `U.listProducts` (backend-index.cjs:44699-44701) — CAŁA tabela, bez
 * limitu i bez sortowania. To nie przeoczenie: frontend katalogu woła `/api/products`
 * bez parametrów właśnie po to, żeby dostać komplet i filtrować go u siebie
 * (frontend-index.js:23261). Kolejność wierszy = kolejność `rowid`, jak w oryginale.
 */
export function listaProduktow(db: Baza): Produkt[] {
  return db.select(KOLUMNY_API).from(products).all();
}

export type StronaProduktow = {
  items: Produkt[];
  total: number;
};

/**
 * Odpowiednik `U.listProductsPaged` (backend-index.cjs:44702-44721).
 *
 * `total` to `count(*)` liczony PO tym samym filtrze co `items` — przy `dostawca`
 * jest to liczba produktów tego dostawcy, nie całej bazy.
 */
export function listaProduktowStronicowana(
  db: Baza,
  limit = 200,
  offset = 0,
  dostawca?: string,
): StronaProduktow {
  if (dostawca !== undefined) {
    const items = db
      .select(KOLUMNY_API)
      .from(products)
      .where(eq(products.dostawca, dostawca))
      .limit(limit)
      .offset(offset)
      .all();
    const licznik = db
      .select({ c: sql<number>`count(*)` })
      .from(products)
      .where(eq(products.dostawca, dostawca))
      .get();
    return { items, total: licznik?.c ?? 0 };
  }

  const items = db.select(KOLUMNY_API).from(products).limit(limit).offset(offset).all();
  const licznik = db.select({ c: sql<number>`count(*)` }).from(products).get();
  return { items, total: licznik?.c ?? 0 };
}

// ————————————————————————————————————————————————————————————————————————————————————————
//  `_reguly.promocja` — ŚWIADOME ODSTĘPSTWO OD PRODUKCJI (karta 14h)
//
//  CO: `GET /api/products` dokłada do produktu opcjonalny 73. klucz `_reguly` z wygrywającą,
//      aktywną promocją. Produkcja tego klucza NIE ZWRACA — jej odpowiedź ma 72 klucze.
//  DLACZEGO: kolumna „Promocja" w `/katalog` renderuje `produkt._reguly?.promocja` od
//      baseline'u 13.08, ale ZAPISU tego pola nie dopisał nigdy nikt — ani w żywym bundlu
//      (`index-PRICEFMT1783512500.js`: jedno wystąpienie, wyłącznie odczyt), ani w backendzie
//      (`mirror/backend/index.cjs`: zero). Kolumna od zawsze pokazuje „—".
//  CZYJA DECYZJA: Ania, 2026-09-18 — „w kolumnie promocje mają się wyświetlać aktualne
//      promocje dla danych produktów", po dopytaniu: „dodaj regułę wypełniania kolumny
//      promocja". Zapis: `docs/rebuild-backlog.md` #22.
//  ⚠ To NOWA FUNKCJA, nie naprawa regresji. Ania pamięta, że kolumna „działała i zepsuł ją
//      backup" — kod tego nie potwierdza w ŻADNEJ wersji, którą mamy.
//
//  Dopasowanie idzie przez `wybierzPromocje` z `repos/ceny.ts` i to jest WARUNEK KONIECZNY,
//  nie kwestia stylu:
//   • w systemie są już trzy różne sposoby liczenia ceny (backlog #23, #24) — czwarty sposób
//     dopasowania promocji byłby fabryką rozjazdów;
//   • karta 14f sprawi, że daty zaczną kończyć promocje (backlog #19). Dzięki wspólnej funkcji
//     kolumna zacznie to respektować SAMA, bez ruszania tego pliku. Zduplikowana logika nie.
//  ⚠ Dat tu NIE czytamy — `promocjaPasuje` ich nie zna (`ceny.ts:110-116`) i tak ma zostać
//  do 14f. `repos/ceny.ts` jest tu READ-ONLY.
// ————————————————————————————————————————————————————————————————————————————————————————

/** Promocja tak, jak czyta ją kolumna katalogu — `wartosc` to PROCENT rabatu (`rabat_pct`). */
export type PromocjaProduktu = { wartosc: number; nazwa: string };

/** Produkt katalogu z opcjonalnym 73. kluczem. Brak promocji = BRAK `_reguly` (nie `{}`). */
export type ProduktZRegulami = Produkt & { _reguly?: { promocja: PromocjaProduktu } };

/**
 * Dokłada `_reguly.promocja` do produktów, którym jakaś aktywna promocja pasuje.
 *
 * ⚠ KSZTAŁT JEST PODYKTOWANY PRZEZ ORYGINAŁ, nie przez nas: żywy bundle produkcji czyta
 * `const p = e?._reguly?.promocja; … const rabat = p.wartosc; const nazwa = p.nazwa || "Promocja"`.
 * Stąd `wartosc`, a nie `rabatPct` — mapujemy nazwę kolumny bazy na nazwę, której oczekuje
 * renderer. Port w `rebuild/` (`katalog/formatowanie.tsx`) jest z tym zgodny bajt w bajt.
 *
 * ⚠ BRAK DOPASOWANIA = BRAK KLUCZA, a nie `_reguly: {}`. To nie kosmetyka: dzięki temu produkt
 * bez promocji ma dokładnie te 72 klucze co nagranie produkcji, więc odstępstwo jest warunkowe
 * i nie dotyka istniejących bramek wierności (`test/katalog.gate.test.ts`). Renderer i tak
 * sprawdza `if (!promocja) return <Kreska />`.
 *
 * ⚠ WYDAJNOŚĆ: `promocje` przychodzą z ZEWNĄTRZ, wczytane raz na żądanie. Katalog ma ~7400
 * pozycji — zapytanie per produkt byłoby tu zabójcze. Wzorzec 1:1 z `przeliczCenyZRegul`.
 */
export function dolaczReguly(produkty: Produkt[], promocje: Promocja[]): ProduktZRegulami[] {
  // Dziś to stan produkcji: `promotions` jest puste, a `GET_promotions.json` to `[]`.
  // Bez tej ścieżki kopiowalibyśmy 7400 obiektów, żeby nie dołożyć do nich niczego.
  if (promocje.length === 0) return produkty;

  return produkty.map((produkt) => {
    const promocja = wybierzPromocje(promocje, produkt as unknown as RekordCenowy);
    if (!promocja) return produkt;

    return {
      ...produkt,
      _reguly: { promocja: { wartosc: promocja.rabatPct, nazwa: promocja.nazwa } },
    };
  });
}

/**
 * Produkt w pełnym kształcie tabeli — do użytku WEWNĘTRZNEGO (silnik importu), nie do API.
 *
 * Świadomie omija `KOLUMNY_API`: silnik porównuje pozycje z cennika z katalogiem i musi
 * widzieć wszystko, także kolumny ukryte przed kontraktem (`uwaga_cena`).
 */
export type ProduktWewnetrzny = typeof products.$inferSelect;

/**
 * Katalog jednego dostawcy dla silnika importu — odpowiednik
 * `U.listProducts().filter(u => u.dostawca === t)` z `tk()` (backend-index.cjs:47598).
 *
 * Oryginał pobiera CAŁĄ tabelę i filtruje w JS; my filtrujemy w SQL. To ta sama treść
 * wyniku i ta sama kolejność (`rowid`), a różnica dotyczy wyłącznie tego, gdzie wykonuje się
 * warunek — na zachowanie silnika nie ma wpływu.
 */
export function katalogDoImportu(db: Baza, dostawca: string): ProduktWewnetrzny[] {
  return db.select().from(products).where(eq(products.dostawca, dostawca)).all();
}

/**
 * Aktualizacja produktu — port `U.updateProduct` (backend-index.cjs:44728-44739).
 *
 * ⚠ Nie jest to zwykły UPDATE: jeżeli patch rusza którąkolwiek cenę i NIE ustawia jawnie
 * `status`, a wynikowa cena zakupu lub sprzedaży wynosi 0, produkt dostaje
 * `status: "wstrzymany"`. W zakresie 3c silnik woła tę funkcję wyłącznie z
 * `{ nieobecnoscPodRzad: 0 }`, więc bezpiecznik się nie uruchamia — ale wchodzi do portu
 * teraz, bo 3d przepuści tędy zapisy auto-zatwierdzania z cenami.
 */
export function aktualizujProdukt(
  db: Baza,
  id: number,
  patch: Partial<ProduktWewnetrzny>,
): ProduktWewnetrzny | null {
  let doZapisu = patch;

  if (("cenaSprzedazy" in patch || "cenaZakupu" in patch) && !("status" in patch)) {
    const biezacy = db.select().from(products).where(eq(products.id, id)).get();
    const cenaSprzedazy =
      "cenaSprzedazy" in patch ? Number(patch.cenaSprzedazy) : Number(biezacy?.cenaSprzedazy);
    const cenaZakupu =
      "cenaZakupu" in patch ? Number(patch.cenaZakupu) : Number(biezacy?.cenaZakupu);
    if (cenaSprzedazy === 0 || cenaZakupu === 0) doZapisu = { ...patch, status: "wstrzymany" };
  }

  // Ticket 155 (NOWA logika, nie port): ręczna edycja `waga` przestaje być „uzupełniona
  // automatycznie" — bez tego reset flagi wymagałby osobnego zapytania i osobnego wpisu
  // w `manual_overrides`/`history` (flaga nie jest polem edytowalnym z UI).
  if ("waga" in patch && !("wagaAutoUzupelniona" in patch)) {
    doZapisu = { ...doZapisu, wagaAutoUzupelniona: false };
  }

  // ⚠ PUSTY PATCH NIE WYWOŁUJE `UPDATE` — drizzle rzuca na `set({})`. Oryginał tej gałęzi
  // nie potrzebował, bo podawał całe ciało żądania; u nas `PATCH` z samymi polami spoza listy
  // edytowalnych daje pusty patch i musi odpowiedzieć 200 z aktualnym produktem, a nie 500.
  // Ten sam ruch co `aktualizujDostawce` w 3f-2.
  if (Object.keys(doZapisu).length > 0) {
    db.update(products).set(doZapisu).where(eq(products.id, id)).run();
  }
  return db.select().from(products).where(eq(products.id, id)).get() ?? null;
}

/**
 * Usunięcie produktu — port `U.deleteProduct` (backend-index.cjs:44740-44742).
 *
 * Woła to wyłącznie silnik importu, gdy pozycja z cennika przestała być oponą (`:47689`).
 *
 * @returns `false`, gdy produktu o tym id nie było
 */
export function usunProdukt(db: Baza, id: number): boolean {
  const istnieje = db.select().from(products).where(eq(products.id, id)).get();
  if (!istnieje) return false;
  db.delete(products).where(eq(products.id, id)).run();
  return true;
}

/**
 * Czyszczenie CAŁEGO katalogu — port `U.clearProducts()` (`backend-index.cjs:44744`,
 * wołane wyłącznie przez `POST /api/products/clear`, `:48332`).
 *
 * `DELETE FROM products` BEZ `WHERE` — operacja nieodwracalna, dotykająca wszystkich
 * dostawców naraz. Ochronę stanowi wyłącznie `{potwierdzenie: "WYCZYSC"}` sprawdzane
 * w trasie oraz kopia pliku bazy robiona tuż przed (`routes/maintenance.ts`).
 *
 * @returns liczba usuniętych wierszy — oryginał jej nie zwraca (`u.json({ok:true})`),
 *   ale jest potrzebna testom i logowi; kształt odpowiedzi HTTP pozostaje bez zmian.
 */
export function wyczyscProdukty(db: Baza): number {
  return db.delete(products).run().changes;
}

/**
 * Odsiewa z rekordu klucze, których tabela `products` nie ma.
 *
 * PO CO: rekord powstaje ze snapshotu parsera albo z ciała żądania i niesie pola pomocnicze
 * (`_srcConflict`, `rozmiarWykryty`, `uwagaCena` w bulku). Oryginał podaje całość Drizzle'owi,
 * który po cichu ignoruje nieznane klucze — nasza wersja Drizzle rzuca. Odsiew jest więc
 * mostem między dwoma zachowaniami ORM-a, a NIE listą pól edytowalnych: zapisujemy dokładnie
 * te kolumny, które zapisałaby produkcja.
 *
 * ⚠ To nie jest `POLA_EDYTOWALNE_PRODUKTU`. Tamta lista broni trasy `PATCH`/`PUT` przed
 * mass-assignmentem; ta przepuszcza WSZYSTKIE kolumny, bo import ma je zapisywać — łącznie
 * z wyliczanymi, które sam produkuje.
 */
export function tylkoKolumnyProduktu(rekord: Record<string, unknown>): Record<string, unknown> {
  const znane = new Set(Object.keys(products));
  return Object.fromEntries(Object.entries(rekord).filter(([klucz]) => znane.has(klucz)));
}

/**
 * Pola, które wolno zmienić przez `PATCH`/`PUT /api/products/{id}` (ticket 35, D1).
 *
 * ⚠ ODSTĘPSTWO OD 1:1, ŚWIADOME I ZATWIERDZONE. Oryginał (`:48415-48424` dla `PUT`,
 * `:48452-48487` dla `PATCH`) odsiewa z ciała wyłącznie klucz `_reason` i oddaje CAŁĄ resztę
 * do `updateProduct`, czyli wszystkie 70 kolumn jest zapisywalnych przez każdego zalogowanego.
 * Rozbiór wzorca i historia decyzji: `docs/rebuild-backlog.md` #14. Ten wpis domykamy tu dla
 * produktów — tak jak 3f-2 dla dostawców, 4a dla narzutów i promocji, I11 dla spedycji i configu.
 *
 * ⭐ SKĄD DOKŁADNIE TA LISTA — nie jest wymysłem odbudowy. To zbiór pól, które produkcyjny
 * dialog edycji produktu potrafi wysłać: `LT()`, `deminified/frontend-index.js:24020-24090`.
 * Handler zapisu (`:24107-24124`) wysyła wyłącznie klucze dotknięte przez użytkownika, więc
 * lista jest jednocześnie górną granicą tego, co produkcja realnie zapisuje tą trasą.
 *
 * ⚠ LISTA DECYDUJE TEŻ, CZEGO IMPORT PRZESTANIE NADPISYWAĆ. Trasa zapisuje `manual_overrides`
 * dla KAŻDEGO zmienionego pola (`:48427`), a silnik importu te poprawki respektuje. Pole
 * dopisane tutaj bez potrzeby to pole, które da się przypadkiem zamrozić przed importem.
 *
 * CZEGO TU NIE MA I DLACZEGO:
 *  • WYLICZANE przez import — `marzaPct`, `magazyn`, `magazynRaw`, `eanRaw`, `eanIsValid`,
 *    `eanSourceStatus`, `eanCandidates`, `kodImportu`, `nieobecnoscPodRzad`, `indeksy`,
 *    `indeks1`, `indeks2`, `dostepnosc`, `rodzaj`, `sku`, `zastosowanie`, `reinforced`,
 *    `extraLoad`, `cutResistant`, `heatResistant` oraz cztery wymiary paczki (`dlugosc`,
 *    `szerokoscPaczki`, `wysokosc`, `wysokoscPrzesylki`), które liczy `applyDims`.
 *  • TOŻSAMOŚĆ i pola serwera — `id`, `kod`, `dataAktualizacji`.
 *  • WŁASNE ODBUDOWY — `uwagaCena` (migracja 002). Reguła stała z backlogu #14: kolumny
 *    wyliczane i kolumny własne odbudowy NIGDY nie wchodzą na listę pól edytowalnych.
 *    Jedynym pisarzem `uwagaCena` zostaje import (`acceptStaging` i `POST /api/products`).
 *  • `dostawca` — dialog produkcji renderuje to pole, ale jako `disabled` (`:24028`), więc
 *    nigdy go nie wysyła. Dodatkowo `manual_overrides` kluczuje się po `supplierKod =
 *    produkt.dostawca`: zmiana dostawcy osierociłaby wszystkie własne poprawki produktu.
 *  • `hf`, `ls` — kolumny istnieją w tabeli, ale dialog ich nie ma; nikt ich ręcznie nie edytuje.
 */
export const POLA_EDYTOWALNE_PRODUKTU = [
  // ——— Nagłówek produktu ———
  "nazwa",
  "marka",
  "kategoria",
  "kodDostawcy",
  "stan",
  "vat",
  "cenaZakupu",
  "cenaSprzedazy",
  "ean",
  "status",
  "linkZdjecia",
  // ——— Parametry techniczne ———
  "rozmiar",
  "rozmiarAlternatywny",
  "szerokosc",
  "profil",
  "srednica",
  "konstrukcja",
  "indeksNosnosci",
  "indeksPredkosci",
  "vfIf",
  "pr",
  "tlTt",
  "dot",
  "waga",
  // ⚠ Jedno pole dialogu („Bieznik/model", `:24085`) pisze OBA klucze naraz.
  "model",
  "bieznik",
  "oznaczenieBieznika",
  "sezon",
  "wentyl",
  // ——— Flagi (w dialogu selecty Tak/Nie/—) ———
  "ms",
  "snow3pmsf",
  "cfo",
  "sb",
  "sf",
  "nro",
  "cho",
  "stubbleResistant",
  // ——— Etykieta UE ———
  "labelRolling",
  "labelWet",
  "labelNoise",
  "labelIce",
  "labelSnow",
] as const satisfies readonly (keyof ProduktWewnetrzny)[];

/**
 * Pojedynczy produkt po `id` — port `U.getProduct` (`backend-index.cjs:44722-44724`).
 *
 * Oddaje PEŁNY wiersz (z `uwagaCena`), bo trasa edycji porównuje po nim wartości sprzed
 * zapisu. Do odpowiedzi HTTP idzie dopiero przez `wKontrakcie()`.
 */
export function produktPoId(db: Baza, id: number): ProduktWewnetrzny | null {
  return db.select().from(products).where(eq(products.id, id)).get() ?? null;
}

/**
 * Zawęża pełny wiersz produktu do kształtu, który zna kontrakt.
 *
 * PO CO OSOBNO OD `KOLUMNY_API`: tamta projekcja działa na poziomie zapytania SQL, a tu mamy
 * już gotowy wiersz z pamięci (trasa `PATCH`/`PUT` czyta go, żeby porównać wartości sprzed
 * zapisu). Bez tego `uwagaCena` z migracji 002 wyciekłaby do odpowiedzi 73. kluczem — dokładnie
 * to, przed czym broni `KOLUMNY_POZA_KONTRAKTEM`.
 */
export function wKontrakcie(produkt: ProduktWewnetrzny): Produkt {
  const kopia = { ...produkt } as Record<string, unknown>;
  for (const ukryta of KOLUMNY_POZA_KONTRAKTEM.products) delete kopia[ukryta];
  return kopia as Produkt;
}

/** Klucz z listy pól edytowalnych — dla typowania patcha trasy `PATCH`/`PUT`. */
export type PoleEdytowalneProduktu = (typeof POLA_EDYTOWALNE_PRODUKTU)[number];

/**
 * Ciało żądania przepuszczone przez `POLA_EDYTOWALNE_PRODUKTU`.
 *
 * Ten sam wzorzec co `odsiejPolaEdytowalne()` dla dostawców (3f-2): filtr mieszka w repo,
 * a nie w trasie, żeby lista pól i jej użycie stały obok siebie.
 */
export function odsiejPolaEdytowalneProduktu(
  cialo: unknown,
): Partial<Pick<ProduktWewnetrzny, PoleEdytowalneProduktu>> {
  return odsiejPola(cialo, POLA_EDYTOWALNE_PRODUKTU) as Partial<
    Pick<ProduktWewnetrzny, PoleEdytowalneProduktu>
  >;
}
