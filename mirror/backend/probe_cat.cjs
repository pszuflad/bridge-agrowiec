const fs = require('fs');
process.chdir('/home/admin/private_apps/bridge');
const DISPATCHER = require('./parsers/dispatcher.cjs');
const ADAPTER = require('./parsers/adapter.cjs');

async function go() {
  const out = {};
  for (const kod of ['MO2','MO9']) {
    const url = DISPATCHER.URLS[kod];
    const res = await fetch(url);
    const buf = Buffer.from(await res.arrayBuffer());
    const tmp = `/tmp/csv_cache/${kod}.csv`;
    fs.writeFileSync(tmp, buf);
    const parsed = DISPATCHER.parseByKod(kod, tmp);
    const records = parsed.records || parsed;
    const surowe = ADAPTER.recordsToSurowe(kod, records);

    // Wyłapuję EM/MPT/IND
    const em = surowe.filter(r => r.bieznik && /^(EM|MPT|IND)/i.test(r.bieznik));
    out[kod] = em.slice(0, 10).map(r => ({kod:r.kod, bieznik:r.bieznik, kat:r.kategoria}));
    out[kod+'_total_industrial'] = surowe.filter(r => r.kategoria === 'Przemysłowe').length;
  }
  console.log(JSON.stringify(out, null, 2));
}
go().catch(e => { console.error(e); process.exit(1); });
