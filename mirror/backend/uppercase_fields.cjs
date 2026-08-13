'use strict';
// Etap 1 (baza): marka/model/bieznik -> WIELKIE litery (locale PL, obejmuje ż->Ż itd.)
// nazwa: odbudowa przez zamiane wystapien starych marka/model/bieznik na ich UPPER,
//        BEZ ruszania rozmiaru (male x zostaje), indeksow, TL/TT.
// DRY-RUN domyslnie; --apply zapisuje. History na kazde zmienione pole.
const D = require('better-sqlite3');
const APPLY = process.argv.includes('--apply');
const db = new D('data.db');

const UP = (s) => (s == null ? s : String(s).toLocaleUpperCase('pl-PL'));

// zamiana w nazwie: podmien wszystkie wystapienia oldVal (case-insensitive, jako calosc fragmentu) na UP(oldVal)
// Podmien w nazwie fragment rowny 'val' (case-insensitive) na jego wersje UPPER.
// Uzywamy WARTOSCI (moze byc juz wielka w kolumnie) i szukamy jej w nazwie niezaleznie od wielkosci liter.
function replaceInName(name, val) {
  if (!name || !val) return name;
  const up = UP(val);
  // 1) doslowne wystapienie 'val'
  if (val !== up && name.includes(val)) name = name.split(val).join(up);
  // 2) case-insensitive: znajdz fragment nazwy rowny 'val' i podmien na UP (lapie 'Farmax RC' gdy kolumna='FARMAX RC')
  const lowName = name.toLocaleLowerCase('pl-PL');
  const lowVal = val.toLocaleLowerCase('pl-PL');
  let from = 0, idx;
  while ((idx = lowName.indexOf(lowVal, from)) >= 0) {
    const seg = name.slice(idx, idx + val.length);
    if (seg !== up) name = name.slice(0, idx) + up + name.slice(idx + val.length);
    from = idx + val.length;
  }
  return name;
}

const rows = db.prepare("SELECT id, kod, dostawca, nazwa, marka, model, bieznik FROM products").all();
let chMarka=0, chModel=0, chBieznik=0, chNazwa=0, nameNoMatch=[];
const plan = [];
for (const r of rows) {
  const newMarka = UP(r.marka), newModel = UP(r.model), newBieznik = UP(r.bieznik);
  let newNazwa = r.nazwa;
  // odbuduj nazwe: podmien model/bieznik/marka (dluzsze pierwsze, by uniknac czesciowych kolizji)
  // uzywamy zarowno starych jak i NOWYCH (wielkich) wartosci, by zlapac przypadki gdy kolumna juz wielka a nazwa mieszana
  const parts = [newModel, newBieznik, newMarka, r.model, r.bieznik, r.marka].filter(Boolean);
  const uniq = [...new Set(parts)].sort((a,b)=>b.length-a.length);
  for (const p of uniq) newNazwa = replaceInName(newNazwa, p);
  // krok 3: pojedyncze slowa modelu/marki/bieznika (>=2 znaki, zawieraja litery) -> UPPER w nazwie,
  // by zlapac rozbieznosci sufiksow (np. model 'NORDMAN FOREST TRS L-2' vs nazwa 'Nordman Forest TRS SF')
  const words = new Set();
  for (const src of [r.model, r.bieznik, r.marka]) {
    if (!src) continue;
    for (const w of String(src).split(/\s+/)) {
      if (w.length >= 2 && /[a-ząćęłńóśźż]/i.test(w) && !/\d/.test(w)) words.add(w);
    }
  }
  for (const w of [...words].sort((a,b)=>b.length-a.length)) newNazwa = replaceInName(newNazwa, w);
  const mChg = newMarka!==r.marka, moChg=newModel!==r.model, bChg=newBieznik!==r.bieznik, nChg=newNazwa!==r.nazwa;
  if (!(mChg||moChg||bChg||nChg)) continue;
  if (mChg) chMarka++; if (moChg) chModel++; if (bChg) chBieznik++; if (nChg) chNazwa++;
  // wykryj: nazwa ma male litery ale nie zmienilismy (moze marka/model nie wystepuje doslownie)
  if (!nChg && r.nazwa && /[a-ząćęłńóśźż]/.test(r.nazwa) && (moChg||bChg||mChg)) nameNoMatch.push(r.kod+': '+r.nazwa);
  plan.push({ id:r.id, kod:r.kod, dostawca:r.dostawca, old:{n:r.nazwa,ma:r.marka,mo:r.model,b:r.bieznik}, neu:{n:newNazwa,ma:newMarka,mo:newModel,b:newBieznik} });
}

console.log('=== PODSUMOWANIE ZMIAN ===');
console.log('pozycji do zmiany:', plan.length, '| marka:', chMarka, '| model:', chModel, '| bieznik:', chBieznik, '| nazwa:', chNazwa);
console.log('\n=== PROBKA 20 (nazwa stara -> nowa) ===');
for (const p of plan.slice(0,20)) if (p.old.n!==p.neu.n) console.log('  ['+p.old.n+']\n   ->['+p.neu.n+']');
console.log('\n=== nazwa z malymi literami, ale nie zmieniona ('+nameNoMatch.length+') ===');
nameNoMatch.slice(0,15).forEach(x=>console.log('  '+x));

if (!APPLY) { console.log('\nDRY-RUN. Uruchom z --apply aby zapisac.'); db.close(); return; }

const now = new Date().toISOString();
const upd = db.prepare("UPDATE products SET nazwa=@n, marka=@ma, model=@mo, bieznik=@b WHERE id=@id");
const hist = db.prepare("INSERT INTO history (data,kod_produktu,nazwa,pole,stara_wartosc,nowa_wartosc,zrodlo,kto) VALUES (?,?,?,?,?,?,?,?)");
const tx = db.transaction(() => {
  let n=0;
  for (const p of plan) {
    upd.run({ id:p.id, n:p.neu.n, ma:p.neu.ma, mo:p.neu.mo, b:p.neu.b });
    if (p.old.ma!==p.neu.ma) hist.run(now,p.kod,p.neu.n,'marka',p.old.ma,p.neu.ma,'fix_uppercase','Anna');
    if (p.old.mo!==p.neu.mo) hist.run(now,p.kod,p.neu.n,'model',p.old.mo,p.neu.mo,'fix_uppercase','Anna');
    if (p.old.b!==p.neu.b) hist.run(now,p.kod,p.neu.n,'bieznik',p.old.b,p.neu.b,'fix_uppercase','Anna');
    if (p.old.n!==p.neu.n) hist.run(now,p.kod,p.neu.n,'nazwa',p.old.n,p.neu.n,'fix_uppercase','Anna');
    n++;
  }
  return n;
});
const n = tx();
db.pragma('wal_checkpoint(TRUNCATE)');
console.log('\nAPPLY OK: zaktualizowano', n, 'pozycji');
// weryfikacja
const leftM = db.prepare("SELECT COUNT(*) c FROM products WHERE marka GLOB '*[a-ząćęłńóśźż]*'").get().c;
const leftMo = db.prepare("SELECT COUNT(*) c FROM products WHERE model GLOB '*[a-ząćęłńóśźż]*'").get().c;
const leftB = db.prepare("SELECT COUNT(*) c FROM products WHERE bieznik GLOB '*[a-ząćęłńóśźż]*'").get().c;
console.log('pozostale male litery: marka=',leftM,'model=',leftMo,'bieznik=',leftB);
db.close();
