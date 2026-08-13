require('dotenv').config();
const mo9 = require('/home/admin/private_apps/bridge/parsers/mo9_agrorami_api.cjs');
(async () => {
  const result = await mo9.fetchAllItems();
  const found = result.items.filter(it => /FLOT 648/i.test(it.name));
  found.forEach(it => console.log(it.sku, '|', it.name));
})().catch(e => console.error(e.message));
