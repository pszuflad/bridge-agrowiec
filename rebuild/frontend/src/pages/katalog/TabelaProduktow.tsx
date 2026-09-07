/**
 * Tabela katalogu — 1:1 z oryginałem (`deminified/frontend-index.js:23632-23830`).
 *
 * Trzy rzeczy, które wyglądają na dziwne, a są zamierzone:
 *
 *  1. Kolumny „Nazwa", „EAN" i „Dost" są renderowane ZAWSZE i przyklejone do lewej
 *     krawędzi, niezależnie od konfiguratora; z listy wybranych kolumn są odfiltrowane,
 *     żeby się nie zdublowały (:23745).
 *  2. Klik w komórkę „Nazwa" nie otwiera niczego — przełącza tylko zawijanie tekstu
 *     dla tego wiersza (:23753-23757).
 *  3. Sortowanie jest w pełni po stronie klienta i działa na całym odfiltrowanym
 *     zbiorze, nie na bieżącej stronie.
 *
 * Ostatnia kolumna to menu „Akcje" (`MenuAkcji.tsx`) — do sesji 12c stał tu przycisk
 * podglądu read-only, którym Iteracja 2 zastąpiła menu na czas braku mutacji (odstępstwo
 * D4). Mutacje dowiozła 12a, więc odstępstwo jest zniesione i kolumna wróciła do oryginału.
 */
import { ArrowUpDown } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { formatujKomorke } from "./formatowanie";
import type { Produkt } from "./filtrowanie";
import { MenuAkcji } from "./MenuAkcji";
import { KOLUMNY_PRZYKLEJONE, type DefinicjaKolumny } from "./kolumny";
import { useWirtualizacja } from "./wirtualizacja";

const KLASA_NAGLOWKA =
  "px-3 py-2.5 font-medium whitespace-nowrap cursor-pointer hover:text-foreground select-none";
const CIEN_PRZYKLEJENIA = "shadow-[2px_0_4px_rgba(0,0,0,0.1)]";

/**
 * Nagłówek kolumny — 1:1 z oryginałem (frontend-index.js:23641-23692): etykieta i ikona
 * w `inline-flex` z odstępem, ikona ZAWSZE ta sama i zawsze przygaszona.
 *
 * Kusi, żeby pokazać strzałkę kierunku aktywnego sortowania — ale oryginał tego NIE robi,
 * a to jest wierna odbudowa, nie ulepszanie. Gdyby kiedyś doszło, musi być świadomą decyzją.
 */
function NaglowekKolumny({
  etykieta,
  onKlik,
  className,
  style,
  testId,
}: {
  etykieta: string;
  onKlik: () => void;
  className?: string;
  style?: CSSProperties;
  testId: string;
}) {
  return (
    <th className={className ?? KLASA_NAGLOWKA} style={style} onClick={onKlik} data-testid={testId}>
      <span className="inline-flex items-center gap-1">
        {etykieta} <ArrowUpDown className="w-3 h-3 opacity-50" />
      </span>
    </th>
  );
}

export function TabelaProduktow({
  produkty,
  kolumny,
  onSortuj,
  ladowanie,
  bylyJakiesProdukty,
  onEdytuj,
  onPrzelaczStatus,
  onUsun,
}: {
  /** Wiersze BIEŻĄCEJ strony (paginacja dzieje się wyżej). */
  produkty: Produkt[];
  kolumny: DefinicjaKolumny[];
  /**
   * Sam komponent nie dostaje aktualnej kolumny ani kierunku — i nie potrzebuje ich:
   * oryginał rysuje w każdym nagłówku tę samą, przygaszoną ikonę, bez wskazywania,
   * po czym lista jest właśnie posortowana (frontend-index.js:23650, :23689).
   */
  onSortuj: (klucz: string) => void;
  ladowanie: boolean;
  /** Czy przed filtrowaniem cokolwiek było — rozstrzyga, który komunikat pustki pokazać. */
  bylyJakiesProdukty: boolean;
  onEdytuj: (produkt: Produkt) => void;
  onPrzelaczStatus: (produkt: Produkt) => void;
  onUsun: (produkt: Produkt) => void;
}) {
  const [rozwinieteNazwy, setRozwinieteNazwy] = useState<Set<number>>(() => new Set());
  const okno = useWirtualizacja(produkty.length);

  // Kolumny przyklejone mają własne `<td>`, więc z konfigurowalnych je usuwamy (:23745).
  const kolumnyZmienne = kolumny.filter(
    (kolumna) => !KOLUMNY_PRZYKLEJONE.includes(kolumna.key as (typeof KOLUMNY_PRZYKLEJONE)[number]),
  );
  const liczbaKolumn = kolumnyZmienne.length + 3 + 1;
  const widoczne = okno.aktywna ? produkty.slice(okno.start, okno.koniec) : produkty;

  const przelaczNazwe = (id: number): void => {
    setRozwinieteNazwy((poprzednie) => {
      const nowe = new Set(poprzednie);
      if (nowe.has(id)) nowe.delete(id);
      else nowe.add(id);
      return nowe;
    });
  };

  return (
    <div ref={okno.refKontenera} className="overflow-x-auto catalog-scroller">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <NaglowekKolumny
              etykieta="Nazwa"
              className={`${KLASA_NAGLOWKA} sticky left-0 bg-muted/50 z-10 ${CIEN_PRZYKLEJENIA}`}
              style={{ minWidth: 220, maxWidth: 220 }}
              onKlik={() => onSortuj("nazwa")}
              testId="header-nazwa"
            />
            <NaglowekKolumny
              etykieta="EAN"
              className={`${KLASA_NAGLOWKA} sticky bg-muted/50 z-10 ${CIEN_PRZYKLEJENIA}`}
              style={{ left: 220, minWidth: 140, maxWidth: 140 }}
              onKlik={() => onSortuj("ean")}
              testId="header-ean"
            />
            <NaglowekKolumny
              etykieta="Dost."
              style={{ minWidth: 60 }}
              onKlik={() => onSortuj("dostawca")}
              testId="header-dostawca"
            />
            {kolumnyZmienne.map((kolumna) => (
              <NaglowekKolumny
                key={kolumna.key}
                etykieta={kolumna.label}
                style={{ textAlign: kolumna.align ?? "left", minWidth: kolumna.width }}
                onKlik={() => onSortuj(kolumna.key)}
                testId={`header-${kolumna.key}`}
              />
            ))}
            {/* „Akcje" 1:1 z oryginałem (frontend-index.js:23693-23695). Do 12c stało tu
                „Podgląd", bo kolumna mieściła wyłącznie modal read-only (odstępstwo D4). */}
            <th
              className="px-3 py-2.5 font-medium text-right sticky right-0 bg-muted/50 z-10"
              data-testid="header-akcje"
            >
              Akcje
            </th>
          </tr>
        </thead>
        <tbody>
          {ladowanie && (
            <tr>
              <td colSpan={liczbaKolumn} className="px-3 py-12 text-center text-muted-foreground">
                Wczytuję katalog...
              </td>
            </tr>
          )}
          {!ladowanie && produkty.length === 0 && bylyJakiesProdukty && (
            <tr>
              <td
                colSpan={liczbaKolumn}
                className="px-3 py-12 text-center text-muted-foreground"
                data-testid="text-brak-wynikow"
              >
                Brak produktów spełniających filtry
              </td>
            </tr>
          )}

          {okno.wysokoscGora > 0 && (
            <tr style={{ height: okno.wysokoscGora }}>
              <td colSpan={liczbaKolumn} style={{ padding: 0, border: "none" }} />
            </tr>
          )}

          {widoczne.map((produkt) => (
            <tr
              key={produkt.id}
              className="border-t border-border hover:bg-muted/30"
              data-testid={`row-product-${produkt.id}`}
            >
              <td
                className={`px-3 py-2 text-xs sticky left-0 bg-background truncate ${CIEN_PRZYKLEJENIA}`}
                style={{ minWidth: 220, maxWidth: 220 }}
                title={produkt.nazwa}
              >
                {produkt.nazwa}
              </td>
              <td
                className={`px-3 py-2 font-mono text-xs sticky bg-background truncate ${CIEN_PRZYKLEJENIA}`}
                style={{ left: 220, minWidth: 140, maxWidth: 140 }}
                title={produkt.ean ?? ""}
              >
                {produkt.ean ?? "—"}
              </td>
              <td className="px-3 py-2 font-mono text-xs">{produkt.dostawca}</td>

              {kolumnyZmienne.map((kolumna) => {
                const toNazwa = kolumna.key === "nazwa";
                const rozwinieta = rozwinieteNazwy.has(produkt.id);
                return (
                  <td
                    key={kolumna.key}
                    className={`px-3 py-2 text-xs font-mono${toNazwa ? " cursor-pointer" : ""}`}
                    style={{
                      textAlign: kolumna.align ?? "left",
                      minWidth: kolumna.width,
                      ...(toNazwa && !rozwinieta ? { maxWidth: 320 } : {}),
                    }}
                    {...(toNazwa
                      ? { title: produkt.nazwa, onClick: () => przelaczNazwe(produkt.id) }
                      : {})}
                  >
                    <div
                      className={toNazwa ? (rozwinieta ? "whitespace-normal break-words" : "truncate") : ""}
                    >
                      {formatujKomorke(produkt, kolumna.key)}
                    </div>
                  </td>
                );
              })}

              <td className="px-3 py-2 text-right sticky right-0 bg-background">
                <MenuAkcji
                  produkt={produkt}
                  onEdytuj={onEdytuj}
                  onPrzelaczStatus={onPrzelaczStatus}
                  onUsun={onUsun}
                />
              </td>
            </tr>
          ))}

          {okno.wysokoscDol > 0 && (
            <tr style={{ height: okno.wysokoscDol }}>
              <td colSpan={liczbaKolumn} style={{ padding: 0, border: "none" }} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
