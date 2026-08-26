import type { Baza } from "../db/index.js";
import { zapiszPozycjeStagingu, type NowaPozycjaStagingu } from "../repos/staging.js";
import type { RekordSurowy } from "./typy.js";

/** Pozycja listy `szczegolyOdrzuconych` (backend-index.cjs:47627-47630). */
export type SzczegolOdrzucenia = {
  nazwa: string;
  powod: string;
};

/**
 * Statystyki przebiegu importu — obiekt `i` z `tk()` (backend-index.cjs:47586-47597).
 *
 * To NIE jest nasz wymysł ani wewnętrzna struktura: endpointy importu wstawiają go
 * wprost do ciała odpowiedzi przez `...tkResult` (extensions.cjs:180-188, :271-277),
 * więc jego zestaw kluczy jest częścią kontraktu HTTP.
 */
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
  szczegolyOdrzuconych: SzczegolOdrzucenia[];
};

/**
 * Szew, w który 3c wstawi pełny port `tk()`.
 *
 * Sygnatura jest dokładnie taka jak w oryginale: `tk(dostawca, surowe)` — jedno wejście
 * (kod dostawcy + rekordy po adapterze), jedno wyjście (statystyki), a efektem ubocznym
 * jest zapis do stagingu. Cała reszta backendu (trasy importu) zna wyłącznie ten typ,
 * więc podmiana implementacji nie wymaga zmian poza tym plikiem.
 */
export type SilnikStagingu = (kodDostawcy: string, surowe: RekordSurowy[]) => StatystykiImportu;

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

/**
 * Filtr śmieciowych pozycji MO2 — port 1:1 z bloku `/*MO2_JUNK_FILTER*\/`
 * (backend-index.cjs:47619-47634).
 *
 * Jedyny fragment `tk()`, który nie zależy od NICZEGO poza samym rekordem: ani od katalogu,
 * ani od `Zc`/`Hq`/`Gq`/`Lq`. Dlatego wchodzi już tutaj — odtworzenie go nic nie kosztuje,
 * a bez niego licznik `odrzuconeSmieciMO2` byłby martwy.
 *
 * Reguła: pozycja MO2 o kodzie `999991` (po zdjęciu prefiksu `MO2_`) jest śmieciem, gdy
 * brakuje jej EAN-u ALBO marka jest pusta, ALBO marka wygląda jak rozmiar (są cyfry,
 * a nie ma trzech liter z rzędu).
 */
function jestSmieciemMO2(kodDostawcy: string, rekord: RekordSurowy): boolean {
  if (String(kodDostawcy || "").toUpperCase() !== "MO2") return false;

  const kod = String(rekord.kod ?? "")
    .trim()
    .replace(/^MO2_/i, "");
  if (!/^999991$/.test(kod)) return false;

  // Oryginał sięga po `ean_raw` i `producent` — pól, których `RekordSurowy` nie deklaruje,
  // bo adapter ich nie produkuje. Zachowujemy odczyt, żeby port pozostał wierny na wypadek
  // rekordu z szerszym kształtem (np. po zmianie adaptera u Ani).
  const luzny = rekord as unknown as Record<string, unknown>;
  const ean = String((rekord.ean ?? luzny.ean_raw ?? "") as string).replace(/\s+/g, "");
  const marka = String((rekord.marka ?? luzny.producent ?? "") as string).trim();

  const markaWygladaJakRozmiar = marka !== "" && /[0-9]/.test(marka) && !/[A-Za-z]{3,}/.test(marka);
  return ean === "" || marka === "" || markaWygladaJakRozmiar;
}

/**
 * ⚠ IMPLEMENTACJA TYMCZASOWA — ŚWIADOMIE NIEWIERNA (plan.md D2).
 *
 * Iteracja 3b dowozi BRZEGI importu: HTTP, pobranie pliku, archiwum, zapis do stagingu,
 * odczyt. Sam silnik dopasowania (`tk()`, backend-index.cjs:47584-47851) należy do 3c,
 * bo wymaga pięciu funkcji, których jeszcze nie przeportowano:
 *
 *   • `Zc()` — klasyfikator „czy to opona"; bez niego licznik `odrzuconeNieOpony` zostaje 0,
 *              a pozycje nie-opony przechodzą do stagingu, zamiast być odrzucone
 *   • `Hq()` — normalizacja EAN; produkuje `eanRaw`, `eanIsValid`, `eanSourceStatus`,
 *              `eanCandidates` oraz `rozmiarWykryty`. Bez niej te pola są NULLEM, a `snapshotJson`
 *              nie zawiera ich wcale (oryginał serializuje rekord PO `Hq()`)
 *   • `Gq()` — poprawki Marty (overrides); bez nich plik dostawcy nie jest z nimi konfrontowany
 *   • `Lq()` — identyfikator zastępczy dla rekordu bez kodu i bez EAN-u
 *   • `Kq()` — wykrywanie błędnego zapisu nazwy (składnik `ostrzezenie`)
 *
 * Czego jeszcze NIE ROBI, bo to wymaga porównania z katalogiem (3c) i historii (3d):
 * dopasowania kod→EAN, klasyfikacji `zmiana_kluczowa`/`blad`, wycofań po trzech
 * nieobecnościach, auto-zatwierdzania cen i zapisu do `historia_cen`. Dlatego
 * `odrzuconeNieOpony`, `zmienione`, `wycofane`, `bezZmian` i `autoZatwierdzone`
 * zostają zerami, a każda przyjęta pozycja ma `typZmiany: "nowa"`.
 *
 * Co ODTWARZA wiernie: filtr śmieci MO2, użycie EAN-u jako identyfikatora przy braku kodu
 * (`extensions`/`tk` :47643-47645) wraz z towarzyszącym ostrzeżeniem, odrzucenie rekordu
 * bez kodu i bez EAN-u jako `odrzuconeBrakDanych`, jeden znacznik `utworzono` na cały
 * przebieg oraz zapis wsadowy w JEDNEJ transakcji.
 */
export function silnikStagingu3b(db: Baza): SilnikStagingu {
  return (kodDostawcy, surowe) => {
    const statystyki = pusteStatystyki();
    // Jeden znacznik czasu dla całego przebiegu — jak `let n = ...` na wejściu do `tk()`.
    const utworzono = new Date().toISOString();
    const doZapisu: NowaPozycjaStagingu[] = [];

    for (const rekord of surowe) {
      if (jestSmieciemMO2(kodDostawcy, rekord)) {
        statystyki.odrzuconeSmieciMO2 += 1;
        statystyki.szczegolyOdrzuconych.push({
          nazwa: String(rekord.nazwa || "(bez nazwy)"),
          powod:
            "smieciowa pozycja MO2 (kod 999991 + brak EAN lub marka=rozmiar) " +
            "- odrzucona przy imporcie",
        });
        continue;
      }

      const kodZRekordu = rekord.kod == null ? "" : String(rekord.kod).trim();
      const eanZRekordu = rekord.ean == null ? "" : String(rekord.ean).trim();

      let kod = kodZRekordu;
      let uzytoEanJakoId = false;
      if (!kod) {
        if (eanZRekordu) {
          kod = eanZRekordu;
          uzytoEanJakoId = true;
        } else {
          // Oryginał próbowałby tu jeszcze `Zc()` + `Lq()` (identyfikator techniczny).
          // Bez nich odrzucamy — tak samo, jak oryginał odrzuca, gdy `Lq()` nic nie zwróci.
          statystyki.odrzuconeBrakDanych += 1;
          statystyki.szczegolyOdrzuconych.push({
            nazwa: String(rekord.nazwa || "(bez nazwy)"),
            powod: "brak identyfikatora i za malo danych produktu",
          });
          continue;
        }
      }

      const ostrzezenie = uzytoEanJakoId
        ? "brak kodu dostawcy - uzyto EAN jako identyfikatora"
        : null;

      statystyki.nowe += 1;
      doZapisu.push({
        typZmiany: "nowa",
        kod,
        nazwa: rekord.nazwa || "",
        dostawca: kodDostawcy,
        magazyn: rekord.magazyn || "—",
        magazynRaw: rekord.magazynRaw ?? null,
        stanStary: null,
        stanNowy: rekord.stan ?? 0,
        cenaZakupuStara: null,
        cenaZakupuNowa: rekord.cenaZakupu ?? 0,
        cenaSprzedazyNowa: rekord.cenaSprzedazy ?? null,
        zmianaPct: null,
        ostrzezenie,
        powod: "Nowa pozycja w cenniku" + (ostrzezenie ? ` • ${ostrzezenie}` : ""),
        snapshotJson: JSON.stringify(rekord),
        // Cała rodzina `ean*` powstaje w `Hq()` (3c) — do tego czasu NULL.
        eanRaw: null,
        eanIsValid: null,
        eanSourceStatus: null,
        eanCandidates: null,
        edytowanePola: null,
        utworzono,
      });
    }

    statystyki.doStagingu = zapiszPozycjeStagingu(db, doZapisu);
    return statystyki;
  };
}
