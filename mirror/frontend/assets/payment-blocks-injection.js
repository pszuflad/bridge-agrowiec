/**
 * Bridge Agrowca: kolumna "Blokowane formy płatności" w katalogu.
 * Wartość jest deterministycznie przypisana do magazynu MO.
 */
(function () {
  'use strict';

  const VALUES = Object.freeze({
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

  function decorateTable(table) {
    const headerRow = table.querySelector('thead tr');
    if (!headerRow) return;

    const headers = Array.from(headerRow.children);
    const supplierIndex = headers.findIndex((cell) => (cell.textContent || '').trim() === 'Dost.');
    const actionIndex = headers.findIndex((cell) => (cell.textContent || '').trim() === 'Akcje');
    if (supplierIndex < 0 || actionIndex < 0) return;

    if (!headerRow.querySelector('[data-payment-blocks-header]')) {
      const th = document.createElement('th');
      th.dataset.paymentBlocksHeader = 'true';
      th.className = 'px-3 py-2.5 font-medium whitespace-nowrap';
      th.style.minWidth = '420px';
      th.textContent = 'Blokowane formy płatności';
      headerRow.insertBefore(th, headerRow.children[actionIndex]);
    }

    table.querySelectorAll('tbody tr[data-testid^="row-product-"]').forEach((row) => {
      const cells = Array.from(row.children);
      const supplier = (cells[supplierIndex]?.textContent || '').trim().toUpperCase();
      let td = row.querySelector('[data-payment-blocks-cell]');
      if (!td) {
        td = document.createElement('td');
        td.dataset.paymentBlocksCell = 'true';
        td.className = 'px-3 py-2 text-xs font-mono';
        td.style.minWidth = '420px';
        row.insertBefore(td, row.lastElementChild);
      }
      const value = VALUES[supplier] || '';
      td.textContent = value || '—';
      td.title = value;
    });
  }

  function refresh() {
    if (location.pathname !== '/katalog') return;
    document.querySelectorAll('table').forEach(decorateTable);
  }

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      refresh();
    });
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('popstate', refresh);
  setInterval(refresh, 1500);
  refresh();
})();
