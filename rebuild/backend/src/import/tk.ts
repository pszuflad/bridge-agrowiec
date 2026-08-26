import type { Baza } from "../db/index.js";
import {
  aktualizujProdukt,
  katalogDoImportu,
  usunProdukt,
  type ProduktWewnetrzny,
} from "../repos/products.js";
import { zapiszPozycjeStagingu, type NowaPozycjaStagingu } from "../repos/staging.js";
import { zapiszHistorieCen } from "../repos/historia.js";
import { czyOpona } from "./silnik/klasyfikator.js";
import { identyfikatorTechniczny } from "./silnik/identyfikator.js";
import { poprawkiMarty } from "./silnik/overrides.js";
import { applyDims, applyLinkMemory, uchwytSqlite } from "./silnik/bridge-ext.js";
import {
  bladZapisuNazwy,
  POLA_ROZNIC,
  wartosciRowne,
  znormalizujPozycje,
  type PozycjaZnormalizowana,
} from "./silnik/pozycja.js";
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
 * Silnik stagingu — sygnatura dokładnie jak w oryginale: `tk(dostawca, surowe)`. Jedno wejście
 * (kod dostawcy + rekordy po adapterze), jedno wyjście (statystyki), efektem ubocznym jest
 * zapis do stagingu i mutacje katalogu. Trasy importu znają wyłącznie ten typ.
 */
export type SilnikStagingu = (kodDostawcy: string, surowe: RekordSurowy[]) => StatystykiImportu;

/**
 * Import bez ani jednej pozycji — ŚWIADOME ODSTĘPSTWO od oryginału (plan.md D7).
 *
 * Produkcja puszcza pusty wsad prosto do `tk()`. Skutek: każda pozycja dostawcy dostaje +1 do
 * `nieobecnosc_pod_rzad`, a po trzech takich przebiegach cały jego katalog zostaje wycofany
 * (backlog #8). W 3b bezpiecznik siedział w trasach importu i nie zakrywał
 * `POST /api/staging/import` (backend-index.cjs:48502-48512), który bierze pozycje wprost
 * z ciała żądania. Tutaj zakrywa wszystkie wejścia naraz — także trasę, która powstanie w 3d.
 */
export class PustyImportBlad extends Error {
  constructor(kodDostawcy: string) {
    super(
      `Nie ma ani jednej pozycji do zaimportowania dla ${kodDostawcy} — import przerwany. ` +
        `Sprawdź, czy plik ma właściwy format.`,
    );
    this.name = "PustyImportBlad";
  }
}

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

/** Odczyt pola po nazwie — `Vq`/`_KP` adresują pola dynamicznie, jak oryginał. */
const pole = (obiekt: object, klucz: string): unknown =>
  (obiekt as Record<string, unknown>)[klucz];

/**
 * Pola, których zmiana czyni z pozycji `zmiana_kluczowa` — `_KP` (backend-index.cjs:47751).
 * To one opisują TOŻSAMOŚĆ opony; zmiana czegokolwiek z tej listy wymaga oka człowieka.
 */
const POLA_KLUCZOWE = [
  "rozmiar",
  "indeksNosnosci",
  "indeksPredkosci",
  "model",
  "marka",
  "nazwa",
  "kodDostawcy",
];

/**
 * Ile kolejnych importów bez pozycji w cenniku kończy się wycofaniem —
 * `WYCOFANIE_PROG_IMPORTOW` (backend-index.cjs:47807).
 *
 * Liczą się nieobecności POD RZĄD: każde dopasowanie zeruje licznik (`:47702`), więc
 * produkt znikający naprzemiennie nigdy nie dojdzie do progu.
 */
const WYCOFANIE_PROG_IMPORTOW = 3;

/**
 * Silnik dopasowania i klasyfikacji — port żywego `tk = function` (backend-index.cjs:47584-47851).
 *
 * ⚠ W oryginale są DWIE definicje `tk`. Ta z `:47378` (`function tk`) jest MARTWA — nadpisuje
 * ją późniejsze przypisanie z `:47584`. Różnią się realnie (martwa nie ma mapy EAN ani
 * konfliktów EAN, ma inny skład `_KP` i regułę auto-aktualizacji EAN, której żywa nie ma),
 * więc port idzie WYŁĄCZNIE za żywą. Szczegóły i konsekwencje dla `docs/spec-backend.md` §5:
 * raport ticketa, sekcja D4.
 *
 * ZAKRES: od 3d-1 silnik jest KOMPLETNY — dopasowanie i klasyfikacja (3c) plus skutki:
 * auto-zatwierdzanie z zapisem do produktu i `historia_cen` (`:47791-47806`), pętla wycofań
 * po trzech nieobecnościach (`:47807-47847`) i realne poprawki Marty przez `Gq()` (`:47319`).
 *
 * Poza tym plikiem zostaje `acceptStaging` (sesja 3d-2) — czyli to, co dzieje się, gdy
 * człowiek zatwierdzi pozycję ze stagingu.
 */
export function silnikStagingu(db: Baza): SilnikStagingu {
  const zastosujPoprawkiMarty = poprawkiMarty(db);
  // Surowy uchwyt drivera dla `bridge_ext` — odpowiednik `Qi` z oryginału (`:47795`).
  const sqlite = uchwytSqlite(db);

  return (kodDostawcy, surowe) => {
    // ODSTĘPSTWO D7 — patrz `PustyImportBlad`.
    if (surowe.length === 0) throw new PustyImportBlad(kodDostawcy);

    const statystyki = pusteStatystyki();
    // Jeden znacznik czasu dla całego przebiegu — `let n = ...` na wejściu do `tk()` (:47585).
    const utworzono = new Date().toISOString();

    // ——— Mapy dopasowania (:47598-47615) ———
    const katalog = katalogDoImportu(db, kodDostawcy);
    const poKodzie = new Map<string, ProduktWewnetrzny>();
    const poEanie = new Map<string, ProduktWewnetrzny | null>();
    /**
     * EAN-y występujące w katalogu więcej niż raz. `poEanie` dostaje wtedy `null` (dopasowanie
     * po takim EAN-ie jest niejednoznaczne, więc nie następuje), a tutaj lądują WSZYSTKIE
     * kolidujące produkty — łącznie z pierwszym, żeby ostrzeżenie mogło je wymienić.
     */
    const konfliktyEan = new Map<string, ProduktWewnetrzny[]>();

    for (const produkt of katalog) {
      if (produkt.kod) poKodzie.set(String(produkt.kod), produkt);
      if (produkt.ean) {
        const ean = String(produkt.ean).trim();
        if (ean) {
          if (!poEanie.has(ean)) {
            poEanie.set(ean, produkt);
          } else {
            const poprzedni = poEanie.get(ean);
            poEanie.set(ean, null);
            if (!konfliktyEan.has(ean)) konfliktyEan.set(ean, poprzedni ? [poprzedni] : []);
            konfliktyEan.get(ean)!.push(produkt);
          }
        }
      }
    }

    const dopasowaneId = new Set<number>();
    const doZapisu: NowaPozycjaStagingu[] = [];

    for (const rekord of surowe) {
      let pozycjaWejsciowa = rekord as unknown as PozycjaZnormalizowana;

      // ——— Filtr śmieci MO2 (:47619-47634) ———
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

      // ——— Dopasowanie: najpierw po kodzie, potem po EAN-ie (:47635-47642) ———
      const kodZCennika = rekord.kod == null ? "" : String(rekord.kod).trim();
      const eanZCennika = rekord.ean == null ? "" : String(rekord.ean).trim();

      const poKodzieTrafiony = kodZCennika ? poKodzie.get(kodZCennika) : null;
      const poEanieTrafiony =
        !poKodzieTrafiony && eanZCennika ? poEanie.get(eanZCennika) : null;

      let dopasowany: ProduktWewnetrzny | null = poKodzieTrafiony || poEanieTrafiony || null;
      let uzytoEanJakoId = false;
      let uzytoIdTechnicznego = false;

      // ——— Łańcuch identyfikatora, gdy cennik nie podał kodu (:47643-47671) ———
      if (!kodZCennika) {
        const zPodmienionymKodem: PozycjaZnormalizowana = { ...pozycjaWejsciowa };

        if (dopasowany?.kod) {
          zPodmienionymKodem.kod = String(dopasowany.kod);
        } else if (eanZCennika) {
          zPodmienionymKodem.kod = eanZCennika;
          uzytoEanJakoId = true;
        } else {
          const ocena = czyOpona(rekord.nazwa || "", rekord.kategoria);
          if (ocena.isTire) {
            zPodmienionymKodem.kod = identyfikatorTechniczny(kodDostawcy, {
              ...rekord,
              nazwa: rekord.nazwa || rekord.rozmiar || rekord.model || rekord.marka || "opona",
            });
            uzytoIdTechnicznego = Boolean(zPodmienionymKodem.kod);
            if (!zPodmienionymKodem.kod) {
              statystyki.odrzuconeBrakDanych += 1;
              statystyki.szczegolyOdrzuconych.push({
                nazwa: String(rekord.nazwa || "(bez nazwy)"),
                powod: "brak identyfikatora i za malo danych produktu",
              });
              continue;
            }
          } else {
            statystyki.odrzuconeBrakDanych += 1;
            statystyki.szczegolyOdrzuconych.push({
              nazwa: String(rekord.nazwa || "(bez nazwy)"),
              powod: "brak identyfikatora i za malo danych produktu",
            });
            continue;
          }
        }

        pozycjaWejsciowa = zPodmienionymKodem;
      }

      // ——— Poprawki Marty, potem klasyfikator „czy opona" (:47673-47681) ———
      const kluczOverride = dopasowany?.kod
        ? String(dopasowany.kod)
        : String(pozycjaWejsciowa.kod || "");
      const {
        pozycja: zPoprawkami,
        naruszono,
        srcVals,
      } = zastosujPoprawkiMarty(kodDostawcy, { ...pozycjaWejsciowa, kod: kluczOverride });

      const ocena = czyOpona(zPoprawkami.nazwa || "", zPoprawkami.kategoria);

      // ——— Nie-opona: odrzucenie i SKASOWANIE produktu z katalogu (:47683-47690) ———
      if (!ocena.isTire) {
        statystyki.odrzuconeNieOpony += 1;
        statystyki.szczegolyOdrzuconych.push({
          nazwa: `${zPoprawkami.kod} — ${zPoprawkami.nazwa || ""}`,
          powod: `nie opona (${ocena.reason})`,
        });

        const doSkasowania = dopasowany || poKodzie.get(String(pozycjaWejsciowa.kod));
        if (doSkasowania) {
          usunProdukt(db, doSkasowania.id);
          poKodzie.delete(String(doSkasowania.kod));
          if (doSkasowania.ean) poEanie.delete(String(doSkasowania.ean));
        }
        continue;
      }

      // ——— Normalizacja EAN-u, magazynu i rozmiaru (:47692-47696) ———
      const { poz: znormalizowana, eanInfo, rozmiarWykryty } = znormalizujPozycje(zPoprawkami);

      // Drugie podejście do dopasowania — tym razem po EAN-ie PO normalizacji (:47698-47700).
      if (!dopasowany && znormalizowana.ean) {
        const poZnormalizowanymEanie = poEanie.get(String(znormalizowana.ean));
        if (poZnormalizowanymEanie) dopasowany = poZnormalizowanymEanie;
      }

      // ——— Reset licznika nieobecności przy dopasowaniu (:47701-47703) ———
      if (dopasowany?.id != null) {
        dopasowaneId.add(dopasowany.id);
        if (dopasowany.nieobecnoscPodRzad > 0) {
          aktualizujProdukt(db, dopasowany.id, { nieobecnoscPodRzad: 0 });
        }
      }

      // ——— Składniki ostrzeżenia (:47704-47712) ———
      const skladnikiOstrzezenia: string[] = [];
      const bladNazwy = bladZapisuNazwy(zPoprawkami.nazwa || znormalizowana.nazwa || "");

      if (uzytoIdTechnicznego) {
        skladnikiOstrzezenia.push("brak kodu dostawcy i EAN - uzyto identyfikatora technicznego");
      }
      if (!uzytoIdTechnicznego && uzytoEanJakoId) {
        skladnikiOstrzezenia.push("brak kodu dostawcy - uzyto EAN jako identyfikatora");
      }
      if (eanInfo && eanInfo.eanSourceStatus !== "ok") {
        skladnikiOstrzezenia.push(
          `EAN: ${eanInfo.eanSourceStatus}` +
            (eanInfo.eanValidationError ? ` (${eanInfo.eanValidationError})` : ""),
        );
      }
      if (!rozmiarWykryty) {
        skladnikiOstrzezenia.push("nie wykryto rozmiaru opony (sprawdz recznie)");
      }
      if (bladNazwy) skladnikiOstrzezenia.push(`bledny zapis nazwy: ${bladNazwy}`);
      if (naruszono.length > 0) {
        skladnikiOstrzezenia.push(`plik nadpisuje poprawke Marty: ${naruszono.join(", ")}`);
      }

      const konfliktEan =
        !dopasowany && eanZCennika && konfliktyEan.has(eanZCennika)
          ? konfliktyEan.get(eanZCennika)!
          : null;

      if (konfliktEan) {
        skladnikiOstrzezenia.push(
          `Konflikt EAN — ten EAN (${eanZCennika}) istnieje juz w bazie pod innymi pozycjami: ` +
            `${konfliktEan.map((p) => `${p.kod} "${p.nazwa || ""}"`).join(", ")}. ` +
            `Sprawdz recznie czy to duplikat tej samej opony.`,
        );
      }

      const ostrzezenie = skladnikiOstrzezenia.length ? skladnikiOstrzezenia.join(" • ") : null;

      // ——— Pozycja spoza katalogu: `nowa` albo `blad` (:47714-47738) ———
      if (!dopasowany) {
        statystyki.nowe += 1;

        // `d.eanIsValid === false` jest w praktyce MARTWE: `znormalizujPozycje()` zapisuje
        // w tym polu 1 albo 0, nigdy boolean. Odtwarzamy warunek dosłownie.
        const wymagaSprawdzenia =
          ((znormalizowana.eanIsValid as unknown) === false ||
            Boolean(bladNazwy) ||
            !rozmiarWykryty ||
            Boolean(uzytoIdTechnicznego) ||
            Boolean(konfliktEan));

        const powodBazowy = wymagaSprawdzenia
          ? "Nowa pozycja wymaga sprawdzenia"
          : "Nowa pozycja w cenniku";

        doZapisu.push({
          typZmiany: wymagaSprawdzenia ? "blad" : "nowa",
          kod: String(pozycjaWejsciowa.kod),
          nazwa: znormalizowana.nazwa || "",
          dostawca: kodDostawcy,
          magazyn: znormalizowana.magazyn || "—",
          magazynRaw: znormalizowana.magazynRaw ?? null,
          stanStary: null,
          stanNowy: znormalizowana.stan ?? 0,
          cenaZakupuStara: null,
          cenaZakupuNowa: znormalizowana.cenaZakupu ?? 0,
          cenaSprzedazyNowa: znormalizowana.cenaSprzedazy ?? null,
          zmianaPct: null,
          ostrzezenie,
          powod: powodBazowy + (ostrzezenie ? ` • ${ostrzezenie}` : ""),
          snapshotJson: JSON.stringify(znormalizowana),
          eanRaw: znormalizowana.eanRaw ?? null,
          eanIsValid: znormalizowana.eanIsValid ?? null,
          eanSourceStatus: znormalizowana.eanSourceStatus ?? null,
          eanCandidates: znormalizowana.eanCandidates ?? null,
          edytowanePola: null,
          utworzono,
        });
        continue;
      }

      // ——— Pozycja istniejąca: budowa listy różnic do `powod` (:47739-47761) ———
      const roznice: string[] = [];

      if (naruszono.length > 0) {
        roznice.push(
          `konflikt z poprawka Marty — ZOSTANIE ZACHOWANA wartosc Marty, plik NIE nadpisuje ` +
            `(pole(a): ${naruszono
              .map(
                (nazwaPola) =>
                  `${nazwaPola}: baza/Marta="${pole(zPoprawkami, nazwaPola) ?? "—"}" ` +
                  `vs plik dostawcy="${srcVals[nazwaPola] ?? "—"}"`,
              )
              .join("; ")}). Po akceptacji: wartosc z pliku zostanie zapamietana jako ` +
            `potwierdzona, wiec ten sam konflikt nie pojawi sie ponownie przy nastepnym ` +
            `imporcie — ale sama wartosc produktu NIE zmieni sie.`,
        );
        znormalizowana._srcConflict = srcVals || {};
      }

      for (const { key, label } of POLA_ROZNIC) {
        const stara = pole(dopasowany, key);
        const nowa = pole(znormalizowana, key);

        // ⚠ Trzy powody pominięcia różnicy, w tym jeden zaskakujący: uzupełnienie pola, które
        // wcześniej było puste, NIE jest raportowane jako zmiana. Klasyfikacja i tak je złapie
        // przez `POLA_KLUCZOWE`, ale w `powod` się nie pojawi.
        const staraPusta = stara == null || stara === "";
        const nowaPusta = nowa == null || nowa === "";
        if (staraPusta && !nowaPusta) continue;
        if (nowaPusta && !staraPusta) continue;
        if (wartosciRowne(stara, nowa)) continue;

        roznice.push(`${label}: ${stara || "—"} → ${nowa || "—"}`);
      }

      // ——— Klasyfikacja zmiany (:47751-47764) ———
      const zmianaKluczowa = POLA_KLUCZOWE.some((klucz) => {
        const stara = pole(dopasowany!, klucz);
        const nowa = pole(znormalizowana, klucz);
        if ((stara == null || stara === "") && (nowa == null || nowa === "")) return false;
        return String(stara ?? "") !== String(nowa ?? "");
      });

      // ⚠ Pierwszy człon jest martwy w obie strony: `eanIsValid` to 1/0 po stronie pozycji
      // i number|null po stronie produktu, więc żadne z porównań z `false` nie wypali.
      const wymagaSprawdzenia =
        ((znormalizowana.eanIsValid as unknown) === false &&
          (dopasowany.eanIsValid as unknown) !== false) ||
        Boolean(bladNazwy) ||
        !rozmiarWykryty ||
        Boolean(uzytoIdTechnicznego) ||
        naruszono.length > 0;

      // Auto-patch: pola, które oryginał zatwierdza BEZ pytania (:47760-47764).
      // 3c go LICZY, ale nie stosuje — patrz gałąź `else if` niżej (plan.md D5).
      const autoPatch: Record<string, unknown> = {};
      if (
        znormalizowana.cenaZakupu != null &&
        !wartosciRowne(dopasowany.cenaZakupu, znormalizowana.cenaZakupu)
      ) {
        autoPatch.cenaZakupu = znormalizowana.cenaZakupu;
      }
      if (
        znormalizowana.cenaSprzedazy != null &&
        !wartosciRowne(dopasowany.cenaSprzedazy, znormalizowana.cenaSprzedazy)
      ) {
        autoPatch.cenaSprzedazy = znormalizowana.cenaSprzedazy;
      }
      if (
        znormalizowana.marzaPct != null &&
        !wartosciRowne(dopasowany.marzaPct, znormalizowana.marzaPct)
      ) {
        autoPatch.marzaPct = znormalizowana.marzaPct;
      }
      if (znormalizowana.stan != null && !wartosciRowne(dopasowany.stan, znormalizowana.stan)) {
        autoPatch.stan = znormalizowana.stan;
      }
      if (
        znormalizowana.magazyn != null &&
        !wartosciRowne(dopasowany.magazyn, znormalizowana.magazyn)
      ) {
        autoPatch.magazyn = znormalizowana.magazyn;
      }
      // ⚠ Żywy `tk()` NIE aktualizuje tu EAN-u. Reguła „8/12/13/14 cyfr i nie kończy się
      // pięcioma zerami", którą podaje `docs/spec-backend.md` §5, siedzi w MARTWEJ
      // `function tk` (:47499-47512) i w produkcji nigdy się nie wykonuje (raport, D4).

      if (zmianaKluczowa || wymagaSprawdzenia) {
        statystyki.zmienione += 1;

        const zmianaPct =
          znormalizowana.cenaZakupu !== undefined &&
          znormalizowana.cenaZakupu !== null &&
          dopasowany.cenaZakupu > 0
            ? ((znormalizowana.cenaZakupu - dopasowany.cenaZakupu) / dopasowany.cenaZakupu) * 100
            : null;

        doZapisu.push({
          typZmiany: wymagaSprawdzenia ? "blad" : "zmiana_kluczowa",
          kod: String(dopasowany.kod || pozycjaWejsciowa.kod),
          nazwa: znormalizowana.nazwa || dopasowany.nazwa,
          dostawca: kodDostawcy,
          magazyn: znormalizowana.magazyn || dopasowany.magazyn,
          magazynRaw: znormalizowana.magazynRaw ?? dopasowany.magazynRaw ?? null,
          stanStary: dopasowany.stan,
          stanNowy: znormalizowana.stan ?? dopasowany.stan,
          cenaZakupuStara: dopasowany.cenaZakupu,
          cenaZakupuNowa: znormalizowana.cenaZakupu ?? dopasowany.cenaZakupu,
          cenaSprzedazyNowa: znormalizowana.cenaSprzedazy ?? null,
          zmianaPct,
          ostrzezenie,
          powod:
            (roznice.length ? roznice.join(" • ") : "Wymaga sprawdzenia") +
            (ostrzezenie ? ` • ${ostrzezenie}` : ""),
          snapshotJson: JSON.stringify(znormalizowana),
          eanRaw: znormalizowana.eanRaw ?? null,
          eanIsValid: znormalizowana.eanIsValid ?? null,
          eanSourceStatus: znormalizowana.eanSourceStatus ?? null,
          eanCandidates: znormalizowana.eanCandidates ?? null,
          edytowanePola: null,
          utworzono,
        });
      } else if (Object.keys(autoPatch).length > 0) {
        // ——— Auto-zatwierdzanie: zmiana idzie do katalogu BEZ pytania (:47791-47806) ———
        //
        // Tu import przestaje być propozycją i staje się decyzją. Wchodzą tylko te pozycje,
        // gdzie nie ruszyło się NIC z tożsamości opony i nie ma żadnego powodu do sprawdzenia
        // — czyli w praktyce sama cena, marża, stan albo magazyn.
        //
        // ⚠ KOLEJNOŚĆ MA ZNACZENIE i jest odtworzona 1:1: `applyDims` MUTUJE `autoPatch`
        // (dokłada wymiary paczki), więc musi wykonać się PRZED zapisem produktu — inaczej
        // wymiary nie trafiłyby do bazy.
        statystyki.autoZatwierdzone += 1;
        autoPatch.dataAktualizacji = utworzono;

        // Oryginał obejmuje rozszerzenia osobnym `try{}catch{}` (`:47793-47796`), bo
        // `bridge_ext` ma być defensywny — błąd wymiarów nie może wywrócić importu.
        try {
          applyDims(autoPatch as Record<string, unknown>, dopasowany.rozmiar);
          applyLinkMemory(sqlite, autoPatch as Record<string, unknown>, dopasowany);
        } catch {
          // celowo cicho — dokładnie jak `catch (_be) {}` w oryginale
        }

        try {
          aktualizujProdukt(db, dopasowany.id, autoPatch as Partial<ProduktWewnetrzny>);

          // ⚠ ZAGNIEŻDŻENIE JEST CELOWE (`:47799-47802`): nieudany zapis historii NIE cofa
          // aktualizacji produktu ani nie przerywa importu. Zewnętrzny `catch` łapie tylko
          // błąd samej aktualizacji.
          try {
            zapiszHistorieCen(db, {
              produktId: dopasowany.id,
              kod: dopasowany.kod ?? "",
              ean: dopasowany.ean,
              dostawca: kodDostawcy,
              marka: dopasowany.marka,
              model: dopasowany.model,
              rozmiar: dopasowany.rozmiar,
              indeksNosnosci: dopasowany.indeksNosnosci,
              indeksPredkosci: dopasowany.indeksPredkosci,
              kategoria: dopasowany.kategoria,
              // Ceny i stan PO zmianie, tożsamość SPRZED — jak `AP.x ?? T.x` w oryginale.
              cenaZakupu: (autoPatch.cenaZakupu as number | null) ?? dopasowany.cenaZakupu,
              cenaSprzedazy: (autoPatch.cenaSprzedazy as number | null) ?? dopasowany.cenaSprzedazy,
              stan: (autoPatch.stan as number | null) ?? dopasowany.stan,
              zarejestrowanoAt: utworzono,
            });
          } catch {
            // celowo cicho — `catch (_h) {}` w oryginale
          }
        } catch (blad) {
          console.warn("[tk:auto]", blad instanceof Error ? blad.message : String(blad));
        }
      } else {
        statystyki.bezZmian += 1;
      }
    }

    // ——— Pętla wycofań: co zniknęło z cennika na dobre (:47807-47847) ———
    //
    // Drugie (i ostatnie) przejście po katalogu dostawcy. Produkt, którego import nie dotknął,
    // dostaje +1 do licznika nieobecności. Przy TRZECIEJ nieobecności pod rząd trafia na
    // staging jako `wycofana` — do decyzji człowieka, bo automat go nie usuwa — a licznik
    // wraca do zera, żeby po odrzuceniu wycofania cykl liczył się od nowa.
    for (const produkt of katalog) {
      if (dopasowaneId.has(produkt.id)) continue;

      const nieobecnosci = (produkt.nieobecnoscPodRzad || 0) + 1;

      if (nieobecnosci >= WYCOFANIE_PROG_IMPORTOW) {
        statystyki.wycofane += 1;

        const eanProduktu = produkt.ean ? String(produkt.ean).trim() : "";
        const kolidujace = eanProduktu ? konfliktyEan.get(eanProduktu) : undefined;
        // Ostrzeżenie wymienia INNE pozycje z tym samym EAN-em — bez samego wycofywanego.
        const inne = kolidujace?.filter((p) => p.kod !== produkt.kod) ?? [];

        doZapisu.push({
          typZmiany: "wycofana",
          kod: produkt.kod ?? "",
          nazwa: produkt.nazwa,
          dostawca: kodDostawcy,
          magazyn: produkt.magazyn,
          magazynRaw: produkt.magazynRaw ?? null,
          stanStary: produkt.stan,
          stanNowy: 0,
          cenaZakupuStara: produkt.cenaZakupu,
          cenaZakupuNowa: null,
          cenaSprzedazyNowa: null,
          zmianaPct: null,
          ostrzezenie: kolidujace
            ? `Mozliwy duplikat EAN (${eanProduktu}) z inna pozycja w bazie: ` +
              `${inne.map((p) => `${p.kod} "${p.nazwa || ""}"`).join(", ")}. ` +
              `Sprawdz przed odrzuceniem.`
            : null,
          powod: "Brak w cenniku — pozycja wycofana",
          snapshotJson: null,
          eanRaw: null,
          eanIsValid: null,
          eanSourceStatus: null,
          eanCandidates: null,
          edytowanePola: null,
          utworzono,
        });

        aktualizujProdukt(db, produkt.id, { nieobecnoscPodRzad: 0 });
      } else {
        aktualizujProdukt(db, produkt.id, { nieobecnoscPodRzad: nieobecnosci });
      }
    }

    // Zapis wsadowy w JEDNEJ transakcji (:47848-47850). `doStagingu` to długość bufora,
    // nie liczba wstawionych wierszy — patrz deduplikacja w `zapiszPozycjeStagingu()`.
    statystyki.doStagingu = zapiszPozycjeStagingu(db, doZapisu);
    return statystyki;
  };
}
