// MO6 Agrowiec / Uniglory parser
// Plik: Cennik_Agrowiec.csv
// Kodowanie: UTF-8 z BOM
// Separator: ;
// Kolumny: EAN; Beschreibung; Beschreibung 2; Hersteller; Lagerbestand; Cena; Model; VF/IF; Kategoria

const { parse } = require('csv-parse/sync');
const iconv = require('iconv-lite');
const fs = require('fs');
const c = require('../common.cjs');

const DOSTAWCA = 'MO6_Agrowiec';

// Mapowanie kategorii z pliku → naszych
const KATEGORIA_MAP = {
  'rolnicze': 'rolnicze',
  'leśne': 'leśne',
  'lesne': 'leśne',
  'przemysłowe': 'przemysłowe',
  'przemyslowe': 'przemysłowe',
  'ciężarowe': 'ciężarowe',
  'ciezarowe': 'ciężarowe',
  'dętki': 'dętki',
  'detki': 'dętki',
  'akcesoria': 'akcesoria'
};

function parseFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  const text = iconv.decode(buffer, 'utf-8');

  const rows = parse(text, {
    delimiter: ';',
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
    trim: true
  });

  const records = [];
  const errors = [];

  for (const row of rows) {
    try {
      const rozmiar = row['Beschreibung'] || '';
      const nosnosc = row['Beschreibung 2'] || '';
      const model = row['Model'] || '';
      const producent = row['Hersteller'] || '';
      const vfif = row['VF/IF'] || '';
      const nazwa = `OPONA ${rozmiar} ${model} ${producent} ${vfif} ${nosnosc}`.replace(/\s+/g, ' ').trim();

      const kategoriaRaw = (row['Kategoria'] || '').toLowerCase();
      let kategoria = KATEGORIA_MAP[kategoriaRaw];
      if (!kategoria) {
        kategoria = c.classifyByName(nazwa);
      }

      const size = c.extractSize(rozmiar) || c.extractSize(nazwa);

      const rec = c.normalizeRecord({
        ean: c.normalizeEan(row['EAN']),
        kod_dostawcy: null, // Agrowiec nie ma własnego kodu
        nazwa: nazwa,
        producent: producent,
        model_bieznik: model,
        rozmiar: size.rozmiar || rozmiar,
        rozmiar_alternatywny: size.alternatywny,
        cena_zakupu: row['Cena'],
        stan_magazynowy: row['Lagerbestand'],
        kategoria: kategoria,
        oznaczenia_techniczne: [
          ...c.extractTechnicalMarks(nazwa),
          ...(vfif ? [vfif.trim()] : [])
        ].filter(Boolean),
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
