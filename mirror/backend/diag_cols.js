const Database = require('better-sqlite3');
const db = new Database('./data.db', {readonly:true});
console.log('PRODUCTS:', db.prepare("PRAGMA table_info(products)").all().map(c=>c.name).join(', '));
console.log('---');
console.log('STAGING:', db.prepare("PRAGMA table_info(staging_items)").all().map(c=>c.name).join(', '));
