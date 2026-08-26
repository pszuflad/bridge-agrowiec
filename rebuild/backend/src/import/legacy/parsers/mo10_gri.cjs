// MO10 GRI parser
// Dostawca wysyła cennik pod tym samym URL raz jako CSV (Windows-1250, separator ";"),
// raz jako prawdziwy plik XLSX (Anna 14.07: dostawca zmienił format bez zmiany adresu URL,
// co powodowało błąd "Invalid Opening Quote" — parser CSV próbował czytać binarny ZIP/XLSX).
// Rozwiązanie: wykrywamy realny format na podstawie sygnatury bajtów pliku (PK\x03\x04 = ZIP/XLSX),
// niezależnie od rozszerzenia w URL/nazwie pliku, i parsujemy odpowiednią ścieżką.
//
// Kolumny (oba formaty): NR KAT, EAN, Bieżnik, Rozmiar, ilość, cena netto/szt, [AKCJA ...]

const { parse } = require('csv-parse/sync');
const iconv = require('iconv-lite');
const fs = require('fs');
const XLSX = require('xlsx');
const c = require('../common.cjs');

const DOSTAWCA = 'MO10_GRI';
const PRODUCENT_DOMYSLNY = 'GRI';

// Sygnatura ZIP (XLSX/XLSM/DOCX itd. to kontenery ZIP) — pierwsze 4 bajty "PK\x03\x04".
function isZipBuffer(buffer) {
  return buffer.length >= 4 &&
    buffer[0] === 0x50 && buffer[1] === 0x4B &&
    buffer[2] === 0x03 && buffer[3] === 0x04;
}

// Wczytuje wiersze jako tablicę obiektów { header: value } niezależnie od formatu źródłowego.
function readRows(filePath) {
  const buffer = fs.readFileSync(filePath);

  if (isZipBuffer(buffer)) {
    // Prawdziwy XLSX — czytamy pierwszy arkusz przez SheetJS.
    const workbook = XLSX.readFile(filePath, {
      cellFormula: false,
      cellDates: false,
      cellNF: false,
      cellText: false,
      raw: true,
    });
    const sheetName = workbook.SheetNames[0];
    const ws = workbook.Sheets[sheetName];
    // defval: '' żeby brakujące komórki (np. AKCJA bez wartości) nie psuły kluczy obiektu.
    const rows = XLSX.utils.sheet_to_json(ws, { raw: true, defval: '' });
    // Normalizacja: wartości liczbowe SheetJS (np. EAN jako number) na string, żeby dalszy
    // kod (c.normalizeEan, regexy) działał identycznie jak dla CSV.
    return rows.map(row => {
      const out = {};
      for (const [k, v] of Object.entries(row)) {
        out[k.trim()] = v === null || v === undefined ? '' : (typeof v === 'string' ? v.trim() : v);
      }
      return out;
    });
  }

  // CSV klasyczny — kodowanie Windows-1250, separator ";".
  const text = iconv.decode(buffer, 'cp1250');
  return parse(text, {
    delimiter: ';',
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true
  });
}

function parseFile(filePath) {
  const rows = readRows(filePath);

  const records = [];
  const errors = [];

  // POPRAWKA 2026-07-01 (v8): fallback ceny.
  // W źródłowym XLSX GRI kolumna F ("cena netto/szt") może być przekreślona
  // (formatting Excela) gdy pozycja ma promocję — wówczas właściwa cena jest w kolumnie G
  // (np. "AKCJA Wiosna"). Excel export do CSV traci info o przekreśleniu, ale zachowuje
  // wartość kol G jeśli istnieje. Wykrywamy kolę promocyjną po nagłówku (regex /AKCJA/i)
  // i jeśli ma wartość numeryczną, używamy jej zamiast "cena netto/szt".
  const allKeys = rows.length > 0 ? Object.keys(rows[0]) : [];
  const promoKey = allKeys.find(k => /akcja|promo/i.test(k));

  for (const row of rows) {
    try {
      const nazwa = `OPONA ${row['Bieżnik'] || ''} ${row['Rozmiar'] || ''}`.trim();
      const size = c.extractSize(nazwa);

      // Wybór ceny: kol G (promocja) ma priorytet gdy zawiera wartość numeryczną,
      // w przeciwnym razie kol F.
      let cena = row['cena netto/szt'];
      if (promoKey) {
        const promoRaw = row[promoKey];
        if (promoRaw && String(promoRaw).replace(/[^\d]/g, '').length > 0) {
          cena = promoRaw;
        }
      }

      const rec = c.normalizeRecord({
        ean: c.normalizeEan(row['EAN']),
        kod_dostawcy: row['NR KAT'],
        nazwa: nazwa,
        producent: PRODUCENT_DOMYSLNY,
        model_bieznik: row['Bieżnik'],
        rozmiar: size.rozmiar || row['Rozmiar'],
        rozmiar_alternatywny: size.alternatywny,
        cena_zakupu: cena,
        stan_magazynowy: row['ilość'],
        kategoria: c.classifyByName(nazwa, size.rozmiar || row['Rozmiar']),
        oznaczenia_techniczne: c.extractTechnicalMarks(nazwa),
        dostawca: DOSTAWCA,
        surowe_pola: row
      });
      records.push(rec);
    } catch (e) {
      errors.push({ row, error: e.message });
    }
  }

  return { records, errors, dostawca: DOSTAWCA };
}

module.exports = { parseFile, DOSTAWCA };
