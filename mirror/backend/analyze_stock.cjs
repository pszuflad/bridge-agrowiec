require('dotenv').config({ path: '/home/admin/private_apps/bridge/.env' });
const mo9 = require('/home/admin/private_apps/bridge/parsers/mo9_agrorami_api.cjs');

async function main() {
  const { items, totalCount } = await mo9.fetchAllItems();
  console.log('Total items fetched:', items.length, '/ total_count:', totalCount);

  let nullReal = 0, nonNullReal = 0, plusSuffix = 0, exactNum = 0;
  let statusInStockButRealNull = 0, statusOutButRealNotNull = 0;
  let statusCounts = {};

  for (const it of items) {
    const sa = it.stock_availability || {};
    const real = sa.in_stock_real;
    const status = it.stock_status;
    statusCounts[status] = (statusCounts[status]||0)+1;

    if (real === null || real === undefined) nullReal++;
    else {
      nonNullReal++;
      if (String(real).includes('+')) plusSuffix++; else exactNum++;
    }

    if (status === 'IN_STOCK' && (real === null || real === undefined)) statusInStockButRealNull++;
    if (status === 'OUT_OF_STOCK' && real !== null && real !== undefined) statusOutButRealNotNull++;
  }

  console.log('null in_stock_real:', nullReal);
  console.log('non-null in_stock_real:', nonNullReal, '(z "+" suffix:', plusSuffix, ', liczba dokladna:', exactNum, ')');
  console.log('stock_status distribution:', JSON.stringify(statusCounts));
  console.log('IN_STOCK ale in_stock_real=null (podejrzane):', statusInStockButRealNull);
  console.log('OUT_OF_STOCK ale in_stock_real!=null (podejrzane):', statusOutButRealNotNull);

  // Sample kilku IN_STOCK z null real, jesli sa
  const suspicious = items.filter(it => it.stock_status === 'IN_STOCK' && (it.stock_availability?.in_stock_real === null || it.stock_availability?.in_stock_real === undefined));
  console.log('\\nPrzykladu IN_STOCK z real=null (do 5):');
  suspicious.slice(0,5).forEach(it => console.log(' -', it.id, it.sku, it.name, JSON.stringify(it.stock_availability)));
}
main().catch(e => console.error('ERROR:', e.message, e.stack));
