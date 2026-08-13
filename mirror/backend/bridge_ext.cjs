// bridge_ext.cjs — rozszerzenia importu dla Bridge (Agrowiec)
// 1) Reguła wymiarów opon (wysokosc/szerokosc/dlugosc/szerokosc_paczki/wysokosc_przesylki)
//    liczona z pola `rozmiar` przez tire_dims.js.
// 2) Pamięć linków do zdjęć — odtwarzanie link_zdjecia przy imporcie:
//    najpierw po kodzie (link_pamiec_kod), zapasowo po producent|model|rozmiar (link_pamiec_mr).
//    Guard: import NIGDY nie nadpisuje istniejącego link_zdjecia pustym/null.
// Moduł jest defensywny: każdy błąd jest łapany, żeby nie wywrócić importu.

const path = require('path');

let packageDims = null, tireWidthMm = null;
try {
  ({ packageDims, tireWidthMm } = require('./tire_dims.js'));
} catch (e) {
  try { ({ packageDims, tireWidthMm } = require(path.join(__dirname, 'tire_dims.js'))); } catch (_) {}
}

// Znormalizowany klucz producent|model|rozmiar (jak w tabeli link_pamiec_mr)
function mrKey(marka, model, rozmiar) {
  const norm = v => String(v == null ? '' : v).trim().toUpperCase().replace(/\s+/g, ' ');
  const p = norm(marka), m = norm(model), r = norm(rozmiar);
  if (!p && !m && !r) return null;
  return `${p}|${m}|${r}`;
}

function isEmptyLink(v) {
  return v === null || v === undefined || String(v).trim() === '';
}

// --- Reguła wymiarów -----------------------------------------------------
// Ustawia wymiary na obiekcie produktu (P) na podstawie rozmiaru.
// rozmiarFallback pozwala podać rozmiar, jeśli P.rozmiar jest pusty (np. staging snapshot).
// Zwraca policzone wymiary (albo null) — przydatne do zapisu wysokosc_przesylki raw-em,
// gdyby schemat Drizzle jej nie obejmował.
function applyDims(P, rozmiarFallback) {
  try {
    if (!packageDims) return null;
    const rozmiar = (P && P.rozmiar != null && P.rozmiar !== '') ? P.rozmiar : rozmiarFallback;
    if (!rozmiar) return null;
    const d = packageDims(rozmiar);
    if (!d) return null;
    P.wysokosc = d.wysokosc;                 // wysokosc PACZKI (cm)
    P.dlugosc = d.dlugosc;                   // dlugosc PACZKI (cm)
    P.szerokoscPaczki = d.szerokosc_paczki;  // szerokosc PACZKI (cm)
    P.wysokoscPrzesylki = d.wysokosc_przesylki; // działa TYLKO jeśli schemat Drizzle ma to pole
    // POPRAWKA 2026-07-14: `szerokosc` to REALNA szerokosc opony w mm (parametr techniczny),
    // NIE wolno jej mylic z wymiarami paczki powyzej. Dotychczas applyDims nadpisywala ją
    // blednie wartoscia w cm z pakowania (np. 235mm -> 24cm), co dawalo bezsensowne dane
    // klientom (i m.in. powodowalo identyczne/bledne "szerokosci" dla wielu Nokianow).
    // Priorytet: jesli parser juz ustawil sensowna szerokosc opony (np. tyre_params.parseSize
    // dala 235 dla "235/75R17.5"), NIE nadpisujemy jej — parser ma czasem lepszy kontekst
    // (np. warianty producenta). Nadpisujemy tylko gdy pole jest puste/null.
    if ((P.szerokosc == null || P.szerokosc === '') && tireWidthMm) {
      const w = tireWidthMm(rozmiar);
      if (w != null) P.szerokosc = w;
    }
    return d;
  } catch (_) { return null; }
}

// --- Pamięć linków -------------------------------------------------------
// db = uchwyt better-sqlite3 (surowe zapytania). existing = istniejący wiersz produktu (albo null).
// Uzupełnia P.linkZdjecia jeśli pusty: najpierw po kodzie, potem po producent|model|rozmiar.
// Guard: jeśli import przyniósł pusty link, a istnieje stary — zachowaj stary.
function applyLinkMemory(db, P, existing) {
  try {
    if (!db) return;
    // 0) PRIORYTET PAMIĘCI dla Agro-Rami (MO9): pamięć po kodzie nadpisuje link
    //    z importu (np. Grasdorf), żeby ręcznie ustawione zdjęcia Agrorami nie
    //    ginęły przy kolejnych importach. Dotyczy tylko dostawcy MO9.
    const _isMO9 = String(P.dostawca || '') === 'MO9' || /^MO9[_-]/i.test(String(P.kod || ''));
    if (_isMO9 && P.kod) {
      const rowP = db.prepare('SELECT link FROM link_pamiec_kod WHERE kod=?').get(String(P.kod));
      if (rowP && !isEmptyLink(rowP.link)) {
        P.linkZdjecia = rowP.link;
        return; // pamięć MO9 ma pierwszeństwo — nie kontynuuj
      }
    }
    // 1) Guard: nie nadpisuj istniejącego linku pustym
    if (isEmptyLink(P.linkZdjecia) && existing && !isEmptyLink(existing.link_zdjecia || existing.linkZdjecia)) {
      P.linkZdjecia = existing.link_zdjecia || existing.linkZdjecia;
    }
    // 2) Jeśli nadal pusty — odtwórz z pamięci po kodzie
    if (isEmptyLink(P.linkZdjecia) && P.kod) {
      const row = db.prepare('SELECT link FROM link_pamiec_kod WHERE kod=?').get(String(P.kod));
      if (row && !isEmptyLink(row.link)) P.linkZdjecia = row.link;
    }
    // 3) Zapasowo — po producent|model|rozmiar
    if (isEmptyLink(P.linkZdjecia)) {
      const k = mrKey(P.marka, P.model, P.rozmiar);
      if (k) {
        const row = db.prepare('SELECT link FROM link_pamiec_mr WHERE mrkey=?').get(k);
        if (row && !isEmptyLink(row.link)) P.linkZdjecia = row.link;
      }
    }
  } catch (_) {}
}

// Zapisuje aktualny link produktu do pamięci (po kodzie + po producent|model|rozmiar),
// żeby przetrwał wyczyszczenie katalogu i kolejne importy. Wywoływać PO zapisaniu produktu.
function rememberLink(db, P) {
  try {
    if (!db || isEmptyLink(P.linkZdjecia)) return;
    const now = new Date().toISOString();
    if (P.kod) {
      db.prepare('INSERT INTO link_pamiec_kod (kod,link,updated_at) VALUES (?,?,?) ' +
        'ON CONFLICT(kod) DO UPDATE SET link=excluded.link, updated_at=excluded.updated_at')
        .run(String(P.kod), String(P.linkZdjecia), now);
    }
    const k = mrKey(P.marka, P.model, P.rozmiar);
    if (k) {
      db.prepare('INSERT INTO link_pamiec_mr (mrkey,link,updated_at) VALUES (?,?,?) ' +
        'ON CONFLICT(mrkey) DO UPDATE SET link=excluded.link, updated_at=excluded.updated_at')
        .run(k, String(P.linkZdjecia), now);
    }
  } catch (_) {}
}

// Upewnij się, że tabele pamięci istnieją (idempotentne).
function ensureMemoryTables(db) {
  try {
    if (!db) return;
    db.exec(
      'CREATE TABLE IF NOT EXISTS link_pamiec_kod (kod TEXT PRIMARY KEY, link TEXT, updated_at TEXT);' +
      'CREATE TABLE IF NOT EXISTS link_pamiec_mr (mrkey TEXT PRIMARY KEY, link TEXT, updated_at TEXT);'
    );
  } catch (_) {}
}


// --- kod_importu (wielomagazynowosc Selly) -------------------------------
// Wspolny 6-cyfrowy numer dla tego samego produktu we wszystkich magazynach.
// Klucz grupujacy: EAN (gdy poprawny) LUB producent|rozmiar|bieznik|nazwa (znormalizowane).
// Logika: 1) istniejacy produkt (ten sam kod) zachowuje swoj numer;
//         2) inny magazyn tego samego produktu dziedziczy numer z grupy;
//         3) nowy produkt dostaje nowy, unikalny numer.
// Wywolywac PRZED zapisem produktu; ustawia P.kodImportu.
function _kiNorm(v){ return String(v==null?'':v).toLowerCase().replace(/\s+/g,' ').trim(); }
function _kiGroupKey(P){
  const eanOk = P.ean && String(P.ean).trim()!=='' && (P.eanIsValid===1||P.eanIsValid===true);
  if (eanOk) return 'EAN:'+String(P.ean).trim();
  return 'FB:'+[_kiNorm(P.marka),_kiNorm(P.rozmiar),_kiNorm(P.bieznik),_kiNorm(P.nazwa)].join('|');
}
function _kiGenUnique(db){
  for(let i=0;i<100000;i++){
    const n=String(Math.floor(100000+Math.random()*900000));
    const hit=db.prepare('SELECT 1 FROM products WHERE kod_importu=? LIMIT 1').get(n);
    if(!hit) return n;
  }
  throw new Error('brak wolnych numerow kod_importu');
}
function assignKodImportu(db, P, existing){
  try{
    if(!db||!P) return;
    // 1) istniejacy produkt (ten sam kod) ma juz numer -> zachowaj
    if(existing && existing.kod_importu && /^\d{6}$/.test(String(existing.kod_importu))){
      P.kodImportu = String(existing.kod_importu); return;
    }
    // 2) poszukaj w katalogu innego rekordu tej samej grupy
    const eanOk = P.ean && String(P.ean).trim()!=='' && (P.eanIsValid===1||P.eanIsValid===true);
    let row=null;
    if(eanOk){
      row=db.prepare("SELECT kod_importu FROM products WHERE ean=? AND ean_is_valid=1 AND kod_importu IS NOT NULL AND kod_importu!='' LIMIT 1").get(String(P.ean).trim());
    } else {
      row=db.prepare("SELECT kod_importu FROM products WHERE (ean IS NULL OR ean='' OR ean_is_valid IS NOT 1) AND lower(trim(COALESCE(marka,'')))=? AND lower(trim(COALESCE(rozmiar,'')))=? AND lower(trim(COALESCE(bieznik,'')))=? AND lower(trim(COALESCE(nazwa,'')))=? AND kod_importu IS NOT NULL AND kod_importu!='' LIMIT 1")
        .get(_kiNorm(P.marka),_kiNorm(P.rozmiar),_kiNorm(P.bieznik),_kiNorm(P.nazwa));
    }
    if(row && row.kod_importu && /^\d{6}$/.test(String(row.kod_importu))){
      P.kodImportu = String(row.kod_importu); return;
    }
    // 3) nowy produkt -> nowy unikalny numer
    P.kodImportu = _kiGenUnique(db);
  }catch(_){ /* defensywnie: nie wywracaj importu */ }
}

// --- nazwa_pamiec (trwala ochrona recznie ujednoliconych nazw przy scalaniu) ---
// Jesli dla danego kod_importu istnieje zapamietana nazwa (ustawiona recznie przy
// scalaniu produktow), uzyj jej zamiast nazwy przychodzacej ze swiezego importu.
// Wywolywac PO assignKodImportu (bo potrzebuje P.kodImportu), PRZED zapisem produktu.
function ensureNazwaPamiecTable(db){
  try{
    db.exec('CREATE TABLE IF NOT EXISTS nazwa_pamiec (kod_importu TEXT PRIMARY KEY, nazwa TEXT NOT NULL, updated_at TEXT, source TEXT);');
  }catch(_){}
}
function applyNazwaPamiec(db, P){
  try{
    if(!db||!P||!P.kodImportu) return;
    ensureNazwaPamiecTable(db);
    const row = db.prepare('SELECT nazwa FROM nazwa_pamiec WHERE kod_importu=?').get(String(P.kodImportu));
    if(row && row.nazwa){
      P.nazwa = row.nazwa;
    }
  }catch(_){ /* defensywnie: nie wywracaj importu */ }
}
function rememberNazwaPamiec(db, kodImportu, nazwa, source){
  try{
    if(!db||!kodImportu||!nazwa) return;
    ensureNazwaPamiecTable(db);
    db.prepare('INSERT OR REPLACE INTO nazwa_pamiec (kod_importu, nazwa, updated_at, source) VALUES (?, ?, datetime(\'now\'), ?)').run(String(kodImportu), String(nazwa), source||'manual');
  }catch(_){}
}

// --- waga_pamiec (trwala ochrona recznie uzupelnionej wagi produktu) ---
// Klucz: kod produktu (waga jest fizyczna cecha KONKRETNEGO produktu/dostawcy,
// nie cechy wspolnej grupy scalonej — inaczej niz nazwa_pamiec).
// Guard: import NIGDY nie nadpisuje istniejacej sensownej wagi (>0) wartoscia
// pusta/null/0 — analogicznie do reguly dla link_zdjecia.
// Wywolywac PRZED zapisem produktu (moze dzialac niezaleznie od kod_importu).
function ensureWagaPamiecTable(db){
  try{
    db.exec('CREATE TABLE IF NOT EXISTS waga_pamiec (kod TEXT PRIMARY KEY, waga REAL NOT NULL, updated_at TEXT, source TEXT);');
  }catch(_){}
}
function isEmptyWaga(v){
  return v === null || v === undefined || v === '' || Number(v) === 0 || Number.isNaN(Number(v));
}
function applyWagaPamiec(db, P, existing){
  try{
    if(!db||!P||!P.kod) return;
    ensureWagaPamiecTable(db);
    const row = db.prepare('SELECT waga FROM waga_pamiec WHERE kod=?').get(String(P.kod));
    if(row && !isEmptyWaga(row.waga)){
      // pamiec ma priorytet nad swiezym importem, jesli import nie podaje sensownej wagi
      // lub podaje inna niz zapamietana recznie ustawiona wartosc
      if(isEmptyWaga(P.waga)){
        P.waga = row.waga;
      }
      return;
    }
    // brak wpisu w pamieci: jesli istniejacy produkt w bazie mial sensowna wage,
    // a swiezy import przynosi puste/0 — zachowaj stara wartosc (guard jak dla zdjec)
    if(existing && !isEmptyWaga(existing.waga) && isEmptyWaga(P.waga)){
      P.waga = existing.waga;
    }
  }catch(_){ /* defensywnie: nie wywracaj importu */ }
}
function rememberWaga(db, kod, waga, source){
  try{
    if(!db||!kod||isEmptyWaga(waga)) return;
    ensureWagaPamiecTable(db);
    db.prepare('INSERT OR REPLACE INTO waga_pamiec (kod, waga, updated_at, source) VALUES (?, ?, datetime(\'now\'), ?)').run(String(kod), Number(waga), source||'manual');
  }catch(_){}
}

module.exports = { applyDims, applyLinkMemory, rememberLink, ensureMemoryTables, mrKey, assignKodImportu, applyNazwaPamiec, rememberNazwaPamiec, ensureNazwaPamiecTable, applyWagaPamiec, rememberWaga, ensureWagaPamiecTable };
