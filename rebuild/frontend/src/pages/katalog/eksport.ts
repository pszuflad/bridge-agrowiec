/**
 * Eksport CSV katalogu — port 1:1 z `deminified/frontend-index.js`:
 * `Qy` (:23046, escaping), `OT` (:23052, budowa CSV), `IT` (:23089, pobranie pliku)
 * i `TT` (:22706-22731, domyślne kolumny formatu Shoper).
 *
 * ⚠ TO JEST EKSPORT W 100% KLIENCKI. Ani SPA, ani żaden `*-injection.js` nie woła
 * `GET /api/export-shoper` ani `GET /api/export/shoper` (grep po całym
 * `deminified/frontend-index.js` i `mirror/frontend/assets/*.js` — zero trafień).
 * Plik powstaje w przeglądarce z produktów JUŻ WCZYTANYCH do katalogu. Serwerowe trasy
 * eksportu, które dowiozła sesja 8a, w oryginale nie mają żadnego konsumenta we froncie
 * i decyzją D2 planu zostają bez niego również tutaj.
 *
 * ⚠ KTÓRA GAŁĄŹ JEST DOMYŚLNA — wbrew temu, co sugeruje nazwa przycisku.
 * Wybór kolumn (`S` w oryginale, `kolumnyWybrane` u nas) startuje z 15 kolumn domyślnych
 * (`frontend-index.js:23272`, hook `_T()` :23039), więc warunek `size === 0` zachodzi
 * WYŁĄCZNIE wtedy, gdy użytkownik odznaczy w konfiguratorze wszystkie kolumny. Domyślnie
 * eksport idzie więc gałęzią „wybrane kolumny": separator wymuszony na `";"`, nazwa pliku
 * `katalog_…_wybrane_….csv`, etykieta „Pobierz CSV (N kol.)". Format Shoper (`TT`,
 * `shoper.kolumny`, `shoper.separator`) jest osiągalny dopiero po odznaczeniu wszystkiego.
 */
import { formatujSzerokosc } from "./formatowanie";
import type { Produkt } from "./filtrowanie";

/**
 * Kolumna eksportu — tylko klucz i nagłówek.
 *
 * Celowo WĘŻSZY typ niż `DefinicjaKolumny` z `kolumny.ts`: szerokość i wyrównanie służą
 * tabeli, a CSV ich nie ma. Dzięki temu `KOLUMNY.filter(...)` pasuje tu strukturalnie,
 * a kolumny z konfiguracji i z `TT` nie muszą wymyślać nieistniejących szerokości.
 */
export type KolumnaEksportu = { key: string; label: string };

/**
 * Domyślne kolumny formatu Shoper — port `TT` (:22706-22731). Trzynaście par, w kolejności.
 *
 * ⚠ To NIE JEST ten sam zestaw, co 12 domyślnych par w zakładce „Shoper" widoku
 * `/konfiguracja` (`pages/konfiguracja/Shoper.tsx`). Dwie różne listy w samym oryginale —
 * nie ujednolicać.
 */
export const KOLUMNY_SHOPER: KolumnaEksportu[] = [
  { key: "kodDostawcy", label: "kod_dostawcy" },
  { key: "nazwa", label: "nazwa" },
  { key: "marka", label: "marka" },
  { key: "kategoria", label: "kategoria" },
  { key: "dostawca", label: "dostawca" },
  { key: "stan", label: "stan" },
  { key: "cenaZakupu", label: "cena_zakupu" },
  { key: "cenaSprzedazy", label: "cena_sprzedazy" },
  { key: "marzaPct", label: "marza_pct" },
  { key: "vat", label: "vat" },
  { key: "ean", label: "ean" },
  { key: "status", label: "status" },
  { key: "linkZdjecia", label: "link_zdjecia" },
];

/** Separator używany, gdy konfiguracja nic nie mówi — `frontend-index.js:23395`. */
export const SEPARATOR_DOMYSLNY = ";";

/**
 * Escaping wartości — port `Qy` (:23046).
 * Cudzysłów TYLKO gdy wartość zawiera `"`, `,`, `;` albo znak nowej linii; wewnętrzne
 * cudzysłowy podwajane. `null`/`undefined` → pusty string.
 */
export function escapujCsv(wartosc: unknown): string {
  if (wartosc == null) return "";
  const tekst = String(wartosc);
  return /[",;\n]/.test(tekst) ? `"${tekst.replace(/"/g, '""')}"` : tekst;
}

/**
 * Wartość pojedynczej komórki — przypadki specjalne z `OT` (:23054-23085).
 * Wydzielone z pętli, żeby dało się je przetestować po jednym.
 */
export function wartoscKomorki(produkt: Produkt, klucz: string): string {
  const surowa = (produkt as unknown as Record<string, unknown>)[klucz];

  if (klucz === "szerokosc") {
    const zapis = formatujSzerokosc(produkt.szerokosc, produkt.rozmiar);
    return escapujCsv(zapis == null ? "" : zapis);
  }

  if (klucz === "kodDostawcy") {
    // Zdjęcie prefiksu dostawcy z pola `kod`: „MO1_ABC" → „MO1ABC", ale tylko gdy
    // prefiks faktycznie równa się kodowi dostawcy tego produktu (:23059-23068).
    const kod = (produkt as unknown as Record<string, unknown>).kod;
    if (typeof kod === "string" && kod.includes("_")) {
      const podkreslnik = kod.indexOf("_");
      const prefiks = kod.slice(0, podkreslnik);
      const reszta = kod.slice(podkreslnik + 1);
      if (produkt.dostawca && prefiks === produkt.dostawca) return escapujCsv(prefiks + reszta);
    }
    return escapujCsv(surowa);
  }

  if (klucz === "stan") return escapujCsv(surowa === -1 ? 0 : surowa);

  if (klucz === "ean" && surowa != null && surowa !== "") {
    return escapujCsv(String(surowa).replace(/\D/g, ""));
  }

  if (klucz === "konstrukcja") {
    const opis =
      surowa === "R"
        ? "Radialna"
        : surowa === "D" || surowa === "L" || surowa === "B"
          ? "Diagonalna"
          : "";
    return escapujCsv(opis);
  }

  if (klucz === "tlTt") {
    const opis =
      surowa === "TL" ? "TL (bezdętkowa)" : surowa === "TT" ? "TT (dętkowa)" : "";
    return escapujCsv(opis);
  }

  if (klucz === "pr") return escapujCsv(surowa == null || surowa === "" ? "" : `${surowa}PR`);

  // Te cztery flagi zwracają „Tak"/pusto BEZ escapowania (:23082) — jak w oryginale.
  if (["sb", "sf", "hf", "ls"].includes(klucz)) return surowa ? "Tak" : "";

  if (surowa === true) return "Tak";
  if (surowa === false) return "";

  return escapujCsv(surowa);
}

/**
 * Budowa treści CSV — port `OT` (:23052).
 * Nagłówek z etykiet kolumn, wiersze łączone `\n` (NIE `\r\n`).
 */
export function zbudujCsv(
  produkty: Produkt[],
  kolumny: readonly KolumnaEksportu[],
  separator: string = SEPARATOR_DOMYSLNY,
): string {
  const naglowek = kolumny.map((kolumna) => kolumna.label).join(separator);
  const wiersze = produkty.map((produkt) =>
    kolumny.map((kolumna) => wartoscKomorki(produkt, kolumna.key)).join(separator),
  );
  return [naglowek, ...wiersze].join("\n");
}

/**
 * Parsowanie `shoper.kolumny` z `/api/config` — linie `klucz:naglowek`
 * (`frontend-index.js:23396-23402`).
 *
 * Etykieta to wszystko po PIERWSZYM dwukropku (`n.join(":")`), więc nagłówek sam może
 * zawierać dwukropek. Linie bez dwukropka są pomijane.
 */
export function parsujKolumnyShoper(tekst: string): KolumnaEksportu[] {
  return tekst
    .split("\n")
    .filter((linia) => linia.includes(":"))
    .map((linia) => {
      const [klucz, ...reszta] = linia.split(":");
      return { key: (klucz ?? "").trim(), label: reszta.join(":").trim() };
    });
}

/**
 * Produkty dopuszczone do eksportu — `frontend-index.js:23387-23390`.
 * Odpada wszystko, co ma zerową (lub nieliczbową) cenę zakupu ALBO sprzedaży.
 */
export function odsiejDoEksportu(produkty: Produkt[]): Produkt[] {
  return produkty.filter((produkt) => {
    const zakup = Number(produkt.cenaZakupu);
    const sprzedaz = Number(produkt.cenaSprzedazy);
    return !(!zakup || zakup === 0 || !sprzedaz || sprzedaz === 0);
  });
}

/** Data w nazwie pliku — `new Date().toISOString().slice(0,10)` (:23386). */
export function dataDoNazwyPliku(teraz: Date = new Date()): string {
  return teraz.toISOString().slice(0, 10);
}

/**
 * Pobranie pliku — port `IT` (:23089).
 *
 * BOM (`\ufeff`) na początku (Excel bez niego psuje polskie znaki), typ
 * `text/csv;charset=utf-8`, kotwica `download` wpięta w DOM na czas kliknięcia,
 * zwolnienie URL-a po sekundzie.
 */
export function pobierzPlik(
  nazwa: string,
  tresc: string,
  typ = "text/csv;charset=utf-8",
): void {
  const blob = new Blob(["\ufeff" + tresc], { type: typ });
  const adres = URL.createObjectURL(blob);
  const kotwica = document.createElement("a");
  kotwica.href = adres;
  kotwica.download = nazwa;
  document.body.appendChild(kotwica);
  kotwica.click();
  document.body.removeChild(kotwica);
  setTimeout(() => URL.revokeObjectURL(adres), 1000);
}
