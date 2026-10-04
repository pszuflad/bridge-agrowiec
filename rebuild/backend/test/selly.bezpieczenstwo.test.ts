import { describe, expect, it } from "vitest";
import { BladSelly, type ProduktSzczegolySelly } from "../src/selly/klient.js";
import { cenaBazowaJednegoWariantu, sprawdzCelSelly } from "../src/selly/rest/bezpieczenstwo.js";
import {
  stworzAtrapeSelly, stworzDiscoveryTestowe, stworzTestowaBaze, zasiejMapowanie, zasiejProdukty,
} from "./gate/index.js";
import { syncDelta } from "../src/selly/rest/sync-delta.js";

const row = {kod:"MO9_336320",kod_importu:"798368",dostawca:"MO9",ean:"8903094073627",nazwa:"BKT 650/65R38"};
const variant = {variant_id:523,product_id:523,price:20169,quantity:1,
  features:[{feature_id:1,name:"Magazyny",value:"MO9"}]};
const original: ProduktSzczegolySelly = {product_id:523,name:row.nazwa,ean:row.ean,price:752,variants:[variant]};

function setup(product: ProduktSzczegolySelly = original) {
  const atrapa=stworzAtrapeSelly({sklep:[{product_id:523,name:product.name,ean:product.ean,
    price:product.price,warianty:product.variants || []}]});
  atrapa.klient.getProduct=async()=>({data:product});
  return {...stworzDiscoveryTestowe(atrapa.klient),atrapa};
}

describe("ticket 184 — ochrona tożsamości i cen Selly",()=>{
  it("to samo EAN i właściwy wariant magazynu pozwalają na zapis",async()=>{
    const {discovery}=setup();
    expect((await sprawdzCelSelly(discovery,row,523,523)).variant.price).toBe(20169);
  });
  it("ta sama nazwa pozwala zachować oferty różnych dostawców z różnymi EAN",async()=>{
    const {discovery}=setup({...original,ean:"9990000000001"});
    expect((await sprawdzCelSelly(discovery,row,523,523)).product.product_id).toBe(523);
  });
  it("cena obcego CEAT/GLOBE nie zostanie wpisana do BKT",async()=>{
    const {discovery,atrapa}=setup({...original,name:"250/85R20 CEAT FARMAX",ean:"INNY"});
    await expect(sprawdzCelSelly(discovery,row,523,523)).rejects.toThrow("nie odpowiada");
    expect(atrapa.liczba("updateProduct")).toBe(0);
    expect(atrapa.liczba("updateVariant")).toBe(0);
  });
  it("DEMO nie łączy się z normalną oponą nawet przy tym samym EAN",async()=>{
    const {discovery}=setup({...original,name:row.nazwa+" DEMO"});
    await expect(sprawdzCelSelly(discovery,row,523,523)).rejects.toThrow("nie odpowiada");
  });
  it("inny magazyn blokuje zapis",async()=>{
    const {discovery}=setup({...original,variants:[{...variant,features:[{name:"Magazyny",value:"MO2"}]}]});
    await expect(sprawdzCelSelly(discovery,row,523,523)).rejects.toThrow("inny magazyn");
  });
  it("wariant należący do innego produktu blokuje zapis",async()=>{
    const {discovery}=setup({...original,variants:[{...variant,product_id:999}]});
    await expect(sprawdzCelSelly(discovery,row,523,523)).rejects.toThrow("nie należy");
  });
  it("timeout/429 nie oznacza zgody na zapis",async()=>{
    const {discovery}=setup();
    discovery.klient.getProduct=async()=>{throw new BladSelly("429",429,null)};
    await expect(sprawdzCelSelly(discovery,row,523,523)).rejects.toThrow("429");
  });
  it("tylko dodatnia cena jednego wariantu; nie ma arbitralnej ceny wielu magazynów",()=>{
    expect(cenaBazowaJednegoWariantu([variant])).toBe(20169);
    for(const v of [[],[variant,variant],[{...variant,price:0}],[{...variant,price:NaN}],
      [{...variant,price:null}]]) expect(cenaBazowaJednegoWariantu(v)).toBeUndefined();
  });
  it("Tor 1 nie wysyła ceny ani stanu na błędne mapowanie",async()=>{
    const baza=stworzTestowaBaze();
    try {
      zasiejProdukty(baza.db);
      zasiejMapowanie(baza.sqlite,{kodImportu:"798368",dostawca:"MO9",bridgeKod:"MO9_336320",
        productId:523,variantId:523,featureId:1,stanWyslany:0,cenaWyslana:752});
      const {discovery,atrapa}=setup({...original,name:"GLOBE 4.00-8",ean:"INNY"});
      const r=await syncDelta(baza.db,discovery,"MO9");
      expect(r.errors.some(e=>e.error.includes("nie odpowiada"))).toBe(true);
      expect(atrapa.liczba("updateVariant")).toBe(0);
      expect(atrapa.liczba("updateProduct")).toBe(0);
    }finally{baza.posprzataj();}
  });
  it("Tor 1 aktualizuje cenę wariantu i bazową",async()=>{
    const baza=stworzTestowaBaze();
    try {
      zasiejProdukty(baza.db);
      zasiejMapowanie(baza.sqlite,{kodImportu:"798368",dostawca:"MO9",bridgeKod:"MO9_336320",
        productId:523,variantId:523,featureId:1,stanWyslany:0,cenaWyslana:752});
      const {discovery,atrapa}=setup();
      await syncDelta(baza.db,discovery,"MO9");
      expect(atrapa.wywolania.find(w=>w.metoda==="updateProduct")?.argumenty).toEqual([523,{price:7252}]);
    }finally{baza.posprzataj();}
  });
  it("wiele magazynów: Tor 1 zmienia tylko wariant swojej oferty, nie cenę bazową",async()=>{
    const baza=stworzTestowaBaze();
    try {
      zasiejProdukty(baza.db);
      zasiejMapowanie(baza.sqlite,{kodImportu:"798368",dostawca:"MO9",bridgeKod:"MO9_336320",
        productId:523,variantId:523,featureId:1,stanWyslany:0,cenaWyslana:752});
      const {discovery,atrapa}=setup({...original,variants:[variant,{...variant,variant_id:999,
        price:4000,features:[{name:"Magazyny",value:"MO3"}]}]});
      await syncDelta(baza.db,discovery,"MO9");
      expect(atrapa.liczba("updateVariant")).toBe(1);
      expect(atrapa.liczba("updateProduct")).toBe(0);
    }finally{baza.posprzataj();}
  });
  it("błąd PUT ceny bazowej nie potwierdza snapshotu jako zsynchronizowanego",async()=>{
    const baza=stworzTestowaBaze();
    try {
      zasiejProdukty(baza.db);
      zasiejMapowanie(baza.sqlite,{kodImportu:"798368",dostawca:"MO9",bridgeKod:"MO9_336320",
        productId:523,variantId:523,featureId:1,stanWyslany:0,cenaWyslana:752});
      const {discovery}=setup();
      discovery.klient.updateProduct=async()=>{throw new BladSelly("PUT price failed",500,null)};
      const r=await syncDelta(baza.db,discovery,"MO9");
      expect(r.errors.some(e=>e.error==="PUT price failed")).toBe(true);
      expect(baza.sqlite.prepare("SELECT cena_sprzedazy_wyslana FROM selly_products WHERE kod_importu='798368'")
        .get()).toEqual({cena_sprzedazy_wyslana:752});
    }finally{baza.posprzataj();}
  });
});
