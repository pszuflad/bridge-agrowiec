'use strict';

const Database = require('better-sqlite3');

const DB_PATH = '/home/admin/private_apps/bridge/data.db';

const BLOCKED_PAYMENT_FORMS = Object.freeze({
  MO1: '203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219',
  MO2: '201, 202, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219',
  MO3: '201, 202, 203, 204, 205, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219',
  MO4: '201, 202, 203, 204, 205, 206, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219',
  MO5: '201, 202, 203, 204, 205, 206, 207, 208, 211, 212, 213, 214, 215, 216, 217, 218, 219',
  MO7: '201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 213, 214, 215, 216, 217, 218, 219',
  MO8: '201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 215, 216, 217, 218, 219',
  MO9: '201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 217, 218, 219',
  MO10: '201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216'
});

function getBlockedPaymentForms(dostawcaKod) {
  const kod = String(dostawcaKod || '').trim().toUpperCase();
  return BLOCKED_PAYMENT_FORMS[kod] || null;
}

function sqlCase(columnName = 'dostawca') {
  const clauses = Object.entries(BLOCKED_PAYMENT_FORMS)
    .map(([kod, ids]) => `WHEN '${kod}' THEN '${ids}'`)
    .join(' ');
  return `CASE UPPER(TRIM(${columnName})) ${clauses} ELSE NULL END`;
}

function ensurePaymentBlocks(dbPath = DB_PATH) {
  const db = new Database(dbPath);
  try {
    const columns = db.prepare('PRAGMA table_info(products)').all();
    if (!columns.some((column) => column.name === 'blokowane_formy_platnosci')) {
      db.exec('ALTER TABLE products ADD COLUMN blokowane_formy_platnosci TEXT');
    }

    const valueSql = sqlCase('dostawca');
    const valueNewSql = sqlCase('NEW.dostawca');
    const update = db.prepare(`
      UPDATE products
      SET blokowane_formy_platnosci = ${valueSql}
      WHERE blokowane_formy_platnosci IS NOT ${valueSql}
    `);

    db.transaction(() => {
      update.run();
      db.exec(`
        DROP TRIGGER IF EXISTS products_blokowane_formy_ai;
        DROP TRIGGER IF EXISTS products_blokowane_formy_au;

        CREATE TRIGGER products_blokowane_formy_ai
        AFTER INSERT ON products
        BEGIN
          UPDATE products
          SET blokowane_formy_platnosci = ${valueNewSql}
          WHERE id = NEW.id;
        END;

        CREATE TRIGGER products_blokowane_formy_au
        AFTER UPDATE OF dostawca ON products
        BEGIN
          UPDATE products
          SET blokowane_formy_platnosci = ${valueNewSql}
          WHERE id = NEW.id;
        END;
      `);
    })();

    return {
      ok: true,
      rows: db.prepare('SELECT COUNT(*) AS count FROM products WHERE blokowane_formy_platnosci IS NOT NULL').get().count
    };
  } finally {
    db.close();
  }
}

module.exports = {
  BLOCKED_PAYMENT_FORMS,
  getBlockedPaymentForms,
  ensurePaymentBlocks
};
