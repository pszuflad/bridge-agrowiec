require('dotenv').config({ path: '/home/admin/private_apps/bridge/.env' });
const mo9 = require('/home/admin/private_apps/bridge/parsers/mo9_agrorami_api.cjs');

async function main() {
  const token = await mo9._getToken();
  console.log('Token OK, len:', token.length);

  // Pull małej próbki (pierwsze 20) bezposrednio przez _gqlFetch-like call
  const https = null;
  const fetch = global.fetch;
  const GRAPHQL_URL = process.env.AGRORAMI_GRAPHQL_URL || 'https://hurtownia.agrorami.pl/graphql?store=pl';
  const query = `query($catId:String!,$after:String!,$pageSize:Int!){
    products(filter:{ category_id:{eq:$catId}, entity_id:{gt:$after} } sort:{ entity_id:ASC } pageSize:$pageSize currentPage:1){
      total_count
      items{ id sku name stock_status stock_availability{ in_stock in_stock_real } }
    }
  }`;
  const resp = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ query, variables: { catId: '148', after: '0', pageSize: 20 } })
  });
  const json = await resp.json();
  console.log(JSON.stringify(json, null, 2).slice(0, 4000));
}
main().catch(e => console.error('ERROR:', e.message));
