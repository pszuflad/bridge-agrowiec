// MO8 Trelleborg parser — WERSJA XLSX SYNC (v3, 2026-07-01)
// Anna 01.07: nowy format Trelleborg — plik XLSX z dwoma arkuszami:
//   - "Radial"   (15 kolumn, PLN w kol O, opony radialne TM/HF/MPT/MARSHLAND)
//   - "XPly"     (13 kolumn, PLN w kol M, opony ukośne TB/T/AW/AF)
// Struktura kolumn (obie arkusze):
//   A  Size (dla XPly wiersze grupujące ø18/ø28 z pustą B)
//   B  Size (rozmiar; może zawierać alt w nawiasie: "320/80-18 (12.5-18)")
//   C  TL / TT (może być "TT (TR13)" - typ + zawór)
//   D  Load Index/Speed Ix / PR ("139A8", "6 PR", "106A8(106B)", "8PR 105A8")
//   E  Pattern (model - TB40, T480 EXC, TM700 OV, T421)
//   F  IP Code (kod producenta)
//   G  Code EAN (13 cyfr lub "NA")
//   H  EPL in EUR
//   I  Rim
//   J  OD (mm)
//   K  SW (mm)
//   L  RC (mm)
//   -- Radial: M=Note, N=Item description, O=PLN
//   -- XPly:   M=PLN
// Zasady biznesowe (Anna 01.07):
//   - Note="In preparation" → ODRZUCAMY (produkt w przygotowaniu)
//   - Note="New" i "SD"     → importujemy normalnie
//   - Cena Radial: kol O (PLN)
//   - Cena XPly:   kol M (PLN)
//   - Stan magazynowy: 0 (nie ma pola w XLSX)
//   - LI/SI + PR rozdzielamy automatycznie
//   - VF/IF/CFO/PFO wyciągamy z Item description (Radial) lub Pattern (XPly)
//
// UWAGA: parseFile jest SYNCHRONICZNA (SheetJS pozwala) — dispatcher/nq w index.cjs
// wywołują parseByKod bez await, więc parser musi zwracać obiekt bez Promise.

const XLSX = require('xlsx');
const c = require('../common.cjs');

const DOSTAWCA = 'MO8_Trelleborg';

// ------------------------------- Helpers -------------------------------

// Rozbija Size na rozmiar główny i alternatywny.
// "320/80-18 (12.5-18)" -> { rozmiar: "320/80-18", alt: "12.5-18" }
// "320/80-18"           -> { rozmiar: "320/80-18", alt: null }
// "210/95R16"           -> { rozmiar: "210/95R16", alt: null }
function parseSize(raw) {
  if (raw === null || raw === undefined) return { rozmiar: null, alt: null };
  const s = String(raw).trim();
  if (!s) return { rozmiar: null, alt: null };
  const m = s.match(/^(.+?)\s*\((.+?)\)\s*$/);
  if (m) return { rozmiar: m[1].trim(), alt: m[2].trim() };
  return { rozmiar: s, alt: null };
}

// Rozbija TL/TT + zawór.
// "TL"          -> { typ: "TL", zawor: null }
// "TT (TR13)"   -> { typ: "TT", zawor: "TR13" }
// "TL (TR13)"   -> { typ: "TL", zawor: "TR13" }
function parseTlTt(raw) {
  if (!raw) return { typ: null, zawor: null };
  const s = String(raw).trim();
  const m = s.match(/^(TL|TT|TTF)\s*(?:\(([^)]+)\))?\s*$/i);
  if (m) return { typ: m[1].toUpperCase(), zawor: m[2] ? m[2].trim() : null };
  return { typ: s, zawor: null };
}

// Rozbija Load Index/Speed Ix / PR na osobne pola.
// "139A8"           -> { liSi: "139A8", liSiAlt: null, pr: null }
// "106A8(106B)"     -> { liSi: "106A8", liSiAlt: "106B", pr: null }
// "84A8 (80B)"      -> { liSi: "84A8", liSiAlt: "80B", pr: null }
// "6 PR" / "6PR"    -> { liSi: null, liSiAlt: null, pr: "6PR" }
// "8PR 105A8"       -> { liSi: "105A8", liSiAlt: null, pr: "8PR" }
// "132A8/128B"      -> { liSi: "132A8", liSiAlt: "128B", pr: null }
// "147A8/B"         -> { liSi: "147A8", liSiAlt: null, pr: null } (skrót Grasdorf-style; /B odrzucamy)
function parseLiSiPr(raw) {
  if (raw === null || raw === undefined) return { liSi: null, liSiAlt: null, pr: null };
  let s = String(raw).trim();
  if (!s) return { liSi: null, liSiAlt: null, pr: null };
  let pr = null;
  let liSi = null;
  let liSiAlt = null;

  // Wyciągamy PR (może być na początku "8PR 105A8" lub na końcu "6 PR")
  const prMatch = s.match(/\b(\d{1,2})\s*PR\b/i);
  if (prMatch) {
    pr = prMatch[1] + 'PR';
    s = s.replace(prMatch[0], ' ').replace(/\s+/g, ' ').trim();
  }

  // Wyciągamy LI/SI z alt w nawiasie: "106A8(106B)" lub "84A8 (80B)"
  const alt1 = s.match(/^(\d{2,3}[A-Z]\d?)\s*\((\d{2,3}[A-Z]\d?)\)$/);
  if (alt1) {
    return { liSi: alt1[1], liSiAlt: alt1[2], pr };
  }
  // Alt po ukośniku: "132A8/128B", "147A8/B" (skrót)
  const alt2 = s.match(/^(\d{2,3}[A-Z]\d?)\s*\/\s*(\d{2,3}[A-Z]\d?)?$/);
  if (alt2) {
    return { liSi: alt2[1], liSiAlt: alt2[2] || null, pr };
  }
  // Pojedynczy LI/SI: "139A8", "150A8"
  const single = s.match(/^(\d{2,3}\s?[A-Z]\d?)$/);
  if (single) {
    return { liSi: single[1].replace(/\s/g, ''), liSiAlt: null, pr };
  }
  // Fallback: co zostało po wycięciu PR
  if (s) liSi = s;
  return { liSi, liSiAlt, pr };
}

// Wyciąga VF/IF/CFO/PFO z Item description lub Pattern
function extractVfIfCfoPfo(desc, pattern) {
  const marks = new Set();
  const text = `${desc || ''} ${pattern || ''}`;
  if (/\bVF\b/.test(text)) marks.add('VF');
  if (/\bIF\b/.test(text)) marks.add('IF');
  if (/\bCFO\b/.test(text)) marks.add('CFO');
  if (/\bPFO\b/.test(text)) marks.add('PFO');
  return [...marks];
}

// Konwertuje wartość komórki SheetJS do trimmed stringa
function cellStr(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

// Bezpieczna konwersja do liczby (SheetJS zwraca number dla liczb, string dla tekstu)
function cellNum(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const cleaned = String(v).replace(/\s/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

// Wykrywa wiersz grupujący ("ø18" w kol A, kol B pusta)
function isSectionRow(rowVals) {
  const a = cellStr(rowVals[0]);
  const b = cellStr(rowVals[1]);
  return a && !b;
}

// -------------------------- Główna funkcja parsowania --------------------

function parseFile(filePath) {
  // SheetJS: synchroniczne czytanie pliku
  const workbook = XLSX.readFile(filePath, {
    cellFormula: false,   // wynik formuły zamiast obiektu
    cellDates: false,
    cellNF: false,
    cellText: false,
    raw: true,            // wartości surowe (number/string/boolean)
  });

  const records = [];
  const errors = [];
  const stats = {
    arkusze: {},
    odrzucone_in_preparation: 0,
    odrzucone_bez_rozmiaru: 0,
    total_wierszy: 0,
  };

  // Iteracja po arkuszach — obsługujemy TYLKO "Radial" i "XPly"
  for (const sheetName of workbook.SheetNames) {
    if (!['Radial', 'XPly'].includes(sheetName)) continue;
    const ws = workbook.Sheets[sheetName];

    // Konwertujemy arkusz na tablicę tablic (array of arrays) — [ [A1,B1,C1..], [A2,B2,C2..], ... ]
    // header:1 = pierwszy wiersz to nagłówki (nie interpretuj), raw defval:null zachowuje null
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false });
    if (!rows || rows.length < 2) continue;

    // Nagłówek: R0 (SheetJS liczy od 0), potem dane od R1
    const header = rows[0] || [];
    const colCount = Math.max(...rows.map(r => (r ? r.length : 0)));

    // Znajdujemy kolumny PLN / Note / Item description
    let plnCol = null;
    let noteCol = null;
    let descCol = null;
    for (let i = 0; i < header.length; i++) {
      const h = cellStr(header[i]);
      if (h === 'PLN') plnCol = i;
      else if (h === 'Note') noteCol = i;
      else if (h === 'Item description') descCol = i;
    }

    stats.arkusze[sheetName] = {
      max_row: rows.length,
      pln_col: plnCol !== null ? plnCol + 1 : null,  // 1-indexed dla czytelności
      note_col: noteCol !== null ? noteCol + 1 : null,
      desc_col: descCol !== null ? descCol + 1 : null,
      importowane: 0,
      pominiete_sekcje: 0,
    };

    for (let r = 1; r < rows.length; r++) {
      const rowVals = rows[r] || [];
      stats.total_wierszy++;

      // Pomijamy puste
      if (rowVals.every(v => v === null || v === undefined || v === '')) continue;

      // Wiersze grupujące (kol A wypełniona, B pusta)
      if (isSectionRow(rowVals)) {
        stats.arkusze[sheetName].pominiete_sekcje++;
        continue;
      }

      try {
        const sizeRaw = cellStr(rowVals[1]);       // kol B
        const tlttRaw = cellStr(rowVals[2]);        // kol C
        const liSiPrRaw = cellStr(rowVals[3]);      // kol D
        const pattern = cellStr(rowVals[4]);        // kol E
        const ipCode = cellStr(rowVals[5]);         // kol F
        const eanRaw = rowVals[6];                  // kol G
        const eplEur = rowVals[7];                  // kol H
        const rim = cellStr(rowVals[8]);            // kol I

        let note = null;
        let itemDesc = null;
        let pln = null;

        if (noteCol !== null) note = cellStr(rowVals[noteCol]);
        if (descCol !== null) itemDesc = cellStr(rowVals[descCol]);
        if (plnCol !== null) pln = rowVals[plnCol];

        // Anna 01.07: odrzucamy pozycje "In preparation"
        if (note === 'In preparation') {
          stats.odrzucone_in_preparation++;
          continue;
        }

        // Pomijamy wiersze bez rozmiaru
        if (!sizeRaw) {
          stats.odrzucone_bez_rozmiaru++;
          continue;
        }

        // Parsujemy rozmiar
        const { rozmiar, alt } = parseSize(sizeRaw);

        // TL/TT + zawór
        const { typ: tlTt, zawor } = parseTlTt(tlttRaw);

        // LI/SI + PR
        const { liSi, liSiAlt, pr } = parseLiSiPr(liSiPrRaw);

        // VF/IF/CFO/PFO
        const vfIfMarks = extractVfIfCfoPfo(itemDesc, pattern);

        // EAN — "NA" lub 13 cyfr (string/int)
        let ean = null;
        if (eanRaw !== null && eanRaw !== undefined) {
          const eanStr = String(eanRaw).trim();
          if (eanStr && eanStr !== 'NA') {
            ean = eanStr;
          }
        }

        // Nazwa: pełny opis dla klasyfikacji i wyszukiwania
        const nazwa = [
          'Opona',
          rozmiar,
          pattern,
          'Trelleborg',
          liSi || '',
          pr || '',
          tlTt || '',
          ...vfIfMarks,
        ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

        // Kategoria — klasyfikacja po nazwie
        let kategoria = c.classifyByName(nazwa);
        if (!kategoria) kategoria = 'rolnicze';

        // Oznaczenia techniczne
        const oznaczenia = [
          ...c.extractTechnicalMarks(nazwa),
          ...vfIfMarks,
          tlTt,
          zawor,
        ].filter(Boolean);
        const oznaczeniaUnique = [...new Set(oznaczenia)];

        // Cena PLN (Radial: kol O, XPly: kol M)
        const cenaZakupu = cellNum(pln);

        // POPRAWKA 2026-08-25: Trelleborg dla wielkoformatowych VF (HF1000, TM3000,
        // TM1000, PNEUTRAC VF) w XLSX zwraca pustą komórkę lub tekstową ("-", brak).
        // cellNum() daje null, potem tk() ma fallback "?? 0" → cena=0 i produkt trafia
        // do katalogu ze statusem 'wstrzymany' ale bez sygnału "na zapytanie".
        // Wzorzec identyczny jak MO7 Nokian VF Float King (poprawka 24.08).
        // detectPriceOnRequest wykrywa: sam myślnik, tekst bez cyfr, puste po usunięciu waluty.
        const uwagaCena = c.detectPriceOnRequest(pln);

        const rec = c.normalizeRecord({
          ean,
          kod_dostawcy: ipCode || null,
          nazwa,
          producent: 'Trelleborg',
          model_bieznik: pattern || '',
          rozmiar,
          rozmiar_alternatywny: alt,
          cena_zakupu: cenaZakupu,
          uwaga_cena: uwagaCena,
          stan_magazynowy: 0,  // Anna 01.07: stan zawsze 0
          kategoria,
          oznaczenia_techniczne: oznaczeniaUnique,
          dostawca: DOSTAWCA,
          surowe_pola: {
            // Klucze zgodne z adapter.cjs (case MO8) — normalizeTrelleborg czyta:
            //   Rozmiar, VF/IF, CFO, Rozmiar alternatywny, TT/TL, LI/SI, PR,
            //   PRODUCENT, RODZAJ, BIEZNIK (kluczKtoryZawieraBIE), Kod producenta,
            //   EAN (kluczKtoryZawieraEan), Cena, Magazyn
            'Rozmiar': rozmiar,
            'Rozmiar alternatywny': alt,
            'VF/IF': vfIfMarks.filter(m => ['VF', 'IF'].includes(m)).join('/') || null,
            'CFO': (vfIfMarks.includes('CFO') || vfIfMarks.includes('PFO')) ? 'CFO' : null,
            'TT/TL': tlTt,
            'TL/TT': tlTt,
            'LI/SI': [liSi, liSiAlt].filter(Boolean).join('/') || null,
            'PR': pr,
            'PRODUCENT': 'Trelleborg',
            'RODZAJ': 'rolnicze',
            'BIEZNIK': pattern || null,
            'Kod producenta': ipCode || null,
            'EAN': ean,
            'Cena': cenaZakupu,
            'Magazyn': 0,
            // Dodatkowe pola pomocnicze (dla debug/audytu)
            arkusz: sheetName,
            size_raw: sizeRaw,
            tl_tt_raw: tlttRaw,
            li_si_pr_raw: liSiPrRaw,
            pattern,
            ip_code: ipCode,
            ean_raw: eanRaw !== null && eanRaw !== undefined ? String(eanRaw) : '',
            epl_eur: eplEur,
            rim,
            note,
            item_description: itemDesc,
            pln,
            li_si: liSi,
            li_si_alt: liSiAlt,
            pr,
            zawor,
            typ_dętki: tlTt,
            vf_if_marks: vfIfMarks,
          },
        });

        records.push(rec);
        stats.arkusze[sheetName].importowane++;
      } catch (e) {
        errors.push({ row: r + 1, sheet: sheetName, error: e.message });
      }
    }
  }

  return { records, errors, dostawca: DOSTAWCA, stats };
}

module.exports = { parseFile, DOSTAWCA };
