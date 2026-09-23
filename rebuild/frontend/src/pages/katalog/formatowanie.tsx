/**
 * Formatowanie komórek tabeli katalogu — 1:1 z `Wfmt` i `DT`
 * (`deminified/frontend-index.js:23098-23190`).
 *
 * ⚠ ODWOŁANIE DO DEMINIFIKATU JEST STARSZE NIŻ TEN PLIK. `deminified/frontend-index.js` to
 * bundle `index-PRICEFMT…` w stanie z 2026-08-13, czyli SPRZED łatek z 2026-09-04.
 * `formatujSzerokosc` jest tu świadomie PO łatce `szer_marka` i różni się od deminifikatu —
 * nie „przywracać" gałęzi `AxB` jako rzekomo zgubionej w porcie.
 *
 * To tutaj mieszkają wszystkie „drobiazgi", po których Ania pozna, czy odbudowa jest
 * wierna: dwie cyfry po przecinku w cenie zakupu, `1234,-` w cenie sprzedaży, `8PR`,
 * „Radialna"/„Diagonalna", czerwone zero w stanie i kreska `—` zamiast pustki.
 */
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type { Produkt } from "./filtrowanie";

function Kreska() {
  return <span className="text-muted-foreground">—</span>;
}

/**
 * Blokowane formy płatności per magazyn — port `VALUES`
 * (`mirror/frontend/assets/payment-blocks-injection.js:8-18`, backlog #73).
 *
 * ⭐ DLACZEGO MAPA STOI W FRONCIE, A NIE PRZYCHODZI Z API. Bo tak jest w produkcji — i nie
 * jest to niedopatrzenie, tylko konsekwencja tego, jak pole powstało. `payment_blocks.cjs`
 * dokłada kolumnę `products.blokowane_formy_platnosci` runtime'owym `ALTER TABLE` przy każdym
 * starcie, ale bundle backendu tej kolumny NIE ZNA (`grep -c blokowane_formy_platnosci
 * mirror/backend/index.cjs` = 0), a produkty czyta Drizzle bez jawnej listy pól — więc
 * `GET /api/products` jej nie oddaje. Dokładnie ten sam mechanizm co przy `uwagaCena`
 * (`rebuild/backend/src/repos/kolumny.ts`, `KOLUMNY_POZA_KONTRAKTEM`).
 *
 * ⭐ ZMIERZONE, NIE ZAŁOŻONE (ticket 122): oryginał z `origin/main` @ `88fa31c`, postawiony
 * na kopii bazy Z KOLUMNĄ WYPEŁNIONĄ dla wszystkich 7405 produktów i z obydwoma triggerami,
 * oddaje na `GET /api/products` **72 klucze bez tego pola**. Dlatego skrypt wstrzykujący
 * w produkcji liczy wartość w przeglądarce z kodu dostawcy — i dlatego my robimy tak samo.
 * Sięgnięcie po wartość z API wymagałoby wystawienia pola, czyli ODSTĘPSTWA od produkcji.
 *
 * ⚠ CZWARTA KOPIA TEJ SAMEJ LISTY. Pozostałe trzy są po stronie backendu:
 * `rebuild/schema/011_blokowane_formy_i_triggery.sql` (triggery — źródło wartości w bazie, z niej
 * idzie CSV), `rebuild/backend/src/import/legacy/payment_blocks.cjs` (kopia oryginału bajt w bajt,
 * karta I15.2) i `rebuild/backend/src/selly/generator-csv.ts` (fallback eksportu). Front i tak nie
 * mógłby użyć żadnej z nich — to osobny pakiet. Produkcja ma ten sam podział (`payment_blocks.cjs`
 * + skrypt front-endowy). Zmiana listy przez Anię = zmiana we wszystkich czterech miejscach;
 * zweryfikowane 2026-09-23, że dziś są identyczne co do znaku.
 *
 * ⚠ MO6 (Uniglory) CELOWO BEZ WPISU — CHANGELOG produkcji 2026-09-10 14:53: „nie będzie na
 * razie w sprzedaży". Dla MO6 i nieznanego dostawcy komórka pokazuje „—", i tak ma być
 * (backlog #101, zamknięte 2026-09-23 po pomiarze na żywej produkcji).
 */
const BLOKOWANE_FORMY_PLATNOSCI: Readonly<Record<string, string>> = Object.freeze({
  MO1: "203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219",
  MO2: "201, 202, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219",
  MO3: "201, 202, 203, 204, 205, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219",
  MO4: "201, 202, 203, 204, 205, 206, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219",
  MO5: "201, 202, 203, 204, 205, 206, 207, 208, 211, 212, 213, 214, 215, 216, 217, 218, 219",
  MO7: "201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 213, 214, 215, 216, 217, 218, 219",
  MO8: "201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 215, 216, 217, 218, 219",
  MO9: "201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 217, 218, 219",
  MO10: "201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216",
});

/**
 * Wartość kolumny „Blokowane formy płatności" dla danego dostawcy.
 * Port `VALUES[supplier] || ""` ze skryptu wstrzykującego (`:52`), razem z `toUpperCase()`.
 */
export function blokowaneFormyPlatnosci(dostawca: string | null | undefined): string {
  return BLOKOWANE_FORMY_PLATNOSCI[String(dostawca ?? "").trim().toUpperCase()] ?? "";
}

/**
 * Odtworzenie zapisu szerokości opony (`Wfmt`, frontend-index.js:23098-23119).
 *
 * ⚠ To jest odpowiedź na pytanie „jak prezentować mieszane `szerokosc`" (plan.md D1,
 * backlog #3) — i odpowiedź ma już sam ORYGINAŁ. Funkcja nie ufa temu, co leży w bazie,
 * tylko próbuje odzyskać oryginalny zapis z pola `rozmiar`:
 *
 *  1. pusto/null            → `null` (komórka pokaże „—"),
 *  2. wartość nieliczbowa   → surowy tekst,
 *  3. pierwszy token liczbowy z `rozmiar` RÓWNY liczbowo szerokości → ten token
 *     w oryginalnym zapisie (tak wraca „10.00" mimo REAL-a w bazie),
 *  4. fallback              → `String(Number(wartosc))`.
 *
 * Praktyczny skutek: dopóki `rozmiar` zawiera pasujący token, kolumna wygląda TAK SAMO
 * niezależnie od tego, czy baza trzyma `10` (REAL, kanon) czy `"10.00"` (TEXT, staging).
 * Rozjazd z backlogu #3 jest więc w UI w dużej mierze niewidoczny.
 *
 * ⚠ KROK „CAŁA NOTACJA `AxB`" ZOSTAŁ ZDJĘTY — łatka `szer_marka` z 2026-09-04 15:00
 * (żywy bundle `index-PRICEFMT1783512500.js`, stan sprzed łatki w kopii
 * `.bak_szer_marka_20260904_1500`). Ania usunęła z `Wfmt` całą gałąź
 * `if(!rs.includes("/")){ … /^(A)\s*[xX]\s*(B)/ … return `${A}x${B}` }`, więc dla
 * `rozmiar="14.9x28"` kolumna pokazuje dziś `14.9`, a nie `14.9x28`. Pomiar na
 * `db/snapshot.db`: **587 z 7395 pozycji** zmienia zapis. ⚠ Zniesiona gałąź oddawała DWA
 * PIERWSZE CZŁONY, a nie cały `rozmiar` — dlatego przykłady trzeba czytać jako
 * `rozmiar` → dziś (dawniej): `8.00x20` → `8.00` (dawniej `8.00x20`), `300x15` → `300`
 * (dawniej `300x15`), ale `16x6-8` → `16` (dawniej `16x6`) i `23x10.50-12` → `23`
 * (dawniej `23x10.50`).
 *
 * ⚠ Zera końcowe PRZEŻYŁY usunięcie gałęzi — niesie je krok 3, który oddaje token
 * `rozmiar` w oryginalnym zapisie: `8.00x20` przy `szerokosc="8.00"` daje `"8.00"`, nie `"8"`.
 * To dlatego kroku 3 nie wolno „uprościć" do `String(Number(…))`.
 */
export function formatujSzerokosc(
  wartosc: number | string | null | undefined,
  rozmiar: string | null | undefined,
): string | null {
  if (wartosc === null || wartosc === undefined || wartosc === "") return null;

  const liczba = Number(wartosc);
  if (!Number.isFinite(liczba)) return String(wartosc);

  if (rozmiar) {
    const tekstRozmiaru = String(rozmiar);
    for (const token of tekstRozmiaru.match(/[0-9]+(?:[.,][0-9]+)?/g) ?? []) {
      const znormalizowany = token.replace(",", ".");
      if (Number(znormalizowany) === liczba) return znormalizowany;
    }
  }
  return String(liczba);
}

/**
 * Wartość komórki (`DT`, frontend-index.js:23120-23190). Kolejność warunków jak
 * w oryginale — kilka z nich się przesłania, więc zmiana kolejności zmienia wynik.
 */
export function formatujKomorke(produkt: Produkt, klucz: string): ReactNode {
  const wartosc = produkt[klucz];

  /**
   * `kodDostawcy` bierze się z `kod`, nie z kolumny: gdy `kod` ma postać `MO9_336320`,
   * a prefiks zgadza się z dostawcą — pokazujemy sklejkę `MO9336320`.
   */
  if (klucz === "kodDostawcy") {
    const kod = produkt.kod;
    if (typeof kod === "string" && kod.includes("_")) {
      const podkreslnik = kod.indexOf("_");
      const prefiks = kod.slice(0, podkreslnik);
      if (produkt.dostawca && prefiks === produkt.dostawca) {
        return prefiks + kod.slice(podkreslnik + 1);
      }
    }
    return wartosc === null || wartosc === undefined || wartosc === "" ? (
      <Kreska />
    ) : (
      String(wartosc)
    );
  }

  if (klucz === "szerokosc") {
    const zapis = formatujSzerokosc(produkt.szerokosc, produkt.rozmiar);
    return zapis === null ? <Kreska /> : zapis;
  }

  if (klucz === "konstrukcja") {
    // ⚠ MAPOWANIE KODÓW + PASS-THROUGH — jedno bez drugiego psuje kolumnę.
    //
    // Do 2026-09-01 baza trzymała kody jednoliterowe i sama mapa wystarczała. Od migracji
    // `konstr` (produkcja) i jej odpowiednika w odbudowie (`rebuild/schema/005_konstrukcja_slowa.sql`,
    // 13c) kolumna niesie już PEŁNE SŁOWA — na samej mapie każdy wiersz wpadałby w `null`
    // i cała kolumna pokazywałaby „—".
    //
    // Produkcja rozwiązała to dokładnie tak samo: „mapowanie R/D/L/B → Radialna/Diagonalna
    // zachowane jako defensywny bezpiecznik + rozszerzenie o pass-through wartości surowej
    // (`n||""` / `n||null`)" — `mirror/backend/CHANGELOG.md`, wpis 2026-09-01 11:35.
    // Mapy NIE usuwamy: baza po `products/clear` + reimporcie znów może oddać kod.
    const opis =
      wartosc === "R"
        ? "Radialna"
        : wartosc === "D" || wartosc === "L" || wartosc === "B"
          ? "Diagonalna"
          : wartosc === null || wartosc === undefined || wartosc === ""
            ? null
            : String(wartosc);
    return opis === null ? <Kreska /> : opis;
  }

  if (klucz === "tlTt") {
    const opis =
      wartosc === "TL" ? "TL (bezdętkowa)" : wartosc === "TT" ? "TT (dętkowa)" : null;
    return opis === null ? <Kreska /> : opis;
  }

  if (klucz === "pr") {
    return wartosc === null || wartosc === undefined || wartosc === "" ? (
      <Kreska />
    ) : (
      `${String(wartosc)}PR`
    );
  }

  /**
   * `promocja` nie jest kolumną produktu — czytamy ją z `_reguly.promocja`, dokładnie jak
   * oryginał (`const p = e?._reguly?.promocja; … p.wartosc; p.nazwa || "Promocja"`).
   *
   * ⭐ Od karty 14h (ticket 61) pole REALNIE PRZYCHODZI z `GET /api/products` — backend
   * dopasowuje promocję silnikiem cen (`repos/products.ts`, `dolaczReguly`). W produkcji
   * `_reguly` nie było ustawiane nigdy, więc to ŚWIADOME ODSTĘPSTWO, decyzja Ani
   * z 2026-09-18 (`docs/rebuild-backlog.md` #22), a nie przywrócenie regresji.
   * „—" zostaje dla produktu, któremu żadna aktywna promocja nie odpowiada.
   */
  if (klucz === "promocja") {
    const reguly = produkt._reguly as { promocja?: { wartosc?: number; nazwa?: string } } | undefined;
    const promocja = reguly?.promocja;
    if (!promocja) return <Kreska />;
    const nazwa = promocja.nazwa ?? "Promocja";
    return (
      <span className="inline-flex items-center gap-1">
        <Badge variant="default" className="bg-orange-500 text-white text-[10px] font-mono">
          -{promocja.wartosc}%
        </Badge>
        <span className="text-xs text-muted-foreground truncate max-w-[100px]" title={nazwa}>
          {nazwa}
        </span>
      </span>
    );
  }

  if (klucz === "stan") {
    if (wartosc === -1) {
      return (
        <Badge variant="outline" className="font-mono text-[10px]">
          na zamówienie
        </Badge>
      );
    }
    if (wartosc === 0 || wartosc === null || wartosc === undefined) {
      return <span className="text-red-500">0</span>;
    }
    return String(wartosc);
  }

  if (klucz === "cenaZakupu") return typeof wartosc === "number" ? wartosc.toFixed(2) : "—";
  if (klucz === "cenaSprzedazy") {
    return typeof wartosc === "number" ? `${Math.floor(wartosc)},-` : "—";
  }

  if (klucz === "marzaPct") {
    if (typeof wartosc !== "number") return "—";
    const klasa =
      wartosc < 0 ? "text-red-600 font-bold" : wartosc < 5 ? "text-amber-600 font-semibold" : "";
    return <span className={klasa}>{wartosc.toFixed(0)}%</span>;
  }

  if (klucz === "vat") return typeof wartosc === "number" ? `${wartosc}%` : "—";

  if (klucz === "dataAktualizacji" && typeof wartosc === "string") {
    return new Date(wartosc).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" });
  }

  /**
   * Kolumna „Blokowane formy płatności" (backlog #73). Wartość NIE pochodzi z produktu —
   * liczy się z kodu dostawcy, bo `GET /api/products` tego pola nie niesie (patrz komentarz
   * przy `BLOKOWANE_FORMY_PLATNOSCI`). `title` z pełną listą, jak `td.title` w oryginale
   * (`payment-blocks-injection.js:54`): kolumna bywa węższa niż 17 identyfikatorów.
   */
  if (klucz === "blokowaneFormyPlatnosci") {
    const lista = blokowaneFormyPlatnosci(produkt.dostawca);
    if (!lista) return <Kreska />;
    return <span title={lista}>{lista}</span>;
  }

  if (klucz === "status") {
    return (
      <Badge variant={wartosc === "aktywny" ? "default" : "secondary"} className="text-[10px]">
        {String(wartosc)}
      </Badge>
    );
  }

  // Kolumny boolean (`nro`, `cfo`, `ms`, …): `true` → „Tak", `false` → PUSTO (nie „Nie").
  if (typeof wartosc === "boolean") return wartosc ? "Tak" : "";

  if (wartosc === null || wartosc === undefined || wartosc === "") return <Kreska />;
  return String(wartosc);
}
