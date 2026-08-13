require('dotenv').config({ path: '/home/admin/private_apps/bridge/.env' });
const c = require('/home/admin/private_apps/bridge/common.cjs');
const mo9 = require('/home/admin/private_apps/bridge/parsers/mo9_agrorami_api.cjs');

async function main() {
  console.log('normalizeQty("5+") =', c.normalizeQty('5+'));
  console.log('normalizeQty("15+") =', c.normalizeQty('15+'));
  console.log('normalizeQty("2") =', c.normalizeQty('2'));
  console.log('normalizeQty(null) =', c.normalizeQty(null));
  console.log('normalizeQty("") =', c.normalizeQty(''));

  const { items } = await mo9.fetchAllItems();
  const dist = {};
  for (const it of items) {
    const real = it.stock_availability && it.stock_availability.in_stock_real;
    const key = real === null || real === undefined ? 'NULL' : String(real);
    dist[key] = (dist[key]||0)+1;
  }
  const sorted = Object.entries(dist).sort((a,b) => b[1]-a[1]);
  console.log('\\nRozklad wartosci in_stock_real (surowe z API):');
  sorted.forEach(([k,v]) => console.log(' ', k, ':', v));
}
main().catch(e => console.error('ERROR:', e.message));
