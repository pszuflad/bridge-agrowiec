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
 * ODSTĘPSTWO (plan.md D4): ostatnia kolumna w oryginale to menu „Akcje" (Edytuj,
 * Historia, Wstrzymaj, Usuń). Mutacje są poza Iteracją 2, więc w jej miejscu jest
 * przycisk otwierający podgląd read-only.
 */
import { Eye } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatujKomorke } from "./formatowanie";
import type { KierunekSortowania, Produkt } from "./filtrowanie";
import { KOLUMNY_PRZYKLEJONE, type DefinicjaKolumny } from "./kolumny";
import { useWirtualizacja } from "./wirtualizacja";

const KLASA_NAGLOWKA =
  "px-3 py-2.5 font-medium whitespace-nowrap cursor-pointer hover:text-foreground select-none";
const CIEN_PRZYKLEJENIA = "shadow-[2px_0_4px_rgba(0,0,0,0.1)]";

function StrzalkaSortowania({ aktywna, kierunek }: { aktywna: boolean; kierunek: KierunekSortowania }) {
  if (!aktywna) return <span className="w-3 h-3 opacity-50 ml-1">↕</span>;
  return <span className="w-3 h-3 ml-1">{kierunek === "asc" ? "↑" : "↓"}</span>;
}

export function TabelaProduktow({
  produkty,
  kolumny,
  sortKolumna,
  sortKierunek,
  onSortuj,
  ladowanie,
  bylyJakiesProdukty,
  onPodglad,
}: {
  /** Wiersze BIEŻĄCEJ strony (paginacja dzieje się wyżej). */
  produkty: Produkt[];
  kolumny: DefinicjaKolumny[];
  sortKolumna: string;
  sortKierunek: KierunekSortowania;
  onSortuj: (klucz: string) => void;
  ladowanie: boolean;
  /** Czy przed filtrowaniem cokolwiek było — rozstrzyga, który komunikat pustki pokazać. */
  bylyJakiesProdukty: boolean;
  onPodglad: (produkt: Produkt) => void;
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
            <th
              className={`${KLASA_NAGLOWKA} sticky left-0 bg-muted/50 z-10 ${CIEN_PRZYKLEJENIA}`}
              style={{ minWidth: 220 }}
              onClick={() => onSortuj("nazwa")}
              data-testid="header-nazwa"
            >
              Nazwa-produktu
              <StrzalkaSortowania aktywna={sortKolumna === "nazwa"} kierunek={sortKierunek} />
            </th>
            <th
              className={`${KLASA_NAGLOWKA} sticky bg-muted/50 z-10 ${CIEN_PRZYKLEJENIA}`}
              style={{ left: 220, minWidth: 140 }}
              onClick={() => onSortuj("ean")}
              data-testid="header-ean"
            >
              EAN
              <StrzalkaSortowania aktywna={sortKolumna === "ean"} kierunek={sortKierunek} />
            </th>
            <th
              className={KLASA_NAGLOWKA}
              onClick={() => onSortuj("dostawca")}
              data-testid="header-dostawca"
            >
              Dost
              <StrzalkaSortowania aktywna={sortKolumna === "dostawca"} kierunek={sortKierunek} />
            </th>
            {kolumnyZmienne.map((kolumna) => (
              <th
                key={kolumna.key}
                className={KLASA_NAGLOWKA}
                style={{ textAlign: kolumna.align ?? "left", minWidth: kolumna.width }}
                onClick={() => onSortuj(kolumna.key)}
                data-testid={`header-${kolumna.key}`}
              >
                {kolumna.label}
                <StrzalkaSortowania
                  aktywna={sortKolumna === kolumna.key}
                  kierunek={sortKierunek}
                />
              </th>
            ))}
            <th className="px-3 py-2.5 font-medium text-right sticky right-0 bg-muted/50 z-10" />
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
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => onPodglad(produkt)}
                  title="Podgląd produktu"
                  data-testid={`button-podglad-${produkt.id}`}
                >
                  <Eye className="w-4 h-4" />
                  <span className="sr-only">Podgląd produktu</span>
                </Button>
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
