// MO7 Nokian parser
// Plik: CennikNokianCSV.csv
// Kodowanie: Windows-1250
// Separator: ;
// Decyzja Anny: cena = "Zakup 1 szt" (jedyne pole, ignorujemy Detal i Zakup min 2)

const { parse } = require('csv-parse/sync');
const iconv = require('iconv-lite');
const fs = require('fs');
const c = require('../common.cjs');

const DOSTAWCA = 'MO7_Nokian';

// Mapowanie rodzaju z pliku → kategorii
const RODZAJ_MAP = {
  'ROLNICZA': 'rolnicze',
  'ROLNICZE': 'rolnicze',
  'LEŚNA': 'leśne',
  'LESNA': 'leśne',
  'LEŚNE': 'leśne',
  'PRZEMYSŁOWA': 'przemysłowe',
  'PRZEMYSLOWA': 'przemysłowe',
  'PRZEMYSŁOWE': 'przemysłowe',
  'CIĘŻAROWA': 'ciężarowe',
  'CIEZAROWA': 'ciężarowe',
  'CIĘŻAROWE': 'ciężarowe'
};

function parseFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  const text = iconv.decode(buffer, 'cp1250');

  const rows = parse(text, {
    delimiter: ';',
    columns: header => header.map(h => h ? h.trim() : h),
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true
  });

  const records = [];
  const errors = [];

  for (const row of rows) {
    try {
      const model = row['MODEL'] || '';
      const producent = row['PRODUCENT'] || 'NOKIAN';
      const bieznik = row['BIEĹ»NIK'] || row['BIEŻNIK'] || '';
      const rozmiar = row['Rozmiar'] || '';
      const rozmiarAlt = row['Rozmiar alternatywny'] || '';
      const sfsb = row['SF/SB'] || '';
      const tltt = row['TL/TT'] || '';
      const lisi = row['LI/SI'] || '';
      const pr = row['PR'] || '';

      const nazwa = `OPONA ${rozmiar} ${model} ${lisi} ${tltt} ${sfsb}`.replace(/\s+/g, ' ').trim();

      const rodzajRaw = (row['RODZAJ'] || '').trim().toUpperCase();
      let kategoria = RODZAJ_MAP[rodzajRaw];
      if (!kategoria) {
        kategoria = c.classifyByName(nazwa);
      }

      // DECYZJA ANNY: cena = "Zakup 1 szt"
      const cena = row['Zakup 1 szt'];

      const oznaczenia = [
        ...c.extractTechnicalMarks(nazwa),
        ...(sfsb ? [sfsb.trim()] : []),
        ...(tltt ? [tltt.trim()] : [])
      ].filter(Boolean);
      // Dedup
      const oznaczeniaUnique = [...new Set(oznaczenia)];

      const rec = c.normalizeRecord({
        ean: c.normalizeEan(row['EAN']),
        kod_dostawcy: row['Kod produktu'],
        nazwa: nazwa,
        producent: producent,
        model_bieznik: model,
        rozmiar: rozmiar,
        rozmiar_alternatywny: rozmiarAlt || null,
        cena_zakupu: cena,
        stan_magazynowy: row['Magazyn'],
        kategoria: kategoria,
        oznaczenia_techniczne: oznaczeniaUnique,
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
