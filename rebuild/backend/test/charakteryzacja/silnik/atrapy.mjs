// Pamięciowe atrapy warstwy danych dla ORYGINALNEGO `tk()` wyciętego z bundla.
//
// Odtwarzają zachowanie `U.*` z `deminified/backend-index.cjs:44695-44950` na tyle wiernie,
// na ile `tk()` je widzi — łącznie z dwoma efektami, które łatwo przeoczyć:
//
//   • `addStaging` (:44923) NIE jest zwykłym insertem — deduplikuje po
//     (kod, typ_zmiany, COALESCE(powod,'')) i przy trafieniu zwraca istniejący wiersz
//     BEZ zapisu. To jedyne miejsce, w którym oryginał chroni się przed powtórzeniem
//     tej samej pozycji przy ponownym imporcie tego samego cennika.
//   • `updateProduct` (:44728) przy patchu ruszającym cenę i bez jawnego `status`
//     dokłada `status: "wstrzymany"`, gdy wynikowa cena wynosi 0.
//
// `tk()` w zakresie 3c woła `updateProduct` wyłącznie z `{ nieobecnoscPodRzad: 0 }`, więc ten
// drugi efekt się tu nie uruchamia — ale atrapa go ma, bo w 3d ta sama ścieżka pójdzie już
// z cenami z gałęzi auto-zatwierdzania.

/**
 * @param {object} opcje
 * @param {Array<Record<string, unknown>>} opcje.produkty  katalog widziany przez listProducts()
 * @param {Array<Record<string, unknown>>} [opcje.overrides] wynik getOverridesFor(); 3c jedzie
 *   na pustej liście, bo `Gq()` jest w tej sesji przepuszczającym stubem (plan.md D6).
 *   To ten jeden przełącznik, który przestawi 3d.
 */
export function stworzAtrapy({ produkty, overrides = [] }) {
  const staging = [];
  const skasowane = [];
  const aktualizacje = [];
  let nastepneIdStagingu = 1;

  /** Ile razy `tk()` przeszło po liście produktów — musi skończyć na 2. */
  let przejsc = 0;
  /** Indeks w `aktualizacje`, od którego zaczyna się pętla wycofań (zakres 3d). */
  let granicaWycofan = null;

  /**
   * Lista produktów, która LICZY, ile razy ktoś po niej przeszedł.
   *
   * PO CO: `tk()` woła `U.listProducts()` raz (`:47598`) i przechodzi po wyniku DOKŁADNIE DWA
   * RAZY — najpierw budując mapy dopasowania (`:47601`, zakres 3c), a po pętli głównej jeszcze
   * raz w pętli wycofań (`:47808`, zakres 3d). Obie pętle wołają `updateProduct` z patchem
   * `{ nieobecnoscPodRzad: … }`, a reset z dopasowania (`:47702`) jest NIEODRÓŻNIALNY po
   * kształcie od resetu z wycofania przy trzeciej nieobecności — oba to
   * `{ nieobecnoscPodRzad: 0 }`.
   *
   * Początek drugiego przejścia jest więc granicą faz i tylko stąd da się ją poznać, nie ruszając
   * kodu oryginału.
   *
   * Klasa powstaje WEWNĄTRZ funkcji, żeby licznik siedział w domknięciu: `:47598` robi
   * `U.listProducts().filter(...)`, a `filter` na podklasie Array zwraca (przez
   * ArraySpeciesCreate) NOWĄ instancję tej podklasy — pole instancji by nie przeżyło, domknięcie
   * przeżywa. `filter`/`map`/`findIndex` chodzą po indeksach, nie po iteratorze, więc nie
   * podbijają licznika.
   *
   * To OBSERWACJA, nie zmiana zachowania: iterator zwraca dokładnie to samo, co zwróciłby Array.
   */
  class ListaProduktow extends Array {
    [Symbol.iterator]() {
      przejsc += 1;
      if (przejsc === 2) granicaWycofan = aktualizacje.length;
      return super[Symbol.iterator]();
    }
  }

  const katalog = new ListaProduktow();
  for (const produkt of produkty) katalog.push({ ...produkt });

  const poId = new Map();
  for (const produkt of katalog) poId.set(produkt.id, produkt);
  // Powyższa pętla przeszła po liście — to NIE jest przejście `tk()`, więc licznik zerujemy.
  przejsc = 0;

  const U = {
    listProducts() {
      return katalog;
    },

    getProduct(id) {
      return poId.get(id) ?? null;
    },

    updateProduct(id, patch) {
      let doZapisu = patch;
      if (("cenaSprzedazy" in patch || "cenaZakupu" in patch) && !("status" in patch)) {
        const biezacy = this.getProduct(id);
        const cs =
          "cenaSprzedazy" in patch ? Number(patch.cenaSprzedazy) : Number(biezacy?.cenaSprzedazy);
        const cz = "cenaZakupu" in patch ? Number(patch.cenaZakupu) : Number(biezacy?.cenaZakupu);
        if (cs === 0 || cz === 0) doZapisu = { ...patch, status: "wstrzymany" };
      }
      aktualizacje.push({ id, patch: { ...doZapisu } });
      const produkt = poId.get(id);
      if (produkt) Object.assign(produkt, doZapisu);
      return produkt ?? null;
    },

    deleteProduct(id) {
      if (!poId.has(id)) return false;
      skasowane.push(id);
      poId.delete(id);
      const i = katalog.findIndex((p) => p.id === id);
      if (i !== -1) katalog.splice(i, 1);
      return true;
    },

    addStaging(pozycja) {
      const powod = pozycja.powod ?? "";
      const istniejaca = staging.find(
        (w) =>
          w.kod === pozycja.kod && w.typZmiany === pozycja.typZmiany && (w.powod ?? "") === powod,
      );
      if (istniejaca) return istniejaca;
      const wiersz = { id: nastepneIdStagingu++, ...pozycja };
      staging.push(wiersz);
      return wiersz;
    },

    getOverridesFor() {
      return overrides;
    },
  };

  const ww = {
    transaction: (fn) => fn,
    prepare: () => ({ run: () => undefined }),
  };

  const __BRIDGE_EXT = {
    applyDims: () => undefined,
    applyLinkMemory: () => undefined,
  };

  return {
    zaleznosci: { U, ww, __BRIDGE_EXT, Qi: null },
    /** Wiersze przekazane do `U.addStaging` — po deduplikacji, w kolejności zapisu. */
    staging,
    /** `products.id` skasowane przez gałąź nie-opony (`:47689`). */
    skasowane,
    /** Wywołania `updateProduct` w kolejności; granica faz w `granicaWycofan()`. */
    aktualizacje,
    /**
     * Dzieli `aktualizacje` na fazę pętli głównej (zakres 3c: reset `nieobecnoscPodRzad`
     * przy dopasowaniu + efekty auto-zatwierdzania) i fazę wycofań (zakres 3d).
     */
    fazyAktualizacji() {
      if (przejsc !== 2) {
        throw new Error(
          `Oryginalne tk() przeszło po liście produktów ${przejsc} razy zamiast 2 — ` +
            "układ pętli w bundlu się zmienił i granica faz jest nie do wyznaczenia.",
        );
      }
      return {
        petlaGlowna: aktualizacje.slice(0, granicaWycofan),
        petlaWycofan: aktualizacje.slice(granicaWycofan),
      };
    },
  };
}
