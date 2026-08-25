/**
 * Formatowanie komórek tabeli katalogu — 1:1 z `Wfmt` i `DT`
 * (`deminified/frontend-index.js:23098-23190`).
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
 * Odtworzenie zapisu szerokości opony (`Wfmt`, frontend-index.js:23098-23119).
 *
 * ⚠ To jest odpowiedź na pytanie „jak prezentować mieszane `szerokosc`" (plan.md D1,
 * backlog #3) — i odpowiedź ma już sam ORYGINAŁ. Funkcja nie ufa temu, co leży w bazie,
 * tylko próbuje odzyskać oryginalny zapis z pola `rozmiar`:
 *
 *  1. pusto/null            → `null` (komórka pokaże „—"),
 *  2. wartość nieliczbowa   → surowy tekst,
 *  3. `rozmiar` bez „/" i w notacji `AxB`, którego pierwszy człon równa się szerokości
 *     → cała notacja `AxB` (np. „14.9x28"),
 *  4. inaczej: pierwszy token liczbowy z `rozmiar` RÓWNY liczbowo szerokości → ten token
 *     w oryginalnym zapisie (tak wraca „10.00" mimo REAL-a w bazie),
 *  5. fallback              → `String(Number(wartosc))`.
 *
 * Praktyczny skutek: dopóki `rozmiar` zawiera pasujący token, kolumna wygląda TAK SAMO
 * niezależnie od tego, czy baza trzyma `10` (REAL, kanon) czy `"10.00"` (TEXT, staging).
 * Rozjazd z backlogu #3 jest więc w UI w dużej mierze niewidoczny.
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
    if (!tekstRozmiaru.includes("/")) {
      const notacjaAxB = tekstRozmiaru.match(/^([0-9]+(?:[.,][0-9]+)?)\s*[xX]\s*([0-9]+(?:[.,][0-9]+)?)/);
      if (notacjaAxB) {
        const pierwszy = (notacjaAxB[1] ?? "").replace(",", ".");
        if (Number(pierwszy) === liczba) return `${pierwszy}x${(notacjaAxB[2] ?? "").replace(",", ".")}`;
      }
    }
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
    const opis =
      wartosc === "R"
        ? "Radialna"
        : wartosc === "D" || wartosc === "L" || wartosc === "B"
          ? "Diagonalna"
          : null;
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
   * `promocja` nie jest kolumną produktu — oryginał czyta ją z `_reguly.promocja`,
   * które dokłada warstwa cenowa (Iteracja 4). Do tego czasu zawsze „—", identycznie
   * jak w produkcji dla produktu bez promocji.
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
