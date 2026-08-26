// Odtwarza próbki dostawców, dla których nie mamy realnego pliku wejściowego:
// MO6 (Agrowiec/Uniglory) oraz MO9 (Agrorami).
//
// MO7 (Nokian), MO8 (Trelleborg) i MO10 (GRI) miały tu wcześniej próbki odtworzone — od
// 2026-08-26 mamy od Ani PRAWDZIWE pliki i te sekcje zostały usunięte.
//
// DLACZEGO POZOSTAŁE ODTWARZAMY, ZAMIAST WZIĄĆ PLIK
// MO6 jest od 2026-08-26 wycofany z importu (decyzja produkcji) i nigdy nie był importem
// automatycznym — próbkę zostawiamy, bo dalej dowodzi wierności portu i nic nie kosztuje.
// MO9 ma w archiwum pliki CSV, ale produkcyjny parser (mo9_agrorami.cjs) je IGNORUJE —
// od 2026-07-10 dane idą z API GraphQL, a nie z pliku.
//
// SKĄD DANE
// Wiersze pochodzą z mirror/backend/parsers/test_tyres.cjs — pliku charakteryzacyjnego Ani,
// w którym zaszyte są REALNE linie z plików tych dostawców (z numerami linii w oryginale).
// Dla MO9 dane produktowe (EAN, model, rozmiar, indeksy, ceny) pochodzą z archiwalnego
// MO9__20260821__08472__agrorami.csv i są przepakowane w kształt obiektu z API GraphQL,
// udokumentowany zapytaniem w mo9_agrorami_api.cjs.
//
// Szczegóły, ograniczenia pokrycia i sposób weryfikacji: test/charakteryzacja/ZRODLA.md
//
// Użycie:  node scripts/charakteryzacja-probki-odtworzone.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";


const backendDir = dirname(dirname(fileURLToPath(import.meta.url)));
const katalogProbek = join(backendDir, "test", "charakteryzacja", "probki");
mkdirSync(katalogProbek, { recursive: true });

const zapisz = (nazwa, bufor) => {
  writeFileSync(join(katalogProbek, nazwa), bufor);
  console.log(`${nazwa}: ${bufor.length} B`);
};

const csv = (wiersze) => wiersze.map((w) => w.join(";")).join("\r\n") + "\r\n";

// ---------------------------------------------------------------- MO6 Agrowiec
// mo6_agrowiec.cjs: "Kodowanie: UTF-8 z BOM", separator ";", nagłówki niemieckie.
zapisz(
  "MO6.csv",
  Buffer.concat([
    Buffer.from([0xef, 0xbb, 0xbf]),
    Buffer.from(
      csv([
        ["EAN", "Beschreibung", "Beschreibung 2", "Hersteller", "Lagerbestand", "Cena", "Model", "VF/IF", "Kategoria"],
        ["6900532088753", "650/65R42", "165D/168A8", "UNIGLORY", "2", "4898,42", "SMARTAGRO", "", "Rolnicze"],
        ["6969999612400", "420/85R24", "137A8/134B", "UNIGLORY", "2", "1501,49", "SMARTAGRO", "", "Rolnicze"],
      ]),
      "utf-8",
    ),
  ]),
);

// ---------------------------------------------------------------- MO9 Agrorami
// Obiekty `item` w kształcie zapytania GraphQL z mo9_agrorami_api.cjs (sku, ean, name,
// manufacturer, weight, url_key, stock_status, stock_availability{in_stock,in_stock_real},
// categories{id,name}, price_range{minimum_price{...}}).
//
// Dane produktowe są REALNE — z archiwalnego MO9__20260821__08472__agrorami.csv. Nazwa handlowa
// (`name`) jest złożona z kolumn tego pliku w formacie, który API zwraca jednym stringiem
// ("540/65R38 BKT AGRIMAX RT 657 147D/144E TL") — stary CSV miał to rozbite na kolumny.
// `sku` = kolumna `id` starego feedu (kod handlowy), `id` = osobny numer encji Magento:
// rozróżnienie sku↔id to realna poprawka z 2026-07-13, którą próbka ma pokrywać.
// Wartości `in_stock_real` odzwierciedlają kształty udokumentowane w kodzie parsera
// (liczba, zapis "N+", null) — patrz komentarz "5+" → normalizeQty → 5.
const KATEGORIE = {
  rolnicze: { id: 149, name: "Opony rolnicze" },
  "przemysłowe": { id: 150, name: "Opony przemysłowe" },
  inne: { id: 151, name: "Inne" },
};

/** Składa LI/SI z rozbitych kolumn starego feedu: ("148/144","A8/B") -> "148A8/144B". */
function zlozIndeksy(nosnosc, predkosc) {
  if (!nosnosc) return "";
  const li = String(nosnosc).split("/");
  const si = String(predkosc || "").split("/");
  return li.map((n, i) => `${n}${si[i] ?? ""}`).join("/");
}

const WIERSZE_MO9 = [
  // id(sku); ean; bieznik; rozmiar; nosnosc; predkosc; tl/tt; plotna; cena; magazyn; waga; kategoria
  ["106541", "8903094031443", "FLOT 648", "385/65-22.5", "148/144", "A8/B", "TL", "18", "1400", "0", "57", "inne"],
  ["106545", "8903094006816", "FL 252", "5.00-8", "", "", "TT", "8", "145", "0", "", "przemysłowe"],
  ["106563", "8903094002689", "AS 2001", "16.9-28", "135", "A6", "TT", "8", "1750", "0", "81", "rolnicze"],
  ["106564", "8903094007806", "PT - HD", "6.00-9", "", "", "TT", "10", "270", "0", "12", "przemysłowe"],
  ["106565", "8903094007219", "PL 801", "7.00-12", "", "", "TT", "14", "375", "0", "17", "przemysłowe"],
  ["106567", "8903094020584", "TF 8181", "6.00-16", "88/80", "A6/A8", "TT", "6", "220", "0", "10", "rolnicze"],
  ["106568", "8903094020614", "TF 8181", "6.50-16", "91/83", "A6/A8", "TT", "6", "242", "1", "11.5", "rolnicze"],
  ["106569", "8903094021024", "TF 9090", "6.50-16", "91/83", "A6/A8", "TT", "6", "215", "5+", "11", "rolnicze"],
  ["106571", "", "TF 9090", "9.00-16", "115/108", "A6/A8", "TT", "10", "445", "", "24", "rolnicze"],
  ["106573", "8903094003570", "TR 135", "16.9-24", "133/129", "A6/A8", "TT", "8", "1500", "1", "68", "rolnicze"],
  ["106574", "8903094002795", "AS 2001", "18.4-26", "146", "A6", "TT", "12", "2000", "15+", "89", "rolnicze"],
  ["106575", "8903094004027", "TR 135", "23.1-26", "153/149A8", "A6/", "TL", "12", "3690", "1", "153", "rolnicze"],
];

const itemy = WIERSZE_MO9.map(
  ([sku, ean, bieznik, rozmiar, nosnosc, predkosc, tltt, plotna, cena, magazyn, waga, kategoria], i) => {
    const indeksy = zlozIndeksy(nosnosc, predkosc);
    const name = [rozmiar, "BKT", bieznik, indeksy, plotna ? `${plotna}PR` : "", tltt]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    return {
      id: 184000 + i, // entity_id Magento — celowo INNY niż sku
      sku,
      ean: ean || null,
      name,
      manufacturer: 15, // liczbowe id atrybutu Magento; parser i tak twardo ustawia BKT
      weight: waga === "" ? null : Number(waga),
      url_key: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      stock_status: magazyn === "" || magazyn === "0" ? "OUT_OF_STOCK" : "IN_STOCK",
      stock_availability: {
        in_stock: magazyn === "" || magazyn === "0" ? false : true,
        in_stock_real: magazyn === "" ? null : magazyn,
      },
      categories: [{ id: 148, name: "Opony BKT" }, KATEGORIE[kategoria] ?? KATEGORIE.inne],
      price_range: {
        minimum_price: {
          individual_price: { net: Number(cena) },
          final_price: { value: Number(cena) * 1.23, currency: "PLN" },
          regular_price: { value: Number(cena) * 1.23, currency: "PLN" },
        },
      },
      image: { url: `https://hurtownia.agrorami.pl/media/catalog/product/${sku}.jpg` },
    };
  },
);

zapisz("MO9.items.json", Buffer.from(JSON.stringify(itemy, null, 2) + "\n", "utf-8"));
