const D=require('better-sqlite3');
const db=new D('/home/admin/private_apps/bridge/data.db',{readonly:true});
// probka roznych notacji
const rows = db.prepare("SELECT kod,rozmiar,szerokosc,profil,srednica,szerokosc_paczki,wysokosc,dlugosc,wysokosc_przesylki FROM products WHERE rozmiar IS NOT NULL AND rozmiar<>'' AND szerokosc IS NOT NULL ORDER BY RANDOM() LIMIT 25").all();
console.log('rozmiar | szerokosc | profil | srednica | szer_paczki | wysokosc | dlugosc | wys_przesylki');
for(const r of rows){
  console.log(`${r.rozmiar}  =>  szer=${r.szerokosc} prof=${r.profil} sr=${r.srednica} | paczka_szer=${r.szerokosc_paczki} wys=${r.wysokosc} dl=${r.dlugosc} wys_przes=${r.wysokosc_przesylki}`);
}
// rozklad: czy szerokosc = pierwsza liczba rozmiaru
console.log('\n=== czy szerokosc == pierwsza liczba w rozmiarze? ===');
const all = db.prepare("SELECT rozmiar,szerokosc FROM products WHERE rozmiar IS NOT NULL AND rozmiar<>'' AND szerokosc IS NOT NULL").all();
let match=0,mism=0,ex=[];
for(const r of all){
  const m = String(r.rozmiar).replace(',','.').match(/(\d+(?:\.\d+)?)/);
  if(m){
    const first = parseFloat(m[1]);
    if(Math.abs(first - r.szerokosc) < 0.01) match++;
    else { mism++; if(ex.length<15) ex.push({rozmiar:r.rozmiar, szerokosc:r.szerokosc, pierwsza:first}); }
  }
}
console.log('zgodnych:', match, '| niezgodnych:', mism);
console.log('przyklady niezgodne:', JSON.stringify(ex,null,1));
