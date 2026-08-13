require('dotenv').config();
const client = require('./selly/client.cjs');
(async () => {
  try {
    const cats = await client.listCategories({ limit: 50 });
    console.log('CATEGORIES_COUNT:', (cats.data || []).length);
    console.log(JSON.stringify(cats.data, null, 2));
  } catch (e) {
    console.error('ERROR:', e.message);
  }
})();
