// Przebudowa nazw MO9 (BKT/Agrorami) — WYLACZNIE 4 zgloszone problemy:
//  (1) VF/IF przed rozmiarem, (2) CFO/NRO/CHO po rozmiarze, (3) indeks sklejony/zdublowany w modelu,
//  (4) liczba (szer. felgi) w MAGLIFT.
// Filtr celowosci: bierzemy wiersz TYLKO jesli zmiana dotyczy jednego z powyzszych, i pomijamy
// wiersze, ktorych roznica to wylacznie collateral (format rozmiaru x->X/trailing zero, zmiana
// wielkosci liter marki, drop tokenow typu HD) — te NIE sa czescia zgloszenia (zasada Space).
// NIE DOTYKA CEN. Domyslnie DRY-RUN; z --apply zapisuje.
'use strict';
const D = require('better-sqlite3');
const api = require('./parsers/mo9_agrorami_api.cjs');
const adapter = require('./parsers/adapter.cjs');
const APPLY = process.argv.includes('--apply');

// tokeny technologiczne, ktorych POZYCJA jest przedmiotem zgloszenia
const TECH = ['VF', 'IF', 'CFO', 'NRO', 'CHO'];

// Zbior "slow znaczacych" nazwy z pominieciem czystego formatu rozmiaru i wielkosci liter.
// Rozmiar (pierwszy token) normalizujemy agresywnie (usun X/-/. i zera koncowe), reszte tokenow
// porownujemy jako multiset wielkimi literami. Dzieki temu: przesuniecie VF/CFO => rozny multiset
// pozycyjny? nie — multiset ignoruje kolejnosc. Wiec KOLEJNOSC liczymy osobno.
const sizeCanon = (t) => String(t || '').toUpperCase().replace(/[X\-.,]/g, '').replace(/0+$/,'');
const tokens = (n) => String(n || '').toUpperCase().replace(/\s+/g, ' ').trim().split(' ');

// Czy roznica miedzy stara a nowa nazwa dotyczy pozycji tokenu TECH lub obecnosci indeksu w modelu?
function isTargetChange(oldN, newN, old, s) {
  const o = tokens(oldN), w = tokens(newN);
  // 1/2) przesuniecie TECH: w starej TECH byl na koncu (po TL/po modelu), w nowej z przodu/po rozmiarze
  const oTech = o.filter(t => TECH.includes(t));
  const wTech = w.filter(t => TECH.includes(t));
  if (oTech.length || wTech.length) {
    // pozycja pierwszego TECH tokenu
    const oIdx = o.findIndex(t => TECH.includes(t));
    const wIdx = w.findIndex(t => TECH.includes(t));
    // VF/IF w nowej sklejone z rozmiarem => nie ma osobnego tokenu, ale rozmiar zaczyna sie od VF/IF
    const wSizePrefixed = /^(VF|IF)\d/.test(w[0] || '');
    if (wSizePrefixed || wIdx <= 1) {
      // w starej byl dalej (na koncu) => to nasza poprawka kolejnosci
      if (wSizePrefixed || (oIdx > wIdx)) return true;
    }
    // roznica w samym zestawie TECH (np. zostawal w modelu) tez celowa
    if (oTech.join('/') !== wTech.join('/')) return true;
  }
  // 3) indeks: stary model zawieral doklejony/zdublowany indeks, nowy nie
  const idxRe = /\b\d{2,3}[A-Z]\d?\b/;
  const gluedRe = /[A-Za-z]\d{2,3}[A-Z]\d?/;
  const oM = String(old.model || '').toUpperCase();
  const nM = String(s.model || '').toUpperCase();
  if (oM !== nM) {
    if (gluedRe.test(oM) && !gluedRe.test(nM)) return true;      // sklejony indeks usuniety
    if (idxRe.test(oM) && !idxRe.test(nM)) return true;          // zdublowany indeks usuniety
    // 4) MAGLIFT/LIFTMAX: koncowa liczba usunieta
    if (/^(MAGLIFT|LIFTMAX|LIFT MAX)/.test(oM) && /\s\d{1,2}([.,]\d{1,2})?$/.test(oM) && !/\s\d{1,2}([.,]\d{1,2})?$/.test(nM)) return true;
  }
  return false;
}

(async () => {
  const db = new D('data.db');
  const existing = new Map();
  for (const r of db.prepare("SELECT id,kod,kod_dostawcy,nazwa,model,bieznik,indeks_nosnosci,indeks_predkosci,oznaczenie_bieznika FROM products WHERE dostawca='MO9'").all()) {
    if (r.kod_dostawcy != null) existing.set(String(r.kod_dostawcy), r);
  }
  console.log('MO9 w DB:', existing.size);
  const { items, totalCount } = await api.fetchAllItems();
  console.log('API pozycji:', items.length, '/ totalCount:', totalCount);

  const upd = db.prepare("UPDATE products SET nazwa=?, model=?, bieznik=?, indeks_nosnosci=?, indeks_predkosci=?, oznaczenie_bieznika=?, rodzaj=? WHERE id=?");
  const hist = db.prepare("INSERT INTO history(data,kod_produktu,nazwa,pole,stara_wartosc,nowa_wartosc,zrodlo,kto) VALUES(?,?,?,?,?,?,?,?)");
  const now = new Date().toISOString();

  let matched = 0, target = 0, skipped = 0, noMatch = 0;
  const samples = [], rows = [], byType = { vf: 0, cfonrocho: 0, indeks: 0, maglift: 0 };
  for (const it of items) {
    let rec, s;
    try { rec = api.itemToRecord(it); s = adapter.recordToSurowe(rec); } catch (e) { continue; }
    if (!s) continue;
    const key = String(s.kodDostawcy != null ? s.kodDostawcy : s.kod);
    const old = existing.get(key);
    if (!old) { noMatch++; continue; }
    matched++;
    const newNazwa = s.nazwa != null ? s.nazwa : old.nazwa;
    if (!isTargetChange(old.nazwa, newNazwa, old, s)) { if (old.nazwa !== newNazwa) skipped++; continue; }
    target++;
    if (samples.length < 25) samples.push(`${old.kod}\n   STARE: ${old.nazwa}\n   NOWE : ${newNazwa}`);
    rows.push({
      id: old.id, kod: old.kod, oldNazwa: old.nazwa, newNazwa,
      newModel: s.model != null ? s.model : old.model,
      newBieznik: s.bieznik != null ? s.bieznik : old.bieznik,
      newIn: s.indeksNosnosci != null ? String(s.indeksNosnosci) : (old.indeks_nosnosci || null),
      newIp: s.indeksPredkosci != null ? String(s.indeksPredkosci) : (old.indeks_predkosci || null),
      newOz: s.oznaczenieBieznika != null ? s.oznaczenieBieznika : (old.oznaczenie_bieznika || null)
    });
  }
  console.log('\ndopasowane:', matched, '| CELOWE:', target, '| pominięte (collateral, nie zgloszone):', skipped, '| bez dopasowania:', noMatch);
  console.log('\n=== PROBKI (max 25) ===');
  samples.forEach(x => console.log(x));

  if (APPLY) {
    const tx = db.transaction(() => {
      for (const r of rows) {
        upd.run(r.newNazwa, r.newModel, r.newBieznik, r.newIn, r.newIp, r.newOz, r.newOz, r.id);
        if (r.oldNazwa !== r.newNazwa) hist.run(now, r.kod, r.newNazwa || r.kod, 'nazwa', r.oldNazwa, r.newNazwa, 'fix_bkt_nazwa', 'Anna');
      }
    });
    tx();
    console.log('\nAPPLY: zaktualizowano wierszy:', rows.length);
  } else {
    console.log('\nDRY-RUN (bez --apply).');
  }
  db.close();
})();
