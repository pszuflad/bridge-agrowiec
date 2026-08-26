// Dispatcher parserów Bridge v6
// Wybiera odpowiedni parser na podstawie kodu dostawcy (MO1..MO10)
// Każdy parser akceptuje ścieżkę do pliku CSV i zwraca {records, errors, dostawca, odrzucone?}

const mo1 = require('./mo1_bohnenkamp.cjs');
const mo2 = require('./mo2_jmk.cjs');
const mo3 = require('./mo3_grasdorf.cjs');
const mo4_5 = require('./mo4_mo5_handlopex.cjs');
const mo6 = require('./mo6_agrowiec.cjs');
const mo7 = require('./mo7_nokian.cjs');
const mo8 = require('./mo8_trelleborg.cjs');
const mo9 = require('./mo9_agrorami.cjs');
const mo10 = require('./mo10_gri.cjs');

// Mapowanie URL źródłowych — używane przez auto-pull
const URLS = {
  MO1:  'https://agroopony.eu/imports/bohnenkamp.csv',
  MO2:  'http://46.238.100.138:5844/Cennik_26002_v2_4f8a1740-11c5-4ee8-8e1d-e3145b10d335.csv',
  MO3:  'https://sklep.kolarolnicze.pl/offer/export/test-csv-3,t1004,pl.csv', // Anna 01.07: eksport z jej sklepu IdoSell (Format B z indexCatalogue)
  MO4:  'https://agroopony.eu/imports/acc_ftp3/agrowiec_wr.csv',
  MO5:  'https://agroopony.eu/imports/acc_ftp3/agrowiec_mw.csv',
  MO6:  'https://agroopony.eu/imports/Cennik_Agrowiec.csv',
  MO7:  'https://agroopony.eu/imports/CennikNokianCSV.csv',
  MO8:  'https://agroopony.eu/imports/Trelleborg.csv',
  MO9:  'https://agroopony.eu/imports/agrorami.csv',
  MO10: 'https://agroopony.eu/imports/gri.csv'
};

function parseByKod(dostawcaKod, filePath) {
  switch ((dostawcaKod || '').toUpperCase()) {
    case 'MO1':  return mo1.parseFile(filePath);
    case 'MO2':  return mo2.parseFile(filePath);
    case 'MO3':  return mo3.parseFile(filePath);
    case 'MO4':  return mo4_5.parseMO4(filePath);
    case 'MO5':  return mo4_5.parseMO5(filePath);
    case 'MO6':  return mo6.parseFile(filePath);
    case 'MO7':  return mo7.parseFile(filePath);
    case 'MO8':  return mo8.parseFile(filePath);
    case 'MO9':  return mo9.parseFile(filePath);
    case 'MO10': return mo10.parseFile(filePath);
    default:
      throw new Error(`Nieznany dostawca: ${dostawcaKod}`);
  }
}

// getUrl: preferuje URL z tabeli suppliers (jeśli podano db handle), fallback do URLS w kodzie.
// db.getSupplierUrl(kod) powinien zwrócić string lub null.
function getUrl(dostawcaKod, db) {
  const kod = (dostawcaKod || '').toUpperCase();
  if (db && typeof db.getSupplierUrl === 'function') {
    try {
      const dbUrl = db.getSupplierUrl(kod);
      if (dbUrl && typeof dbUrl === 'string' && dbUrl.trim().length > 0) return dbUrl.trim();
    } catch (_) {}
  }
  return URLS[kod] || null;
}

function listDostawcy() {
  return Object.keys(URLS);
}

module.exports = { parseByKod, getUrl, listDostawcy, URLS };
