// MO1 Bohnenkamp parser
// Plik: bohnenkamp.csv
// Kodowanie: Windows-1250 (z artefaktem ® zamiast ę)
// Separator: ;
// BRAK NAGŁÓWKA - parser pozycyjny
//
// Struktura pozycyjna (zweryfikowana 10.06.2026):
//   A(0): kod_dostawcy   np. "10000085"
//   B(1): EAN            np. "8906117626978"
//   C(2): producent      np. "CEAT"
//   D(3): nazwa          np. "Opona VF 650 / 65 R 42 NRO, Torquemax" + opcjonalnie "(szt. X)" dla dętek
//   E(4): typ wentyla / specyfikacja techniczna
//   F(5): producent2     duplikat C
//   G(6): stała 1        IGNORUJEMY (stan magazynowy innego kraju)
//   H(7): cena           np. "6000,80" — cena zakupu PLN
//   I(8): IGNORUJEMY     stan magazynowy innego kraju (Anna 10.06)
//   J(9): IGNORUJEMY     stan magazynowy innego kraju
//   K(10): puste
//
// DECYZJA ANNY (10.06.2026):
//   - Stan magazynowy dla DĘTEK = liczba sztuk z "(szt. X)" w nazwie
//   - Stan magazynowy dla OPON = null (Bohnenkamp nie podaje polskiego stanu krajowego)
//   - Cena H = cena zakupu (PLN, za jednostkę)
//   - Kolumny G/I/J ignorujemy (stany krajowe innych krajow)

const { parse } = require('csv-parse/sync');
const iconv = require('iconv-lite');
const fs = require('fs');
const c = require('../common.cjs');

const DOSTAWCA = 'MO1_Bohnenkamp';

// Lista kodów dostawcy, ktore NIE maja byc importowane do Bridge w ogole.
// Powody: pozycje spoza profilu katalogu rolniczego (np. opony ciezarowe)
// lub bledne pozycje, ktore nie powinny trafiac do stagingu.
// Dopisywac surowy kod_dostawcy z kolumny A CSV (bez prefiksu MO1).
const KOD_BLOCKLIST = new Set([
  '19912122', // Opona 315/70R22.5 Boka Terra II - opona ciezarowa, poza profilem (Anna 07.07.2026)
]);

// Opcjonalnie: blokada po EAN jako dodatkowa siec bezpieczenstwa
const EAN_BLOCKLIST = new Set([
  '4040658084928', // 19912122 / Boka Terra II 315/70R22.5
]);

function parseFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  const text = iconv.decode(buffer, 'cp1250');

  const rows = parse(text, {
    delimiter: ';',
    columns: false, // BRAK NAGŁÓWKA
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true
  });

  const records = [];
  const errors = [];

  const sztPat = /\(szt\.?\s*(\d+)\)/i;

  for (const row of rows) {
    try {
      if (row.length < 9) {
        errors.push({ row, error: `Wiersz ma ${row.length} kolumn, oczekiwane min 9` });
        continue;
      }

      const kodDostawcy = row[0];
      const ean = c.normalizeEan(row[1]);

      // Anna 07.07.2026: blokada konkretnych pozycji (po kod_dostawcy i/lub EAN)
      // - pozycje spoza profilu katalogu rolniczego
      if (KOD_BLOCKLIST.has(String(kodDostawcy).trim()) || (ean && EAN_BLOCKLIST.has(String(ean).trim()))) {
        continue;
      }
      const producent = row[2];
      let nazwa = c.normalizeText(row[3]); // m.in. ® → ę
      const specyfikacja = c.normalizeText(row[4]); // typ wentyla dla dętek
      const cena = row[7];
      // Stan z kolumny I (row[8]) IGNORUJEMY — to stan magazynu innego kraju (decyzja Anny 10.06)

      // Ekstrakcja (szt. X) z nazwy — dla dętek to LICZBA SZTUK na magazynie (decyzja Anny)
      let stanZNazwy = null;
      const sztMatch = nazwa.match(sztPat);
      if (sztMatch) {
        stanZNazwy = parseInt(sztMatch[1], 10);
        // Usuwamy z nazwy
        nazwa = nazwa.replace(sztPat, '').replace(/,\s*$/, '').trim();
      }

      const sizeFromName = c.extractSize(nazwa);
      // Klasyfikacja: po nazwie (Bohnenkamp nie ma pola kategorii w pliku)
      const kategoria = c.classifyByName(nazwa);

      // Anna 01.07: odrzucamy dętki (Dong Ah, SCHLAUCH) i akcesoria (WULSTBAND, obręcze, O-RING)
      if (kategoria === 'dętki' || kategoria === 'akcesoria') {
        continue;
      }

      // Anna 01.07: wyciągamy model z nazwy (po przecinku) lub ze specyfikacji.
      // Wzorce Bohnenkamp:
      //   "Opona 360/70 R 28, Agri Star II"    -> model = "Agri Star II"
      //   "Opona 10.00 - 20, 839"              -> model = "839"
      //   "OPONA 5.00 - 8" + spec "10 PR, TT, YARDMASTER" -> model = "YARDMASTER"
      let modelBieznik = '';
      // 1) Próba: z nazwy po przecinku (ostatnia część, jeśli nie zawiera cyfr rozmiaru)
      const nazwaSplit = nazwa.split(',').map(s => s.trim()).filter(Boolean);
      if (nazwaSplit.length >= 2) {
        // Wszystko po pierwszym przecinku poza czystymi tokenami (szt., PR, TL, TT itp.)
        const cand = nazwaSplit.slice(1).join(', ').trim();
        // Odrzuć jeśli wygląda na czysty rozmiar/oznaczenia (bez liter oznaczających model)
        if (cand && /[A-Za-z]{3,}/.test(cand) && !/^\d/.test(cand)) {
          modelBieznik = cand;
        } else if (cand && /^\d{2,4}(\s|$|\s*[IVX]+)/.test(cand)) {
          // Numer modelu typu "839", "585", "350", "590"
          modelBieznik = cand;
        }
      }
      // 2) Fallback: ze specyfikacji (kol.4) — ostatni token po przecinku jeśli duże litery
      if (!modelBieznik && specyfikacja) {
        const specTokens = specyfikacja.split(',').map(s => s.trim()).filter(Boolean);
        // Szukamy tokenu cały dużymi literami, min 4 znaki (np. YARDMASTER)
        const modelToken = specTokens.reverse().find(t => /^[A-Z][A-Z0-9\s\-]{3,}$/.test(t) && !/^(TL|TT|PR|VF|IF|HD|BIB|LSL|C\.R\.|H\.R\.|E3|L3|L2|R1|R\-W|LS-\d)/.test(t));
        if (modelToken) {
          modelBieznik = modelToken;
        }
      }

      // Stan magazynowy: dla opon null (dętki już odrzucone wyżej)
      const stan = null;

      const oznaczenia = [
        ...c.extractTechnicalMarks(nazwa),
        ...c.extractTechnicalMarks(specyfikacja)
      ];
      const oznaczeniaUnique = [...new Set(oznaczenia)];

      const rec = c.normalizeRecord({
        ean: ean,
        kod_dostawcy: kodDostawcy,
        nazwa: nazwa,
        producent: producent,
        model_bieznik: modelBieznik,
        rozmiar: sizeFromName.rozmiar,
        rozmiar_alternatywny: sizeFromName.alternatywny,
        cena_zakupu: cena,
        stan_magazynowy: stan,
        kategoria: kategoria,
        oznaczenia_techniczne: oznaczeniaUnique,
        dostawca: DOSTAWCA,
        surowe_pola: { row, specyfikacja }
      });
      records.push(rec);
    } catch (e) {
      errors.push({ row, error: e.message });
    }
  }

  return { records, errors, dostawca: DOSTAWCA };
}

module.exports = { parseFile, DOSTAWCA };
