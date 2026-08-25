// hold-reason-injection.js — DODANE 2026-08-24, v3 2026-08-24 14:40
// Dokleja ikonę "i" w kółku obok badge'a statusu "wstrzymany" w widoku katalogu.
// Tooltip pokazuje powód wstrzymania z /api/products/hold-reasons.
//
// v3 (2026-08-24 14:40):
//   - Pokazuje powód dla WSZYSTKICH wstrzymanych (nie tylko 'na zapytanie').
//   - Nowy endpoint /api/products/hold-reasons zwraca reason liczony na runtime:
//     * uwaga_cena (jeśli ustawione) → dosłownie
//     * cena=0 & stan=0 → "Brak ceny i stanu u dostawcy"
//     * cena=0 & stan>0 → "Brak ceny u dostawcy"
//     * cena>0 & stan=0 → "Brak stanu magazynowego u dostawcy"
//     * cena>0 & stan>0 → "Wstrzymane — sprawdź ręcznie"
// v2 (2026-08-24 14:20): dopasowanie po EAN, selektor bez klas Tailwind.

(function () {
  'use strict';

  const REFRESH_MS = 5 * 60 * 1000;
  const CACHE_EAN = new Map(); // ean → reason
  const CACHE_KOD = new Map(); // kod → reason
  let lastFetch = 0;

  const STYLE_ID = 'hold-reason-injection-style';
  if (!document.getElementById(STYLE_ID)) {
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      .hold-reason-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        margin-left: 6px;
        border-radius: 50%;
        background: #fbbf24;
        color: #1f2937;
        font-size: 11px;
        font-weight: 700;
        font-family: system-ui, sans-serif;
        cursor: help;
        vertical-align: middle;
        user-select: none;
        line-height: 1;
        position: relative;
      }
      .hold-reason-icon:hover::after {
        content: attr(data-reason);
        position: absolute;
        left: 22px;
        top: 50%;
        transform: translateY(-50%);
        background: #1f2937;
        color: #f9fafb;
        padding: 6px 10px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        white-space: nowrap;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,.3);
        pointer-events: none;
      }
      .hold-reason-icon:hover::before {
        content: '';
        position: absolute;
        left: 15px;
        top: 50%;
        transform: translateY(-50%);
        border: 6px solid transparent;
        border-right-color: #1f2937;
        z-index: 10001;
        pointer-events: none;
      }
    `;
    document.head.appendChild(s);
  }

  async function loadReasons() {
    const now = Date.now();
    if (now - lastFetch < REFRESH_MS && CACHE_EAN.size > 0) return;
    try {
      const res = await fetch('/api/products/hold-reasons', { credentials: 'include' });
      if (!res.ok) {
        console.warn('[hold-reason] fetch failed:', res.status);
        return;
      }
      const data = await res.json();
      if (!data.ok || !Array.isArray(data.items)) return;
      CACHE_EAN.clear();
      CACHE_KOD.clear();
      for (const it of data.items) {
        if (it.reason) {
          if (it.ean) CACHE_EAN.set(String(it.ean).trim(), String(it.reason));
          if (it.kod) CACHE_KOD.set(String(it.kod).trim(), String(it.reason));
        }
      }
      lastFetch = now;
      console.log('[hold-reason] loaded', CACHE_EAN.size, 'EAN,', CACHE_KOD.size, 'kod');
      // Reset dataset, żeby przy nowych danych wszystkie wiersze się przeliczyly
      document.querySelectorAll('[data-hr-processed]').forEach(el => {
        delete el.dataset.hrProcessed;
      });
      document.querySelectorAll('.hold-reason-icon').forEach(el => el.remove());
      scanBadges();
    } catch (e) {
      console.warn('[hold-reason] fetch exception:', e);
    }
  }

  function findReasonForRow(badgeEl) {
    let row = badgeEl.closest('tr');
    if (!row) return null;
    const cells = row.querySelectorAll('td');
    for (const td of cells) {
      const text = (td.textContent || '').trim();
      // 1) EAN — 13 cyfr
      const eanMatch = text.match(/\b\d{13}\b/);
      if (eanMatch && CACHE_EAN.has(eanMatch[0])) {
        return CACHE_EAN.get(eanMatch[0]);
      }
      // 2) kod MOn_XXX
      const kodMatch = text.match(/\bMO\d+_[A-Za-z0-9\-\.]+\b/);
      if (kodMatch && CACHE_KOD.has(kodMatch[0])) {
        return CACHE_KOD.get(kodMatch[0]);
      }
    }
    return null;
  }

  function scanBadges() {
    if (CACHE_EAN.size === 0 && CACHE_KOD.size === 0) return;
    const all = document.querySelectorAll('span, div');
    for (const el of all) {
      if (el.dataset.hrProcessed === '1') continue;
      if (el.children.length > 0) continue;
      const text = (el.textContent || '').trim().toLowerCase();
      if (text !== 'wstrzymany') continue;
      const reason = findReasonForRow(el);
      el.dataset.hrProcessed = '1';
      if (!reason) continue;
      const icon = document.createElement('span');
      icon.className = 'hold-reason-icon';
      icon.setAttribute('data-reason', reason);
      icon.setAttribute('aria-label', 'Powód wstrzymania: ' + reason);
      icon.title = reason;
      icon.textContent = 'i';
      if (el.parentElement) {
        el.parentElement.insertBefore(icon, el.nextSibling);
      }
    }
  }

  let scanScheduled = false;
  function scheduleScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    requestAnimationFrame(() => {
      scanScheduled = false;
      scanBadges();
    });
  }

  const observer = new MutationObserver(() => {
    scheduleScan();
  });

  function boot() {
    observer.observe(document.body, { childList: true, subtree: true });
    loadReasons();
    setInterval(loadReasons, REFRESH_MS);
    console.log('[hold-reason-injection] v3 uruchomiony');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
