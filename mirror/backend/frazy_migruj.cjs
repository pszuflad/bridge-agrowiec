require('dotenv').config();
const fs = require('fs');
const c = require('./selly/client.cjs');

const norm = n => String(n).trim().toUpperCase().replace(/\s+/g, ' ');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const frazy = JSON.parse(fs.readFileSync('/tmp/frazy_migracja.json', 'utf8'));
  const byName = new Map(frazy.map(f => [norm(f.name), f.phrases]));
  console.log('Fraz w pliku:', byName.size);

  // 1. Pelny katalog + snapshot (rollback)
  const catalog = [];
  let page = 1, pageCount = 1;
  while (page <= pageCount) {
    const l = await c.listProducts({ page, limit: 50 });
    pageCount = l.__metadata.page_count;
    catalog.push(...l.data);
    page++;
    await sleep(250);
  }
  fs.writeFileSync('/tmp/selly_snapshot_pna.json', JSON.stringify(catalog.map(x => ({ product_id: x.product_id, name: x.name, product_name_additional: x.product_name_additional }))));
  console.log('Katalog Selly:', catalog.length);

  // 2. Dopasowanie po znormalizowanej nazwie
  const todo = [];
  const matchedNames = new Set();
  for (const p of catalog) {
    const ph = byName.get(norm(p.name));
    if (ph) { todo.push({ product_id: p.product_id, name: p.name, phrases: ph }); matchedNames.add(norm(p.name)); }
  }
  const unmatched = frazy.filter(f => !matchedNames.has(norm(f.name)));
  console.log('Do aktualizacji:', todo.length, '| niedopasowane nazwy z pliku:', unmatched.length);
  fs.writeFileSync('/tmp/frazy_niedopasowane.json', JSON.stringify(unmatched, null, 1));

  // 3. PUT z throttlingiem ~4/s (240/min < limit 300)
  let ok = 0, err = 0;
  const errors = [];
  for (let i = 0; i < todo.length; i++) {
    const t = todo[i];
    let attempt = 0;
    for (;;) {
      try {
        await c.updateProduct(t.product_id, { product_name_additional: t.phrases });
        ok++;
        break;
      } catch (e) {
        attempt++;
        const msg = String(e && e.message || e);
        if (attempt <= 2 && /429|5\d\d|ECONN|ETIMEDOUT|timeout/i.test(msg)) {
          await sleep(5000);
          continue;
        }
        err++; errors.push({ product_id: t.product_id, name: t.name, error: msg.slice(0, 200) });
        break;
      }
    }
    if (i % 200 === 0) console.log(`postep ${i}/${todo.length} ok=${ok} err=${err}`);
    await sleep(250);
  }
  fs.writeFileSync('/tmp/frazy_raport.json', JSON.stringify({ total: todo.length, ok, err, errors: errors.slice(0, 200), unmatched_count: unmatched.length }, null, 1));
  console.log('KONIEC ok=' + ok + ' err=' + err);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
