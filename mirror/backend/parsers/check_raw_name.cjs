const mo9 = require('/home/admin/private_apps/bridge/parsers/mo9_agrorami_api.cjs');
(async () => {
  const items = await mo9.fetchAllItems();
  const target = items.find(it => String(it.sku) === '689826' || String(it.id) === '689826');
  if (!target) {
    console.log('NIE ZNALEZIONO sku=689826, szukam po EAN...');
    const target2 = items.find(it => JSON.stringify(it).includes('8903094074846'));
    console.log(target2 ? JSON.stringify(target2, null, 2) : 'brak wyniku');
  } else {
    console.log(JSON.stringify(target, null, 2));
  }
})().catch(e => console.error('ERROR:', e.message));
