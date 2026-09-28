'use strict';
// Metadata stays on arrays through dispatcher -> adapter -> tk. Callers cannot
// accidentally count a partial JSON/manual import as a complete supplier list.
const rawCode=(supplier,r)=>{
  const raw=r?.surowe_pola||r?.row||{};
  if(supplier==='MO9')return raw.id??r?.id;
  return r?.kod_dostawcy??raw.indexCatalogue??raw['Indeks producenta']??raw['Kod producenta']??null;
};
const prefix=(s,c)=>c==null||c===''?null:String(c).toUpperCase().startsWith(s+'_')?String(c):s+'_'+c;
function attach(supplier,result){
  if(!Array.isArray(result?.records))throw Error('Brak listy produktów w odpowiedzi dostawcy');
  const errors=result.errors?.length||0;
  if(errors)throw Error(`Błędy odczytu cennika (${errors}). Import zatrzymany bez przełączania na stary format.`);
  if(!result.records.length)throw Error('Pusty cennik. Import zatrzymany.');
  const excludedCodes=(result.odrzucone||[]).map(r=>prefix(supplier,rawCode(supplier,r))).filter(Boolean);
  Object.defineProperty(result.records,'_bridgeFeedMeta',{value:{
    complete:true,parserErrors:errors,source:supplier==='MO9'?'Agrorami GraphQL':'supplier file',
    rawCount:result.records.length,excludedCodes
  },configurable:true});
  return result;
}
function converted(supplier,records,items,rejected){
  const meta=records._bridgeFeedMeta;
  if(!meta)return items;
  const excluded=[...meta.excludedCodes,...rejected.map(r=>prefix(supplier,rawCode(supplier,r))).filter(Boolean)];
  Object.defineProperty(items,'_bridgeFeedMeta',{value:{...meta,excludedCodes:excluded},configurable:true});
  return items;
}
module.exports={attach,converted};
