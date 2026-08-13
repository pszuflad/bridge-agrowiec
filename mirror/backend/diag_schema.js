const Database = require('better-sqlite3');
const db = new Database('./bridge.db', {readonly:true});
const tabs = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('TABLES:', tabs.map(t=>t.name).join(', '));
