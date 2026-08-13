// DRY-RUN: napraw linki 'opony/NULL'. Dopasowanie: EAN->plik (pewne), potem rozmiar+model (zapasowe).
// Weryfikuje, że plik faktycznie istnieje w folderze opony/. NIC nie zapisuje.
const D = require('better-sqlite3'); const fs = require('fs');
const db = new D('/home/admin/private_apps/bridge/data.db', { readonly: true });
const BASE = 'https://agritires.eu/zdjecia-produktow/opony/';
const FOLDER = '/home/admin/domains/agritires.eu/public_html/zdjecia-produktow/opony/';

const ean2plik = JSON.parse(fs.readFileSync('/home/admin/private_apps/bridge/src_ean2plik.json', 'utf8'));
const bysize = JSON.parse(fs.readFileSync('/home/admin/private_apps/bridge/src_bysize.json', 'utf8'));
const filesSet = new Set(fs.readdirSync(FOLDER));

const digits = s => String(s || '').replace(/[^0-9]/g, '');
const STOP = new Set(['TL','TT','PR','BEZDETKOWA','DETKOWA','SET','ZESTAW','E','TIL']);
const norm = s => String(s || '').trim().toUpperCase().replace(/\s+/g, ' ');
const toks = s => norm(s).split(/[^A-Z0-9]+/).filter(t => t && !STOP.has(t) && t.length >= 2 && !/^\d+$/.test(t));

const bad = db.prepare("SELECT id,kod,dostawca,nazwa,ean,marka,model,rozmiar,link_zdjecia FROM products WHERE lower(link_zdjecia) LIKE '%null%'").all();

let byEan = 0, bySizeModel = 0, none = 0, fileMissing = 0;
const res = [], noneList = [];
for (const p of bad) {
  const e = (p.ean || '').trim();
  let plik = null, how = null;
  if (e && ean2plik[e]) { plik = ean2plik[e]; how = 'ean'; }
  if (!plik) {
    const cand = bysize[digits(p.rozmiar)] || [];
    if (cand.length) {
      const mtoks = toks((p.marka || '') + ' ' + (p.model || ''));
      const scored = cand.map(([tk, pl]) => { let h = 0; for (const t of mtoks) if (tk.includes(t)) h++; return { pl, r: mtoks.length ? h / mtoks.length : 0, h }; }).sort((a, b) => b.r - a.r || b.h - a.h);
      const top = scored[0];
      const tie = scored.filter(s => s !== top && s.r === top.r && s.h === top.h && s.pl !== top.pl);
      if (top && top.r >= 1 && top.h >= 1 && tie.length === 0) { plik = top.pl; how = 'sizemodel'; }
    }
  }
  if (!plik) { none++; noneList.push({ nazwa: p.nazwa, ean: e, rozmiar: p.rozmiar, marka: p.marka, model: p.model }); continue; }
  if (!filesSet.has(plik)) { fileMissing++; noneList.push({ nazwa: p.nazwa, ean: e, note: 'plik nie istnieje: ' + plik }); continue; }
  res.push({ id: p.id, kod: p.kod, how, link: BASE + plik });
  if (how === 'ean') byEan++; else bySizeModel++;
}
console.log('=== NAPRAWA linkow opony/NULL (dry) ===');
console.log('bledne (null) razem:', bad.length);
console.log('  po EAN (pewne):', byEan);
console.log('  po rozmiar+model (zapasowe):', bySizeModel);
console.log('  RAZEM dopasowane (plik istnieje):', res.length);
console.log('  plik z mapy nie istnieje w folderze:', fileMissing);
console.log('  bez dopasowania:', none);
console.log('\n=== przyklady dopasowane ===');
res.slice(0, 8).forEach(r => console.log('  [' + r.how + '] ' + r.kod + ' -> ' + r.link));
console.log('\n=== bez dopasowania / problem ===');
noneList.slice(0, 20).forEach(n => console.log('  ' + JSON.stringify(n)));
fs.writeFileSync('/home/admin/private_apps/bridge/null_fix_match.json', JSON.stringify(res));
console.log('\nzapisano null_fix_match.json (' + res.length + ')');
db.close();
