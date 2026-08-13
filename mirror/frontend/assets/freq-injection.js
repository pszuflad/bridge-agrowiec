/**
 * Bridge Agrowca — injection: edycja częstotliwości sprawdzania cennika per dostawca
 * v3 — 2026-07-09 (fix: PATCH wymaga numerycznego id; fix: okno nie zamyka się
 * przy kliknięciu w rozwijaną listę select; fix: pozycjonowanie dla ostatnich
 * kart na liście, które nie mieszczą się pod przyciskiem "Zmień")
 *
 * Backend już wspiera PATCH /api/dostawcy/:id z polem czestotliwoscMinuty
 * (patrz index.cjs, endpoint patch /api/dostawcy/:id, whitelist pól:
 * status, url, czestotliwoscMinuty, sposobDostarczania).
 * Frontend dotąd tylko WYŚWIETLAŁ tę wartość jako statyczny badge "co X min",
 * bez możliwości edycji. Ten skrypt dogrywa obok każdego badge'a
 * mały przycisk "Zmień" -> input z listą typowych wartości + zapis.
 *
 * Działa na widoku Konfiguracja -> Dostawcy, karta z data-testid="supplier-config-<KOD>".
 * Nie modyfikuje bundla React — tylko dogrywa DOM i wywołuje istniejące API.
 */
(function () {
  'use strict';

  const API_BASE = '/panel/api';
  const VERSION = 'freq-v3';
  const OPTIONS_MIN = [5, 15, 30, 60, 120, 240, 360, 720, 1440, 2880, 10080];

  function fmt(min) {
    if (min < 60) return `${min} min`;
    if (min < 1440) return `${Math.round(min / 60)} godz.`;
    return `${Math.round(min / 1440)} dni`;
  }

  const CSS = `
    .freq-edit-btn {
      display:inline-flex; align-items:center; gap:4px;
      padding:1px 6px; border-radius:6px;
      border:1px solid #393836; background:transparent; color:#797876;
      font:500 10px/1.4 Inter, system-ui, sans-serif; cursor:pointer;
      margin-left:4px;
    }
    .freq-edit-btn:hover { background:#201F1D; color:#CDCCCA; }
    .freq-popover {
      position:absolute; z-index:9999; background:#1C1B19; border:1px solid #393836;
      border-radius:8px; padding:10px; box-shadow:0 8px 24px rgba(0,0,0,.4);
      display:flex; flex-direction:column; gap:6px; min-width:180px;
    }
    .freq-popover label { font:500 11px/1.3 Inter, sans-serif; color:#797876; }
    .freq-popover select, .freq-popover input {
      width:100%; box-sizing:border-box; padding:5px 6px; border-radius:6px;
      border:1px solid #393836; background:#0f0e0d; color:#CDCCCA; font:500 12px/1.3 Inter, sans-serif;
    }
    .freq-popover .freq-actions { display:flex; gap:6px; margin-top:2px; }
    .freq-popover button.freq-save {
      flex:1; padding:6px 8px; border-radius:6px; border:none;
      background:#D97706; color:#171614; font:600 12px/1 Inter, sans-serif; cursor:pointer;
    }
    .freq-popover button.freq-save:hover { background:#B45309; }
    .freq-popover button.freq-cancel {
      flex:1; padding:6px 8px; border-radius:6px; border:1px solid #393836;
      background:transparent; color:#CDCCCA; font:500 12px/1 Inter, sans-serif; cursor:pointer;
    }
    .freq-popover button.freq-save:disabled { opacity:.5; cursor:wait; }
  `;

  function injectCss() {
    if (document.getElementById('freq-inject-css')) return;
    const style = document.createElement('style');
    style.id = 'freq-inject-css';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function getCookie(name) {
    return document.cookie.split(';').map(s => s.trim()).find(s => s.startsWith(name + '='))?.split('=')[1];
  }

  // Backend PATCH /api/dostawcy/:id wymaga NUMERYCZNEGO id (nie kodu "MO2").
  // Trzymamy mapę kod -> id, odświeżaną z GET /api/dostawcy.
  let kodToId = {};
  let kodToIdLoadedAt = 0;

  async function loadKodToId(force) {
    if (!force && Date.now() - kodToIdLoadedAt < 30000 && Object.keys(kodToId).length) return kodToId;
    const res = await fetch(`${API_BASE}/dostawcy`, { credentials: 'include' });
    if (!res.ok) return kodToId;
    const list = await res.json().catch(() => []);
    const map = {};
    (Array.isArray(list) ? list : []).forEach(d => { if (d?.kod && d?.id != null) map[d.kod] = d.id; });
    kodToId = map;
    kodToIdLoadedAt = Date.now();
    return kodToId;
  }

  async function patchSupplier(kod, czestotliwoscMinuty) {
    let map = await loadKodToId(false);
    let id = map[kod];
    if (id == null) {
      map = await loadKodToId(true);
      id = map[kod];
    }
    if (id == null) throw new Error(`Nie znaleziono id dostawcy dla kodu ${kod}`);
    const res = await fetch(`${API_BASE}/dostawcy/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ czestotliwoscMinuty })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Błąd zapisu częstotliwości');
    return data;
  }

  function closePopover() {
    document.querySelectorAll('.freq-popover').forEach(el => el.remove());
  }

  function openPopover(anchorEl, kod, currentMin) {
    closePopover();
    const pop = document.createElement('div');
    pop.className = 'freq-popover';

    const label = document.createElement('label');
    label.textContent = `Co ile sprawdzać cennik — ${kod}`;
    pop.appendChild(label);

    const select = document.createElement('select');
    let hasCurrent = false;
    OPTIONS_MIN.forEach(m => {
      const opt = document.createElement('option');
      opt.value = String(m);
      opt.textContent = fmt(m);
      if (currentMin && Number(currentMin) === m) { opt.selected = true; hasCurrent = true; }
      select.appendChild(opt);
    });
    const customOpt = document.createElement('option');
    customOpt.value = 'custom';
    customOpt.textContent = 'Inna wartość (minuty)...';
    select.appendChild(customOpt);
    if (!hasCurrent && currentMin) select.value = 'custom';

    const customInput = document.createElement('input');
    customInput.type = 'number';
    customInput.min = '1';
    customInput.placeholder = 'Liczba minut';
    customInput.style.display = select.value === 'custom' ? 'block' : 'none';
    if (select.value === 'custom' && currentMin) customInput.value = String(currentMin);

    select.addEventListener('change', () => {
      customInput.style.display = select.value === 'custom' ? 'block' : 'none';
    });

    pop.appendChild(select);
    pop.appendChild(customInput);

    const actions = document.createElement('div');
    actions.className = 'freq-actions';
    const saveBtn = document.createElement('button');
    saveBtn.className = 'freq-save';
    saveBtn.textContent = 'Zapisz';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'freq-cancel';
    cancelBtn.textContent = 'Anuluj';
    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);
    pop.appendChild(actions);

    cancelBtn.addEventListener('click', closePopover);

    saveBtn.addEventListener('click', async () => {
      const val = select.value === 'custom' ? parseInt(customInput.value, 10) : parseInt(select.value, 10);
      if (!val || val < 1) {
        customInput.style.borderColor = '#dc2626';
        return;
      }
      saveBtn.disabled = true;
      saveBtn.textContent = 'Zapisywanie...';
      try {
        await patchSupplier(kod, val);
        closePopover();
        // Odśwież widoczny badge bez czekania na refetch React-Query.
        const card = document.querySelector(`[data-testid="supplier-config-${kod}"]`);
        if (card) {
          const badge = card.querySelector('.freq-badge-text');
          if (badge) badge.textContent = `co ${val} min`;
          const btn = card.querySelector('.freq-edit-btn');
          if (btn) btn.dataset.currentMin = String(val);
        }
      } catch (e) {
        saveBtn.textContent = 'Błąd — spróbuj ponownie';
        saveBtn.disabled = false;
      }
    });

    document.body.appendChild(pop);

    // Pozycjonowanie: domyślnie pod przyciskiem, ale jeśli nie ma miejsca
    // do dołu ekranu (np. ostatnia karta na liście, jak MO9), otwórz w górę.
    const rect = anchorEl.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();
    const popHeight = popRect.height || 160;
    const spaceBelow = window.innerHeight - rect.bottom;
    let top;
    if (spaceBelow < popHeight + 12 && rect.top > popHeight + 12) {
      top = window.scrollY + rect.top - popHeight - 6;
    } else {
      top = window.scrollY + rect.bottom + 6;
    }
    let left = window.scrollX + rect.left;
    const maxLeft = window.scrollX + window.innerWidth - (popRect.width || 200) - 8;
    if (left > maxLeft) left = Math.max(window.scrollX + 8, maxLeft);
    pop.style.top = `${Math.max(window.scrollY + 4, top)}px`;
    pop.style.left = `${left}px`;

    // Zamykanie tylko na kliknięcie faktycznie poza popoverem.
    // Natywny <select> w niektórych silnikach (i przy interakcji programowej/a11y)
    // wysyła zdarzenia click/focus, które trzeba ignorować, żeby okno nie znikało
    // w momencie próby wyboru wartości z listy.
    let ignoreNextDocClick = true;
    setTimeout(() => { ignoreNextDocClick = false; }, 250);

    function onDocClick(ev) {
      if (ignoreNextDocClick) return;
      if (pop.contains(ev.target) || ev.target === anchorEl) return;
      // Jeśli focus jest wewnątrz popovera (np. otwarta natywna lista select),
      // nie zamykaj — to sygnał, że użytkownik wciąż operuje na tym polu.
      if (document.activeElement && pop.contains(document.activeElement)) return;
      closePopover();
      document.removeEventListener('mousedown', onDocClick, true);
    }

    setTimeout(() => {
      document.addEventListener('mousedown', onDocClick, true);
    }, 250);

    select.addEventListener('focus', () => { ignoreNextDocClick = true; });
    select.addEventListener('blur', () => { setTimeout(() => { ignoreNextDocClick = false; }, 150); });
  }

  function decorateCard(card) {
    if (card.dataset.freqDecorated) return;
    const kod = (card.getAttribute('data-testid') || '').replace('supplier-config-', '');
    if (!kod) return;

    // Znajdź badge sposobu dostarczania "url" — przycisk edycji ma sens tylko dla auto-pollingu.
    const badges = card.querySelectorAll('span, div');
    let freqBadge = null;
    badges.forEach(el => {
      if (el.children.length === 0 && /^co\s+\d+\s+min$/.test((el.textContent || '').trim())) {
        freqBadge = el;
      }
    });

    const sposobBadge = Array.from(badges).find(el =>
      el.children.length === 0 && ['url', 'mail', 'upload'].includes((el.textContent || '').trim())
    );
    const sposob = sposobBadge ? sposobBadge.textContent.trim() : null;

    if (freqBadge) {
      freqBadge.classList.add('freq-badge-text');
      const btn = document.createElement('button');
      btn.className = 'freq-edit-btn';
      btn.type = 'button';
      btn.textContent = 'Zmień';
      btn.dataset.currentMin = (freqBadge.textContent.match(/\d+/) || [''])[0];
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        openPopover(btn, kod, btn.dataset.currentMin);
      });
      freqBadge.insertAdjacentElement('afterend', btn);
    } else if (sposob === 'url') {
      // Dostawca typu URL bez ustawionej częstotliwości — dodaj przycisk "Ustaw harmonogram".
      const container = sposobBadge.parentElement;
      const btn = document.createElement('button');
      btn.className = 'freq-edit-btn';
      btn.type = 'button';
      btn.textContent = 'Ustaw harmonogram';
      btn.dataset.currentMin = '';
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        openPopover(btn, kod, '');
      });
      sposobBadge.insertAdjacentElement('afterend', btn);
    }

    card.dataset.freqDecorated = '1';
  }

  function scan() {
    document.querySelectorAll('[data-testid^="supplier-config-"]').forEach(decorateCard);
  }

  function init() {
    injectCss();
    scan();
    const observer = new MutationObserver(() => scan());
    observer.observe(document.body, { childList: true, subtree: true });
    console.log(`[freq-injection] ${VERSION} aktywny`);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
