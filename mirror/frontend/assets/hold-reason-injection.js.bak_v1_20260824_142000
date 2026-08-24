// hold-reason-injection.js — DODANE 2026-08-24
// Dokleja ikonę "i" w kółku obok badge'a statusu "wstrzymany" w widoku katalogu.
// Po najechaniu na ikonę pokazuje tooltip z powodem z products.uwaga_cena
// (obecnie: "na zapytanie" dla 5 pozycji MO7 Nokian VF Float King bez ceny w feedzie).
//
// Wzorzec: MutationObserver — nasłuchuje na zmiany DOM w React (Wouter router,
// virtualizacja tabeli). Po każdej zmianie skanuje badge'e i przypisuje tooltip
// jeśli produkt ma uwaga_cena.
//
// Źródło danych: GET /api/products/uwagi-cena → { items: [{kod, uwaga_cena}] }
// Odświeżanie co 5 min (mapa w pamięci przeglądarki).

(function () {
  'use strict';

  const REFRESH_MS = 5 * 60 * 1000;
  const CACHE = new Map(); // kod → uwaga_cena
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
        left: 20px;
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
        box-shadow: 0 4px 12px rgba(0,0,0,.2);
      }
      .hold-reason-icon:hover::before {
        content: '';
        position: absolute;
        left: 14px;
        top: 50%;
        transform: translateY(-50%);
        border: 6px solid transparent;
        border-right-color: #1f2937;
        z-index: 10001;
      }
    `;
    document.head.appendChild(s);
  }

  async function loadReasons() {
    const now = Date.now();
    if (now - lastFetch < REFRESH_MS && CACHE.size > 0) return;
    try {
      const res = await fetch('/api/products/uwagi-cena', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.ok || !Array.isArray(data.items)) return;
      CACHE.clear();
      for (const it of data.items) {
        if (it.kod && it.uwaga_cena) {
          CACHE.set(String(it.kod).trim(), String(it.uwaga_cena));
        }
      }
      lastFetch = now;
      // Po odświeżeniu — ponowny scan
      scanBadges();
    } catch (e) {
      // cichy fail
    }
  }

  function findProductCode(badgeEl) {
    // Idź w górę do TR (row); potem znajdź kolumnę z kodem produktu
    let row = badgeEl.closest('tr');
    if (!row) return null;
    // Kod produktu bywa w pierwszej TD z tekstem MO\d_\w+ lub w komórce "kod"
    const cells = row.querySelectorAll('td');
    for (const td of cells) {
      const text = (td.textContent || '').trim();
      // Wzorzec kodu dostawcy: MOn_XXX
      const m = text.match(/\bMO\d+_[A-Za-z0-9\-\.]+\b/);
      if (m) return m[0];
    }
    return null;
  }

  function scanBadges() {
    if (CACHE.size === 0) return;
    // Znajdź wszystkie elementy z tekstem "wstrzymany" (badge statusu)
    // Badge to najczęściej span z klasą tailwind: bg-*, rounded-*, itd.
    const spans = document.querySelectorAll('span, div');
    for (const el of spans) {
      // Pomiń jeśli już ma ikonę
      if (el.dataset.hrProcessed === '1') continue;
      if (el.querySelector('.hold-reason-icon')) continue;
      // Element musi mieć DOKŁADNIE tekst "wstrzymany" (badge, nie zdanie)
      const text = (el.textContent || '').trim().toLowerCase();
      if (text !== 'wstrzymany') continue;
      // Sprawdź czy to badge (ma klasy bg-*, rounded)
      const cls = el.className || '';
      if (typeof cls !== 'string' || !/bg-|rounded/.test(cls)) continue;
      // Znajdź kod produktu z tego wiersza
      const kod = findProductCode(el);
      if (!kod) continue;
      const reason = CACHE.get(kod);
      if (!reason) {
        el.dataset.hrProcessed = '1';
        continue;
      }
      // Dodaj ikonę "i"
      const icon = document.createElement('span');
      icon.className = 'hold-reason-icon';
      icon.setAttribute('data-reason', reason);
      icon.setAttribute('aria-label', 'Powód wstrzymania: ' + reason);
      icon.title = reason; // fallback
      icon.textContent = 'i';
      // Dodaj po badge'u — jeśli badge jest w kontenerze inline, dodaj obok
      if (el.parentElement) {
        el.parentElement.insertBefore(icon, el.nextSibling);
      } else {
        el.appendChild(icon);
      }
      el.dataset.hrProcessed = '1';
    }
  }

  // MutationObserver — reaguj na zmiany DOM (React re-render, wirtualizacja)
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
    // Odświeżanie cache co 5 min
    setInterval(loadReasons, REFRESH_MS);
    console.log('[hold-reason-injection] uruchomiony');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
