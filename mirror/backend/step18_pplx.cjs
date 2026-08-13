require('dotenv').config();
const client = require('./selly/client.cjs');
(async () => {
  try {
    let all = [];
    for (let page = 1; page <= 20; page++) {
      const r = await client.listCategories({ limit: 50, page });
      const items = r.data || [];
      if (!items.length) break;
      all = all.concat(items);
      if (items.length < 50) break;
    }
    console.log('TOTAL:', all.length);
    require('fs').writeFileSync('all_categories_dump.json', JSON.stringify(all, null, 2));
    // Podsumowanie: drzewo poziom 0 i 1
    const byId = {}; all.forEach(c => byId[c.category_id] = c);
    const roots = all.filter(c => c.parent_id === 0);
    console.log('ROOTS:', roots.map(r => `${r.category_id}:${r.name}`).join(', '));
    for (const root of roots) {
      const children = all.filter(c => c.parent_id === root.category_id);
      console.log(`\n${root.name} (${root.category_id}) -> ${children.length} dzieci:`, children.map(c=>`${c.category_id}:${c.name}`).join(', '));
    }
  } catch (e) {
    console.error('ERROR:', e.message);
  }
})();
