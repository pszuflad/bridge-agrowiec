// patch_hook.cjs - wpina auto-odtwarzanie zastosowania po akceptacji stagingu
'use strict';
const fs = require('fs');
const F = '/home/admin/private_apps/bridge/index.cjs';
let src = fs.readFileSync(F, 'utf8');

// 1) Punkt wpiecia: po petli acceptStaging, przed odpowiedzia json w /api/staging/accept
const anchor = 'for(let p of l)U.acceptStaging(p,c.user.id);';
if (!src.includes(anchor)) { console.error('BRAK kotwicy acceptStaging'); process.exit(1); }
if (src.includes('__restoreZastosowanie')) { console.error('PATCH JUZ ZASTOSOWANY'); process.exit(2); }

// 2) Funkcja odtwarzajaca (inline, uzywa Qi + fs). Definiujemy raz, globalnie, tuz po deklaracji Qi.
const qiDecl = 'var Qi=new yw.default("data.db");Qi.pragma("journal_mode = WAL");';
if (!src.includes(qiDecl)) { console.error('BRAK deklaracji Qi'); process.exit(3); }

const fnDef = qiDecl + `
function __restoreZastosowanie(){try{var __fs=require("fs"),__path=require("path");
var __csv=__path.join("/home/admin/private_apps/bridge/zastosowania","zastosowania_master.csv");
if(!__fs.existsSync(__csv))return{ok:false,reason:"brak_csv"};
var __lines=__fs.readFileSync(__csv,"utf8").split(/\\r?\\n/).filter(function(x){return x.length});
function __uq(v){v=v.trim();if(v.length>=2&&v[0]==='"'&&v[v.length-1]==='"'){v=v.slice(1,-1).replace(/""/g,'"')}return v.trim()}
var __upd=Qi.prepare("UPDATE products SET zastosowanie=? WHERE kod=? AND (zastosowanie IS NULL OR TRIM(zastosowanie)='')");
var __n=0;var __tx=Qi.transaction(function(rows){for(var i=0;i<rows.length;i++){var info=__upd.run(rows[i].z,rows[i].k);__n+=info.changes}});
var __rows=[];for(var i=1;i<__lines.length;i++){var ln=__lines[i];var idx=ln.indexOf(",");if(idx<0)continue;var k=__uq(ln.slice(0,idx));var z=__uq(ln.slice(idx+1));if(k)__rows.push({k:k,z:z})}
__tx(__rows);return{ok:true,updated:__n}}catch(e){return{ok:false,error:String(e&&e.message||e)}}}
`;
src = src.replace(qiDecl, fnDef);

// 3) Wywolanie po akceptacji
const injected = anchor + 'try{var __rz=__restoreZastosowanie();console.log("[zastosowanie] auto-odtworzenie po akceptacji:",JSON.stringify(__rz))}catch(__e){console.error("[zastosowanie] blad:",__e)}';
src = src.replace(anchor, injected);

fs.writeFileSync(F, src, 'utf8');
console.log('PATCH OK: wpieto __restoreZastosowanie + wywolanie po acceptStaging');
