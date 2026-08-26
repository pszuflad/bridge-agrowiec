// Odtwarza próbki dostawców, dla których w repozytorium NIE MA żadnego realnego pliku:
// MO6 (Agrowiec/Uniglory), MO7 (Nokian), MO8 (Trelleborg), MO10 (GRI) oraz MO9 (Agrorami).
//
// DLACZEGO ODTWARZAMY, ZAMIAST WZIĄĆ PLIK
// Archiwum importów (mirror/backend/import_archive/, dostępne pod 72957d7^) obejmuje wyłącznie
// okno 2026-08-21…25 i zawiera tylko MO1–MO5 oraz MO9. Tych czterech dostawców po prostu w nim
// nie ma. MO9 z kolei ma w archiwum pliki CSV, ale produkcyjny parser (mo9_agrorami.cjs) je
// IGNORUJE — od 2026-07-10 dane idą z API GraphQL, a nie z pliku.
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
import { createRequire } from "node:module";

const wymagaj = createRequire(import.meta.url);
const iconv = wymagaj("iconv-lite");
const XLSX = wymagaj("xlsx");

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

// ---------------------------------------------------------------- MO7 Nokian
// UWAGA — KODOWANIE. mo7_nokian.cjs dekoduje plik jako cp1250, ale adapter.cjs (case MO7)
// szuka bieżnika pod kluczami 'BIEÄąÂ»NIK' / 'BIEĹ»NIK' / 'BIEZNIK' — czyli pod nagłówkiem
// ZNIEKSZTAŁCONYM, nie pod czystym "BIEŻNIK". "Ĺ»" to dokładnie to, co daje bajtowa para
// UTF-8 znaku "Ż" (C5 BB) zdekodowana jako cp1250. Wniosek: realny plik Nokiana jest w UTF-8,
// a produkcja czyta go jako cp1250 — i cały łańcuch (parser + adapter) jest napisany pod ten
// właśnie rozjazd. Próbka MUSI więc być zapisana w UTF-8, inaczej adapter nie zobaczy bieżnika
// i odtworzylibyśmy zachowanie, którego produkcja nie ma.
zapisz(
  "MO7.csv",
  Buffer.from(
    csv([
      ["Kod produktu", "Rozmiar", "Rozmiar alternatywny", "MODEL", "PRODUCENT", "BIEŻNIK", "SF/SB", "TL/TT", "LI/SI", "PR", "RODZAJ", "EAN", "Zakup 1 szt", "Magazyn"],
      ["T445733", "420/70R28", "", "Nokian Tyres Ground King SB", "NOKIAN", "Nokian Tyres Ground King SB", "SB", "TL", "144D / 141E", "", "ROLNICZA", "6419440427386", " 3 241 zł ", "5"],
      ["T445763", "600/70R28", "", "Nokian Tyres Ground King SB", "NOKIAN", "Nokian Tyres Ground King SB", "SB", "TL", "164D / 160E", "", "ROLNICZA", "6419440463216", " 5 976 zł ", "5"],
    ]),
    "utf-8",
  ),
);

// ---------------------------------------------------------------- MO8 Trelleborg
// XLSX, arkusz "Radial" (15 kolumn wg nagłówka pliku w mo8_trelleborg.cjs):
// A Size(sekcja) B Size C TL/TT D LI-SI/PR E Pattern F IP Code G Code EAN H EPL in EUR
// I Rim J OD K SW L RC M Note N Item description O PLN
// Kolumna G celowo zawiera zapis w notacji naukowej ("8,05997E+12") — tak Excel psuje 13-cyfrowe
// EAN-y i tak wygląda realny plik; adapter ma na to osobną obsługę (looksLikeMangledScientific).
{
  const arkusz = XLSX.utils.aoa_to_sheet([
    ["Size", "Size", "TL / TT", "Load Index/Speed Ix / PR", "Pattern", "IP Code", "Code EAN", "EPL in EUR", "Rim", "OD", "SW", "RC", "Note", "Item description", "PLN"],
    [null, "620/55B26.5", "TL", "166D", "T421", "1106900", "8,05997E+12", 1445.2, "20.00", 1595, 630, 745, "", "", 6175.5],
    [null, "750/50B30.5", "TL", "173D", "T428", "1102700", "8,05997E+12", 1772.1, "25.00", 1770, 762, 823, "", "", 7572.5],
  ]);
  const skoroszyt = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(skoroszyt, arkusz, "Radial");
  zapisz("MO8.xlsx", XLSX.write(skoroszyt, { bookType: "xlsx", type: "buffer" }));
}

// ---------------------------------------------------------------- MO10 GRI
// mo10_gri.cjs czyta CSV jako cp1250 (albo XLSX, wykrywany po sygnaturze PK\x03\x04).
// Wybieramy wariant CSV — to on jest w tym parserze ścieżką domyślną. Nagłówki mają polskie
// znaki ("Bieżnik", "ilość"), więc plik musi być realnie zakodowany w cp1250.
zapisz(
  "MO10.csv",
  iconv.encode(
    csv([
      ["NR KAT", "EAN", "Bieżnik", "Rozmiar", "ilość", "cena netto/szt"],
      ["PAB1001", "4792290022881", "GREEN EX FL700", "400/60-15.5 18PR I-3 TL", "8", "594 zl"],
      ["PAB1035", "4792290037298", "GREEN EX RT100", "23.1-26 12PR R-1 TL", "8", "2 009 zl"],
      ["PAR1226", "4792290039537", "GREEN XLR 85", "380/80R38 152A8/149D R-1W TL", "6", "1 681 zl"],
    ]),
    "cp1250",
  ),
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
