const fs=require('fs');
const P='/home/admin/private_apps/bridge/index.cjs';
let src=fs.readFileSync(P,'utf8');
const OLD=`function seedAttrValuesFromProducts(){const t=new Date().toISOString();for(const[e,n]of ATTR_PRODUCT_FIELD_MAP){Qi.prepare("INSERT OR IGNORE INTO atrybuty_wartosci(rodzaj,wartosc,origin,utworzono) SELECT ?, TRIM("+n+"), 'katalog', ? FROM products WHERE "+n+" IS NOT NULL AND TRIM("+n+")<>''").run(e,t)}}`;
const NEW=fs.readFileSync('/home/admin/private_apps/bridge/new_seed_func.js','utf8').trim();
const count=src.split(OLD).length-1;
if(count!==1){console.error('BLAD: znaleziono wystapien starej funkcji =',count,'- przerywam, brak podmiany');process.exit(2);}
src=src.replace(OLD,NEW);
fs.writeFileSync(P,src);
console.log('Podmieniono funkcje seedAttrValuesFromProducts (1 wystapienie).');
// sanity: nowa funkcja obecna, stary literal 'katalog' w tym miejscu zniknal
console.log("Nowy origin 'catalog' w funkcji:", src.includes("VALUES(?,?,'catalog',?)"));
console.log("Stary SELECT ... 'katalog' pozostal:", src.includes("SELECT ?, TRIM(\"+n+\"), 'katalog'"));
