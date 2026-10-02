// Jednorazowe przypisanie kategorii i zastosowania z pliku CSV (kolumny: Nazwa-produktu,
// Producent-opony, Rozmiar, Kategoria, Zastosowanie) — katalog_wszyscy_KATEGORIA_ZASTOSOWANIE_FINAL_2026-09-30.
//   DB_PATH=./data/data-prod.db npm run przypisz-kategorie-zastosowanie -- plik.csv [--raport zmiany.csv]   # dry-run
//   DB_PATH=... npm run przypisz-kategorie-zastosowanie -- plik.csv --apply                                 # backup + zapis
// Klucz dopasowania: `products.nazwa` (CSV nie ma kodu). Nazwa, która w CSV ma dwie różne pary
// (kategoria, zastosowanie), jest NIEJEDNOZNACZNA — pomijana i wypisana w raporcie.
// ⚠ Triggery `products_zastosowanie_*` (migracja 011) po zapisie same poprawiają parę, której nie ma
// na liście dozwolonych (np. Rolnicze + Ładowarka → Ciągnik). Skrypt czyta wartość PO zapisie i raportuje
// rozbieżność z plikiem (kolumna `po_triggerze`), niczego nie omija.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { otworzBaze } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";

const dbPath = process.env.DB_PATH;
if (!dbPath) {
  console.error("przypisz-kategorie-zastosowanie: brak DB_PATH — nie wiem, którą bazę zmieniać. Przerywam.");
  process.exit(1);
}
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const iRaport = args.indexOf("--raport");
const plikRaportu = iRaport >= 0 ? args[iRaport + 1] : undefined;
const plikCsv = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--raport");
if (!plikCsv) {
  console.error("przypisz-kategorie-zastosowanie: podaj plik CSV jako pierwszy argument.");
  process.exit(1);
}

function parsujCsv(tekst: string): string[][] {
  const wiersze: string[][] = [];
  let pole = "";
  let wiersz: string[] = [];
  let wCudzyslowie = false;
  for (let i = 0; i < tekst.length; i++) {
    const c = tekst[i];
    if (wCudzyslowie) {
      if (c === '"' && tekst[i + 1] === '"') { pole += '"'; i++; }
      else if (c === '"') wCudzyslowie = false;
      else pole += c;
    } else if (c === '"') wCudzyslowie = true;
    else if (c === ",") { wiersz.push(pole); pole = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && tekst[i + 1] === "\n") i++;
      wiersz.push(pole); pole = "";
      if (wiersz.some((p) => p !== "")) wiersze.push(wiersz);
      wiersz = [];
    } else pole += c;
  }
  if (pole !== "" || wiersz.length) { wiersz.push(pole); wiersze.push(wiersz); }
  return wiersze;
}

const [naglowekCsv, ...dane] = parsujCsv(readFileSync(plikCsv, "utf-8").replace(/^\uFEFF/, ""));
const naglowek = naglowekCsv ?? [];
const kol = (n: string): number => {
  const i = naglowek.indexOf(n);
  if (i < 0) throw new Error(`W CSV brak kolumny „${n}"`);
  return i;
};
const [iNazwa, iKat, iZast] = [kol("Nazwa-produktu"), kol("Kategoria"), kol("Zastosowanie")];

const pary = new Map<string, Set<string>>();
for (const w of dane) {
  const nazwa = (w[iNazwa] ?? "").trim();
  const para = `${(w[iKat] ?? "").trim()}\t${(w[iZast] ?? "").trim()}`;
  if (!pary.has(nazwa)) pary.set(nazwa, new Set());
  pary.get(nazwa)!.add(para);
}

const { sqlite } = otworzBaze(dbPath);
try {
  zastosujMigracje(sqlite);
  const produkty = sqlite
    .prepare("SELECT kod, nazwa, kategoria, zastosowanie FROM products")
    .all() as { kod: string; nazwa: string; kategoria: string; zastosowanie: string | null }[];
  const poNazwie = new Map<string, typeof produkty>();
  for (const p of produkty) {
    const k = p.nazwa.trim();
    if (!poNazwie.has(k)) poNazwie.set(k, []);
    poNazwie.get(k)!.push(p);
  }

  type Zmiana = { kod: string; nazwa: string; kat: string; zast: string; staraKat: string; staraZast: string };
  const zmiany: Zmiana[] = [];
  const niejednoznaczne: string[] = [];
  const bezProduktu: string[] = [];
  let juzOk = 0;
  for (const [nazwa, zbior] of pary) {
    if (zbior.size > 1) { niejednoznaczne.push(nazwa); continue; }
    const [kat = "", zast = ""] = ([...zbior][0] ?? "").split("\t");
    const prods = poNazwie.get(nazwa);
    if (!prods) { bezProduktu.push(nazwa); continue; }
    for (const p of prods) {
      if (p.kategoria === kat && (p.zastosowanie ?? "") === zast) { juzOk++; continue; }
      zmiany.push({ kod: p.kod, nazwa, kat, zast, staraKat: p.kategoria, staraZast: p.zastosowanie ?? "" });
    }
  }
  console.log(
    `przypisz-kategorie-zastosowanie: ${zmiany.length} produktów do zmiany, ${juzOk} już zgodnych, ` +
      `${niejednoznaczne.length} nazw niejednoznacznych (pominięte), ${bezProduktu.length} nazw z CSV bez produktu w bazie.`,
  );

  const poTriggerze = new Map<string, string>();
  if (apply) {
    const znacznik = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
    const katalog = join(dirname(dbPath), "backups");
    mkdirSync(katalog, { recursive: true });
    const kopia = join(katalog, `${basename(dbPath)}.bak_przypisanie_kat_zast_${znacznik}`);
    sqlite.prepare("VACUUM INTO ?").run(kopia);
    console.log(`przypisz-kategorie-zastosowanie: kopia bazy: ${kopia}`);
    const teraz = new Date().toISOString().replace("T", " ").slice(0, 19);
    const upd = sqlite.prepare("UPDATE products SET kategoria=?, zastosowanie=? WHERE kod=?");
    const odczyt = sqlite.prepare("SELECT kategoria, zastosowanie FROM products WHERE kod=?");
    const hist = sqlite.prepare(
      "INSERT INTO history (data,kod_produktu,nazwa,pole,stara_wartosc,nowa_wartosc,zrodlo,kto) VALUES (?,?,?,?,?,?,?,?)",
    );
    sqlite.transaction(() => {
      for (const z of zmiany) {
        upd.run(z.kat, z.zast, z.kod);
        const po = odczyt.get(z.kod) as { kategoria: string; zastosowanie: string | null };
        poTriggerze.set(z.kod, `${po.kategoria} / ${po.zastosowanie ?? ""}`);
        if (po.kategoria !== z.staraKat)
          hist.run(teraz, z.kod, z.nazwa, "kategoria", z.staraKat, po.kategoria, "przypisanie-kat-zast", "Anna");
        if ((po.zastosowanie ?? "") !== z.staraZast)
          hist.run(teraz, z.kod, z.nazwa, "zastosowanie", z.staraZast, po.zastosowanie ?? "", "przypisanie-kat-zast", "Anna");
      }
    })();
    const rozjazd = zmiany.filter((z) => poTriggerze.get(z.kod) !== `${z.kat} / ${z.zast}`).length;
    console.log(`przypisz-kategorie-zastosowanie: zapisano ${zmiany.length}; ${rozjazd} poprawionych przez triggery (≠ plik).`);
  }

  if (plikRaportu) {
    const esc = (s: string): string => `"${s.replace(/"/g, '""')}"`;
    const linie = ["kod,nazwa,stara_kategoria,stare_zastosowanie,kategoria,zastosowanie,po_triggerze"];
    for (const z of zmiany)
      linie.push([z.kod, z.nazwa, z.staraKat, z.staraZast, z.kat, z.zast, poTriggerze.get(z.kod) ?? ""].map(esc).join(","));
    for (const n of niejednoznaczne) linie.push(["", n, "", "", "", "", "NIEJEDNOZNACZNA — pominięta"].map(esc).join(","));
    writeFileSync(plikRaportu, "\uFEFF" + linie.join("\n"), "utf-8");
  }
} finally {
  sqlite.close();
}
