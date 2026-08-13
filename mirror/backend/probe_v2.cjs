const fs = require('fs');
const path = require('path');
process.chdir('/home/admin/private_apps/bridge');
const DISPATCHER = require('./parsers/dispatcher.cjs');
const ADAPTER = require('./parsers/adapter.cjs');

async function go() {
  const tests = [];
  fs.mkdirSync('/tmp/csv_cache', {recursive: true});

  for (const kod of ['MO1','MO2','MO3','MO4','MO5','MO6','MO7','MO8','MO9','MO10']) {
    try {
      const url = DISPATCHER.URLS && DISPATCHER.URLS[kod];
      if (!url) { tests.push({kod, err:'NO URL'}); continue; }
      const res = await fetch(url);
      const buf = Buffer.from(await res.arrayBuffer());
      const tmpFile = `/tmp/csv_cache/${kod}.csv`;
      fs.writeFileSync(tmpFile, buf);
      const parsed = DISPATCHER.parseByKod(kod, tmpFile);
      const records = parsed.records || parsed;
      const surowe = ADAPTER.recordsToSurowe(kod, records);

      // metryki
      const total = surowe.length;
      const withPrefix = surowe.filter(r => r.kod && r.kod.startsWith(kod)).length;
      const withParenSlash = surowe.filter(r => /\([^()]*\/[^()]*\)/.test(r.nazwa || '')).length;
      const withDupA8 = surowe.filter(r => /(\d+)([A-Z]\d)\/([A-Z])\2/i.test(r.nazwa || '')).length;
      const indCat = surowe.filter(r => r.kategoria === 'Przemysłowe').length;
      const sample = surowe.slice(0, 2).map(r => ({kod: r.kod, nazwa: r.nazwa, kat: r.kategoria}));

      // konkretne case'y które user wskazał
      const wl0392 = surowe.find(r => /WL0392/i.test(r.kod || ''));
      const cetroc = surowe.filter(r => r.nazwa && /Cetroc/i.test(r.nazwa)).slice(0,2);
      const goldencrown = surowe.filter(r => r.nazwa && /Goldencrown/i.test(r.nazwa)).slice(0,2);

      tests.push({kod, total, withPrefix, withParenSlash, withDupA8, indCat, sample, wl0392: wl0392 ? {kod: wl0392.kod, nazwa: wl0392.nazwa, kat: wl0392.kategoria} : null, cetroc, goldencrown});
    } catch (e) {
      tests.push({kod, err: e.message.slice(0,200)});
    }
  }
  console.log(JSON.stringify(tests, null, 2));
}
go().catch(e => { console.error('FATAL', e); process.exit(1); });
