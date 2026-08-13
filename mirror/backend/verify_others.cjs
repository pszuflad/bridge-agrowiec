require('dotenv').config();
const mo9 = require('/home/admin/private_apps/bridge/parsers/mo9_agrorami_api.cjs');
const tyreOld = require('/home/admin/private_apps/bridge/parsers/tyre_params.cjs');
const tyreNew = require('/home/admin/private_apps/bridge/test_vfif_fix/parsers/tyre_params.cjs');

function buildArgs(rec, withNazwa) {
  const base = {
    id: rec.surowe_pola.id, kod_dostawcy: rec.kod_dostawcy, ean: rec.surowe_pola.ean,
    producent: rec.surowe_pola.producent, bieznik: rec.surowe_pola.bieznik, rozmiar: rec.surowe_pola.rozmiar,
    nosnosc: rec.surowe_pola.nosnosc, predkosc: rec.surowe_pola.predkosc, tlTt: rec.surowe_pola['tl/tt'],
    plotna: rec.surowe_pola.plotna, cena: rec.surowe_pola.cena, magazyn: rec.surowe_pola.magazyn,
    waga: rec.surowe_pola.waga, kategoria: rec.surowe_pola.kategoria, sezon: rec.surowe_pola.sezon
  };
  if (withNazwa) base.nazwa = rec.surowe_pola.name_api;
  return base;
}

(async () => {
  const result = await mo9.fetchAllItems();
  const items = result.items;
  let allDiffs = [];
  for (const it of items) {
    const rec = mo9.itemToRecord(it);
    const oldR = tyreOld.normalizeAgrorami(buildArgs(rec, false));
    const newR = tyreNew.normalizeAgrorami(buildArgs(rec, true));
    ['nro','cho','cfo','sb','sf','hs','pr','tlTt','stubbleResistant'].forEach(f => {
      if (JSON.stringify(oldR[f]) !== JSON.stringify(newR[f])) {
        allDiffs.push({sku: it.sku, name: it.name, field: f, old: oldR[f], new: newR[f]});
      }
    });
  }
  console.log('Total diffs w markerach:', allDiffs.length);
  // Sprawdz czy kazda zmiana ma uzasadnienie tekstowe w nazwie
  let unjustified = 0;
  allDiffs.forEach(d => {
    const marker = d.field.toUpperCase();
    const nameUpper = d.name.toUpperCase();
    const patterns = {
      NRO: /\bNRO\b/, CHO: /\bCHO\b/, CFO: /\bCFO\b/, SB: /\bSB\b|STEEL BELTED/,
      SF: /\bSF\b/, HS: /\bHS\b|HIGH SPEED/, PR: /\d{1,2}\s*PR\b/, TLTT: /\bTL\b|\bTT\b|\bTTF\b/,
      STUBBLERESISTANT: /STUBBLE/
    };
    const key = d.field.toUpperCase().replace('TLTT','TLTT');
    const pat = patterns[key] || patterns[d.field.toUpperCase()];
    const justified = pat ? pat.test(nameUpper) : null;
    if (justified === false) {
      unjustified++;
      console.log('NIEUZASADNIONE:', JSON.stringify(d));
    }
  });
  console.log('Nieuzasadnione zmiany:', unjustified, '/ ', allDiffs.length);
})().catch(e => console.error('ERROR:', e.message));
