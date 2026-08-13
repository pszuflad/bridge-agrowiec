async function main() {
  const GRAPHQL_URL = 'https://hurtownia.agrorami.pl/graphql?store=pl';
  const query = `query($catId:String!,$after:String!,$pageSize:Int!){
    products(filter:{ category_id:{eq:$catId}, entity_id:{gt:$after} } sort:{ entity_id:ASC } pageSize:$pageSize currentPage:1){
      total_count
      items{ id sku name stock_status stock_availability{ in_stock in_stock_real } }
    }
  }`;
  const resp = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }, // BRAK Authorization header
    body: JSON.stringify({ query, variables: { catId: '148', after: '0', pageSize: 10 } })
  });
  const json = await resp.json();
  console.log('HTTP status:', resp.status);
  console.log(JSON.stringify(json, null, 2).slice(0, 3000));
}
main().catch(e => console.error('ERROR:', e.message));
