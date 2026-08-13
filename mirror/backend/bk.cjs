const D=require('better-sqlite3'); const db=new D('data.db');
const ts=new Date().toISOString().replace(/[-:T]/g,'').slice(0,14);
const name=`data.db.bak_pre_overrides_lock_${ts}`;
db.exec(`VACUUM INTO '${name}'`); db.close();
console.log('BACKUP:', name);