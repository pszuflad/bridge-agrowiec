const D=require('better-sqlite3');
const db=new D('data.db');
const now=new Date().toISOString().replace('T',' ').slice(0,19);
const nowISO=new Date().toISOString();

const OLD='https://agroopony.eu/zdjecia/med2/';
const NEW='https://agritires.eu/zdjecia-produktow/opony/';

const rows=db.prepare("SELECT kod,nazwa,marka,model,rozmiar,link_zdjecia FROM products WHERE link_zdjecia LIKE '%agroopony.eu/zdjecia/med2/%'").all();
console.log('do podmiany:',rows.length);

const upd=db.prepare("UPDATE products SET link_zdjecia=? WHERE kod=?");
const h=db.prepare("INSERT INTO history (data,kod_produktu,nazwa,pole,stara_wartosc,nowa_wartosc,zrodlo,kto) VALUES (?,?,?,?,?,?,?,?)");
const pk=db.prepare("INSERT INTO link_pamiec_kod (kod,link,updated_at) VALUES (?,?,?) ON CONFLICT(kod) DO UPDATE SET link=excluded.link, updated_at=excluded.updated_at");
const pm=db.prepare("INSERT INTO link_pamiec_mr (mrkey,link,updated_at) VALUES (?,?,?) ON CONFLICT(mrkey) DO UPDATE SET link=excluded.link, updated_at=excluded.updated_at");

let nUpd=0,nMr=0;
const tx=db.transaction(()=>{
  for(const r of rows){
    const oldL=r.link_zdjecia;
    const newL=oldL.replace(OLD,NEW);
    if(newL===oldL){ console.log('POMINIETO (brak dopasowania prefiksu):',r.kod); continue; }
    upd.run(newL,r.kod);
    h.run(now,r.kod,r.nazwa||'','link_zdjecia',oldL,newL,'migracja-agroopony-agritires-2026-07-22','Anna');
    pk.run(r.kod,newL,nowISO);
    nUpd++;
    if(r.marka&&r.model&&r.rozmiar){
      const mrkey=`${r.marka}|${r.model}|${r.rozmiar}`;
      pm.run(mrkey,newL,nowISO); nMr++;
    }
  }
});
tx();
console.log('UPDATE link_zdjecia:',nUpd,'| link_pamiec_mr upsert:',nMr);

// weryfikacja
const left=db.prepare("SELECT COUNT(*) n FROM products WHERE link_zdjecia LIKE '%agroopony.eu%'").get().n;
const nw=db.prepare("SELECT COUNT(*) n FROM products WHERE link_zdjecia LIKE '%agritires.eu%'").get().n;
console.log('POZOSTALO agroopony:',left,'| agritires razem:',nw);
db.close();
