const Database=require('better-sqlite3');
const db=new Database('data.db');
const ts=new Date().toISOString().replace(/[-:T]/g,'').slice(0,14);
const name=`data.db.bak_pre_uspojnienie_${ts}`;
db.exec(`VACUUM INTO '${name}'`);
console.log('BACKUP:', name);
db.close();
