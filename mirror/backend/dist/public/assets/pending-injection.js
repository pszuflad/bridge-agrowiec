/**
 * Bridge Agrowca — injection skryptu "Do akceptacji" do widoku /atrybuty
 *
 * Dodaje przycisk "Do akceptacji [N]" na górze widoku atrybutów.
 * Po kliknięciu zastępuje siatkę kafli listą pending z 4 akcjami per pozycja:
 *  - Akceptuj (dodaje do katalogu z origin='user')
 *  - Akceptuj jako alias (mapuje na istniejącą wartość)
 *  - Odrzuć (przenosi do odrzuconych)
 *  - Edytuj i akceptuj (poprawia wartość przed dodaniem)
 *
 * Nie modyfikuje React bundle — dodaje warstwę na wierzchu przez MutationObserver.
 */
(function() {
  'use strict';

  // API klient używa prefiksu /panel (patrz .htaccess)
  const API_BASE = '/panel/api';

  // Nexus palette + Inter font
  const CSS = `
    .pending-btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 8px 14px; border-radius: 8px;
      background: #01696F; color: #F9F8F5;
      border: none; font: 500 13px/1 Inter, system-ui, sans-serif;
      cursor: pointer; transition: background .15s;
      margin-left: 12px; vertical-align: middle;
    }
    .pending-btn:hover { background: #0C4E54; }
    .pending-btn.active { background: #964219; }
    .pending-btn.active:hover { background: #7a3616; }
    .pending-btn .pending-badge {
      background: #F9F8F5; color: #01696F;
      padding: 2px 8px; border-radius: 10px;
      font-size: 11px; font-weight: 600;
      min-width: 20px; text-align: center;
    }
    .pending-btn.active .pending-badge { background: #F9F8F5; color: #964219; }

    #pending-panel { 
      background: #F9F8F5; border: 1px solid #D4D1CA;
      border-radius: 8px; padding: 20px; margin-top: 16px;
      font-family: Inter, system-ui, sans-serif; font-size: 13px; color: #28251D;
    }
    #pending-panel .pending-toolbar {
      display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
      margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #D4D1CA;
    }
    #pending-panel select, #pending-panel input[type=text] {
      padding: 6px 10px; border: 1px solid #D4D1CA; border-radius: 6px;
      background: white; font: inherit; color: #28251D;
    }
    #pending-panel .stats { color: #7A7974; font-size: 12px; margin-left: auto; }
    #pending-panel table { width: 100%; border-collapse: collapse; }
    #pending-panel th, #pending-panel td {
      padding: 10px 12px; text-align: left; border-bottom: 1px solid #E7E5DE;
      vertical-align: top;
    }
    #pending-panel th { 
      background: #FBFBF9; font-weight: 600; color: #28251D;
      font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em;
    }
    #pending-panel .val {
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      font-size: 12px; background: #FBFBF9; padding: 2px 6px; border-radius: 4px;
      display: inline-block;
    }
    #pending-panel .aliases { margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px; }
    #pending-panel .alias-chip {
      cursor: pointer; padding: 3px 8px; border-radius: 12px;
      background: #E7E5DE; font-size: 11px; color: #28251D;
      border: 1px solid #D4D1CA; transition: all .15s;
    }
    #pending-panel .alias-chip:hover { background: #01696F; color: white; border-color: #01696F; }
    #pending-panel .actions { display: flex; gap: 6px; flex-wrap: wrap; }
    #pending-panel .act-btn {
      padding: 5px 10px; border: none; border-radius: 5px;
      font: 500 11px/1 Inter, sans-serif; cursor: pointer;
      transition: opacity .15s;
    }
    #pending-panel .act-btn.accept { background: #437A22; color: white; }
    #pending-panel .act-btn.edit { background: #01696F; color: white; }
    #pending-panel .act-btn.reject { background: #A12C7B; color: white; }
    #pending-panel .act-btn.alias-btn { background: #964219; color: white; }
    #pending-panel .act-btn:disabled { opacity: 0.4; cursor: wait; }
    #pending-panel .empty {
      text-align: center; padding: 40px 20px; color: #7A7974;
    }
    #pending-panel .rodzaj-tag {
      display: inline-block; padding: 2px 8px; border-radius: 4px;
      background: #F0EEE8; font-size: 11px; color: #7A7974;
      font-weight: 500;
    }
    #pending-panel .count-tag {
      display: inline-block; padding: 2px 6px; border-radius: 10px;
      background: #01696F; color: white; font-size: 11px;
      font-weight: 600;
    }
    #pending-toast {
      position: fixed; bottom: 24px; right: 24px;
      padding: 12px 20px; border-radius: 8px; color: white;
      font: 500 13px/1.4 Inter, sans-serif; z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      opacity: 0; pointer-events: none; transition: opacity .2s;
      max-width: 400px;
    }
    #pending-toast.show { opacity: 1; }
    #pending-toast.success { background: #437A22; }
    #pending-toast.error { background: #A12C7B; }
  `;

  // Wstrzyknij CSS jeden raz
  function injectCSS() {
    if (document.getElementById('pending-inject-css')) return;
    const style = document.createElement('style');
    style.id = 'pending-inject-css';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  // Token: bundle Bridge trzyma token w sessionStorage pod kluczem 'bridge_auth_token'
  function getToken() {
    return sessionStorage.getItem('bridge_auth_token') || '';
  }

  async function api(path, options = {}) {
    const opts = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + getToken(),
        ...(options.headers || {})
      }
    };
    const r = await fetch(API_BASE + path, opts);
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      throw new Error(`${r.status}: ${text || r.statusText}`);
    }
    return r.json();
  }

  function toast(msg, type = 'success') {
    let t = document.getElementById('pending-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'pending-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.className = 'show ' + type;
    setTimeout(() => { t.className = ''; }, 3500);
  }

  // === STAN GLOBALNY ===
  const state = {
    isOpen: false,          // czy panel pending otwarty
    items: [],              // wszystkie pending
    filter: 'all',          // filtr rodzaj
    search: '',             // search
    count: 0,               // liczba do badge
    lastRoute: '',          // ostatnia route (do detekcji zmiany)
  };

  // === POBRANIE LICZNIKA (dla badge) ===
  async function refreshCount() {
    try {
      const data = await api('/atrybuty/pending');
      state.count = (data.pending || []).length;
      updateBadge();
    } catch (e) {
      console.warn('[pending-inject] refreshCount failed:', e.message);
    }
  }

  function updateBadge() {
    const btn = document.getElementById('pending-inject-btn');
    if (btn) {
      const badge = btn.querySelector('.pending-badge');
      if (badge) badge.textContent = state.count;
    }
  }

  // === RENDER PRZYCISKU ===
  function ensureButton() {
    // Sprawdź czy jesteśmy na /atrybuty
    if (!location.pathname.endsWith('/atrybuty')) return;
    // Sprawdź czy przycisk już jest
    if (document.getElementById('pending-inject-btn')) return;

    // Znajdź nagłówek widoku atrybutów — element z tekstem "Atrybuty" (h1/h2)
    // W bundle: "title:'Atrybuty'" renderowane jako header komponent — szukamy przez tekst
    const headers = Array.from(document.querySelectorAll('h1, h2, [class*="title"]'));
    const headerEl = headers.find(el => 
      el.textContent.trim() === 'Atrybuty' && !el.closest('#pending-panel')
    );
    if (!headerEl) return;

    // Wstrzyknij przycisk obok nagłówka
    const btn = document.createElement('button');
    btn.id = 'pending-inject-btn';
    btn.className = 'pending-btn';
    btn.innerHTML = `Do akceptacji <span class="pending-badge">${state.count}</span>`;
    btn.addEventListener('click', togglePanel);

    // Wstaw przycisk po nagłówku
    if (headerEl.parentElement) {
      headerEl.parentElement.appendChild(btn);
    }
  }

  // === TOGGLE PANEL ===
  async function togglePanel() {
    state.isOpen = !state.isOpen;
    const btn = document.getElementById('pending-inject-btn');
    if (btn) btn.classList.toggle('active', state.isOpen);

    if (state.isOpen) {
      await renderPanel();
    } else {
      const p = document.getElementById('pending-panel');
      if (p) p.remove();
    }
  }

  // === RENDER PANEL ===
  async function renderPanel() {
    let panel = document.getElementById('pending-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'pending-panel';
      // Wstaw panel po nagłówku atrybutów, przed kaflami
      const btn = document.getElementById('pending-inject-btn');
      const container = btn ? btn.closest('[class*="container"], main, [class*="page"]') || btn.parentElement.parentElement : null;
      if (container) {
        // Znajdź kontener siatki kafli i wstaw panel przed nim
        const grid = container.querySelector('[class*="grid"]');
        if (grid) {
          grid.style.display = 'none'; // ukryj kafle
          grid.dataset.hiddenByPending = '1';
          grid.parentElement.insertBefore(panel, grid);
        } else {
          container.appendChild(panel);
        }
      } else {
        document.body.appendChild(panel);
      }
    }

    panel.innerHTML = '<div class="empty">Ładowanie...</div>';

    try {
      const data = await api('/atrybuty/pending');
      state.items = data.pending || [];
      state.count = state.items.length;
      updateBadge();
    } catch (e) {
      panel.innerHTML = `<div class="empty" style="color:#A12C7B">Błąd: ${e.message}</div>`;
      return;
    }

    // Zbierz unikalne rodzaje dla filtra
    const rodzaje = Array.from(new Set(state.items.map(x => x.rodzaj))).sort();

    // Zastosuj filtr
    const filtered = state.items.filter(item => {
      if (state.filter !== 'all' && item.rodzaj !== state.filter) return false;
      if (state.search && !item.wartosc.toLowerCase().includes(state.search.toLowerCase())) return false;
      return true;
    });

    // Toolbar HTML
    const toolbarHTML = `
      <div class="pending-toolbar">
        <label>Rodzaj:</label>
        <select id="pending-filter">
          <option value="all">Wszystkie (${state.items.length})</option>
          ${rodzaje.map(r => {
            const c = state.items.filter(x => x.rodzaj === r).length;
            return `<option value="${r}" ${state.filter === r ? 'selected' : ''}>${r} (${c})</option>`;
          }).join('')}
        </select>
        <input type="text" id="pending-search" placeholder="Szukaj wartości..." value="${state.search}" style="min-width: 200px">
        <div class="stats">Wyświetlono: <span class="count-tag">${filtered.length}</span> z ${state.items.length}</div>
      </div>
    `;

    // Tabela HTML
    let tableHTML;
    if (filtered.length === 0) {
      tableHTML = '<div class="empty">Brak wartości do akceptacji</div>';
    } else {
      tableHTML = `
        <table>
          <thead>
            <tr>
              <th style="width: 12%">Rodzaj</th>
              <th style="width: 25%">Wartość</th>
              <th style="width: 8%">Wystąpień</th>
              <th style="width: 30%">Sugerowane aliasy</th>
              <th style="width: 25%">Akcje</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(item => {
              const aliasesHTML = (item.similar_existing || []).map(a => 
                `<span class="alias-chip" data-id="${item.id}" data-alias="${escapeAttr(a.wartosc)}">${escapeHtml(a.wartosc)} (${Math.round(a.similarity * 100)}%)</span>`
              ).join('');
              return `
                <tr data-id="${item.id}">
                  <td><span class="rodzaj-tag">${escapeHtml(item.rodzaj)}</span></td>
                  <td><span class="val">${escapeHtml(item.wartosc)}</span></td>
                  <td>${item.wystapien || item.count || '?'}</td>
                  <td>
                    ${aliasesHTML ? `<div class="aliases">${aliasesHTML}</div>` : '<span style="color:#BAB9B4;font-size:11px">brak podobnych</span>'}
                  </td>
                  <td>
                    <div class="actions">
                      <button class="act-btn accept" data-action="accept" data-id="${item.id}">Akceptuj</button>
                      <button class="act-btn edit" data-action="edit" data-id="${item.id}">Edytuj</button>
                      <button class="act-btn reject" data-action="reject" data-id="${item.id}">Odrzuć</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    }

    panel.innerHTML = toolbarHTML + tableHTML;

    // Podpięcia event listenerów
    document.getElementById('pending-filter').addEventListener('change', e => {
      state.filter = e.target.value;
      renderPanel();
    });
    document.getElementById('pending-search').addEventListener('input', e => {
      state.search = e.target.value;
      renderPanel();
    });

    // Delegacja kliknięć na akcje
    panel.querySelectorAll('.act-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.id);
        const action = btn.dataset.action;
        const item = state.items.find(x => x.id === id);
        if (!item) return;
        await handleAction(action, item, btn);
      });
    });

    panel.querySelectorAll('.alias-chip').forEach(chip => {
      chip.addEventListener('click', async () => {
        const id = parseInt(chip.dataset.id);
        const alias = chip.dataset.alias;
        const item = state.items.find(x => x.id === id);
        if (!item) return;
        if (!confirm(`Zmapować "${item.wartosc}" jako alias dla "${alias}"?`)) return;
        await handleAlias(item, alias);
      });
    });
  }

  async function handleAction(action, item, btnEl) {
    btnEl.disabled = true;
    try {
      if (action === 'accept') {
        await api(`/atrybuty/pending/${item.id}/akceptuj`, { method: 'POST' });
        toast(`Zaakceptowano: ${item.wartosc}`, 'success');
      } else if (action === 'reject') {
        const powod = prompt('Powód odrzucenia (opcjonalnie):') || '';
        await api(`/atrybuty/pending/${item.id}/odrzuc`, { 
          method: 'POST', 
          body: JSON.stringify({ powod }) 
        });
        toast(`Odrzucono: ${item.wartosc}`, 'success');
      } else if (action === 'edit') {
        const nowa = prompt(`Edytuj wartość dla rodzaju "${item.rodzaj}":`, item.wartosc);
        if (!nowa || nowa === item.wartosc) return;
        await api(`/atrybuty/pending/${item.id}/akceptuj-z-edycja`, { 
          method: 'POST', 
          body: JSON.stringify({ wartosc: nowa }) 
        });
        toast(`Zapisano: ${nowa}`, 'success');
      }
      // Odśwież listę
      await renderPanel();
    } catch (e) {
      toast(`Błąd: ${e.message}`, 'error');
    } finally {
      btnEl.disabled = false;
    }
  }

  async function handleAlias(item, aliasTarget) {
    try {
      await api(`/atrybuty/pending/${item.id}/akceptuj-jako-alias`, { 
        method: 'POST', 
        body: JSON.stringify({ alias_dla: aliasTarget }) 
      });
      toast(`Alias: ${item.wartosc} → ${aliasTarget}`, 'success');
      await renderPanel();
    } catch (e) {
      toast(`Błąd: ${e.message}`, 'error');
    }
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
  function escapeAttr(s) {
    return escapeHtml(s);
  }

  // === CLEANUP przy zmianie route ===
  function cleanup() {
    const btn = document.getElementById('pending-inject-btn');
    if (btn) btn.remove();
    const panel = document.getElementById('pending-panel');
    if (panel) panel.remove();
    // Przywróć ukrytą siatkę kafli
    document.querySelectorAll('[data-hidden-by-pending="1"]').forEach(el => {
      el.style.display = '';
      delete el.dataset.hiddenByPending;
    });
    state.isOpen = false;
  }

  // === MAIN LOOP ===
  function tick() {
    const currentRoute = location.pathname;
    if (currentRoute !== state.lastRoute) {
      cleanup();
      state.lastRoute = currentRoute;
    }
    if (currentRoute.endsWith('/atrybuty')) {
      if (getToken()) {
        ensureButton();
      }
    }
  }

  function init() {
    injectCSS();
    // Sprawdź co 500ms czy trzeba wstrzyknąć przycisk
    setInterval(tick, 500);
    // Pierwszy refresh licznika po 2s (żeby dać czas na login)
    setTimeout(() => { if (getToken()) refreshCount(); }, 2000);
    // Odświeżaj licznik co 30s
    setInterval(() => { if (getToken()) refreshCount(); }, 30000);
    console.log('[pending-inject] initialized');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
