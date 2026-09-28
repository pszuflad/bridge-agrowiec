// Porównanie: parsery produkcji (origin/main) vs nasz port (src/import/legacy), te same pliki.
const path = require("path");
const PROD = process.argv[2];
const PORT = process.argv[3];
const PLIKI = JSON.parse(process.argv[4]);

function potok(katalog) {
  const d = require(path.join(katalog, "parsers/dispatcher.cjs"));
  const a = require(path.join(katalog, "parsers/adapter.cjs"));
  return (kod, plik) => {
    const w = d.parseByKod(kod, plik);
    const r = a.recordsToSurowe(kod, w.records);
    return { rekordy: r, bledy: (w.errors || []).length, odrz: (w.odrzucone || []).length, odrzAdapter: w.records.length - r.length };
  };
}
const prod = potok(PROD), port = potok(PORT);
const wyniki = [];
for (const [kod, plik] of PLIKI) {
  const wy = { kod, plik: path.basename(plik) };
  let P, Q;
  try { P = prod(kod, plik); } catch (e) { wy.bladProd = String(e.message).slice(0, 160); }
  try { Q = port(kod, plik); } catch (e) { wy.bladPort = String(e.message).slice(0, 160); }
  if (P && Q) {
    wy.prod = { n: P.rekordy.length, bledy: P.bledy, odrz: P.odrz, odrzAdapter: P.odrzAdapter };
    wy.port = { n: Q.rekordy.length, bledy: Q.bledy, odrz: Q.odrz, odrzAdapter: Q.odrzAdapter };
    const mp = new Map(P.rekordy.map(r => [r.kod, r]));
    const mq = new Map(Q.rekordy.map(r => [r.kod, r]));
    wy.tylkoProd = [...mp.keys()].filter(k => !mq.has(k)).length;
    wy.tylkoPort = [...mq.keys()].filter(k => !mp.has(k)).length;
    const pola = {};
    let rekordowZRoznica = 0;
    for (const [k, rp] of mp) {
      const rq = mq.get(k); if (!rq) continue;
      let roz = false;
      for (const pole of new Set([...Object.keys(rp), ...Object.keys(rq)])) {
        if (JSON.stringify(rp[pole]) !== JSON.stringify(rq[pole])) {
          roz = true;
          (pola[pole] ||= { n: 0, przyklad: null }).n++;
          if (!pola[pole].przyklad) pola[pole].przyklad = { kod: k, prod: rp[pole], port: rq[pole] };
        }
      }
      if (roz) rekordowZRoznica++;
    }
    wy.rekordowZRoznica = rekordowZRoznica;
    wy.pola = pola;
  }
  wyniki.push(wy);
}
console.log(JSON.stringify(wyniki, null, 1));
