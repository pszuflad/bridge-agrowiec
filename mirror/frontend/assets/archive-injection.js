/**
 * Bridge Agrowca — injection: zakładka Archiwum importów
 * v1 — 2026-08-21 (prośba Anny: widok plików, które wpadły z importów)
 *
 * Co robi:
 *   1. Dokleja pozycję „Archiwum importów" do sidebara (obok „Historia").
 *   2. Przejmuje trasę /archiwum — bundle pokazuje tam 404 (brak trasy w routerze),
 *      więc podmieniamy zawartość <main> na własny widok (ten sam wzorzec co pending-injection).
 *   3. Lista: data, dostawca, źródło, rozmiar, status (OK/BŁĄD), rekordy, pobieranie.
 *      Filtry: dostawca, status, miesiąc. Pasek zajętości archiwum (limit 5 GB).
 *
 * Backend: GET /api/import-archive (+ /stats, + /file/:month/:name) — archive_module.cjs.
 * Token jak w pending-injection: sessionStorage 'bridge_auth_token'.
 */
(function () {
  'use strict';

  const API_BASE = '/panel/api';
  const VERSION = 'archive-v1';

  const state = {
    items: [],
    stats: null,
    filterDostawca: '',
    filterStatus: '',
    filterMiesiac: '',
    lastRoute: '',
    loading: false,
  };

  // ============================================================
  // STYL — dopasowany do motywu panelu (sidebar ciemny, bursztyn)
  // ============================================================
  const CSS = `
    .arch-wrap { font-family: Inter, system-ui, sans-serif; color: hsl(215 28% 12%); }
    .arch-head { display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:12px; margin-bottom:16px; }
    .arch-head h1 { font-size:22px; font-weight:700; margin:0; }
    .arch-head .arch-sub { font-size:13px; color:#6b7280; margin-top:4px; }
    .arch-filters { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:14px; }
    .arch-filters select {
      padding:6px 10px; border:1px solid #d1d5db; border-radius:6px; font:500 13px Inter, sans-serif;
      background:#fff; color:#111827; cursor:pointer;
    }
    .arch-usage { font-size:12px; color:#6b7280; }
    .arch-usage-bar { width:220px; height:6px; background:#e5e7eb; border-radius:3px; overflow:hidden; margin-top:4px; }
    .arch-usage-fill { height:100%; background:hsl(35 70% 45%); border-radius:3px; }
    .arch-table { width:100%; border-collapse:collapse; font-size:13px; background:#fff; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden; }
    .arch-table th { text-align:left; padding:9px 12px; background:#f9fafb; font:600 11px Inter, sans-serif; color:#6b7280; text-transform:uppercase; letter-spacing:.04em; border-bottom:1px solid #e5e7eb; }
    .arch-table td { padding:9px 12px; border-bottom:1px solid #f3f4f6; vertical-align:middle; }
    .arch-table tr:hover td { background:#fafafa; }
    .arch-badge { display:inline-block; padding:2px 8px; border-radius:99px; font:600 10px Inter, sans-serif; }
    .arch-badge.ok { background:#d1fae5; color:#065f46; }
    .arch-badge.blad { background:#fee2e2; color:#991b1b; }
    .arch-src { font:500 11px Inter, sans-serif; color:#6b7280; }
    .arch-name { font-family:'JetBrains Mono', monospace; font-size:11.5px; color:#374151; word-break:break-all; }
    .arch-dl {
      display:inline-flex; align-items:center; gap:4px; padding:4px 10px; border-radius:6px;
      border:1px solid hsl(35 70% 45%); color:hsl(35 70% 45%); background:transparent;
      font:600 12px Inter, sans-serif; cursor:pointer; text-decoration:none;
    }
    .arch-dl:hover { background:hsl(35 70% 45%); color:#fff; }
    .arch-empty { padding:40px; text-align:center; color:#9ca3af; font-size:14px; }
    .arch-err { padding:12px 14px; background:#fee2e2; color:#991b1b; border-radius:6px; font-size:13px; margin-bottom:12px; }
    .arch-refresh { padding:6px 12px; border-radius:6px; border:1px solid #d1d5db; background:#fff; font:600 12px Inter, sans-serif; color:#374151; cursor:pointer; }
    .arch-refresh:hover { background:#f9fafb; }
  `;

  // ============================================================
  // API
  // ============================================================
  function getToken() {
    return sessionStorage.getItem('bridge_auth_token') || '';
  }

  async function api(path) {
    const r = await fetch(API_BASE + path, {
      headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    if (!r.ok) throw new Error(`${r.status}: ${await r.text().catch(() => r.statusText)}`);
    return r.json();
  }

  async function loadData() {
    state.loading = true;
    renderView();
    try {
      const params = new URLSearchParams();
      if (state.filterDostawca) params.set('dostawca', state.filterDostawca);
      if (state.filterStatus) params.set('status', state.filterStatus);
      if (state.filterMiesiac) params.set('miesiac', state.filterMiesiac);
      const qs = params.toString();
      const [list, stats] = await Promise.all([
        api('/import-archive' + (qs ? '?' + qs : '')),
        api('/import-archive/stats').catch(() => null),
      ]);
      state.items = list.items || [];
      state.stats = stats;
    } catch (e) {
      state.error = e.message;
    }
    state.loading = false;
    renderView();
  }

  // ============================================================
  // HELPERY
  // ============================================================
  const MONTHS_PL = ['styczeń','luty','marzec','kwiecień','maj','czerwiec','lipiec','sierpień','wrzesień','październik','listopad','grudzień'];
  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    const p = n => String(n).padStart(2, '0');
    return `${p(d.getDate())}.${p(d.getMonth()+1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function fmtSize(b) {
    if (b == null) return '—';
    if (b < 1024) return b + ' B';
    if (b < 1024*1024) return (b/1024).toFixed(1) + ' KB';
    if (b < 1024*1024*1024) return (b/1024/1024).toFixed(1) + ' MB';
    return (b/1024/1024/1024).toFixed(2) + ' GB';
  }
  function fmtMonthLabel(ym) {
    const [y, m] = ym.split('-').map(Number);
    return `${MONTHS_PL[m-1]} ${y}`;
  }

  // ============================================================
  // RENDER
  // ============================================================
  function findMain() {
    return document.querySelector('main');
  }

  function renderView() {
    if (!isArchiveRoute()) return;
    const main = findMain();
    if (!main) return;

    let view = document.getElementById('archive-inject-view');
    if (!view) {
      view = document.createElement('div');
      view.id = 'archive-inject-view';
      view.className = 'arch-wrap px-4 sm:px-6 lg:px-8 py-6 md:py-8 max-w-[1400px] mx-auto';
      main.replaceChildren(view);
    }

    const dostawcy = [...new Set(state.items.map(i => i.dostawca).filter(Boolean))].sort();
    const months = [...new Set(state.items.map(i => (i.id || '').split('/')[0]).filter(Boolean))].sort().reverse();

    const usage = state.stats
      ? `Archiwum: <b>${fmtSize(state.stats.bajtow)}</b> / ${fmtSize(state.stats.limitBajtow)} · ${state.stats.plikow} plików · retencja ${state.stats.retencjaDni} dni`
      : '';
    const usagePct = state.stats ? Math.min(100, (state.stats.bajtow / state.stats.limitBajtow) * 100) : 0;

    view.innerHTML = `
      <div class="arch-head">
        <div>
          <h1>Archiwum importów</h1>
          <div class="arch-sub">Surowe pliki, które wpłynęły z importów (auto-pull, ręczne pobranie z URL, upload z panelu).</div>
        </div>
        <button class="arch-refresh" id="arch-refresh">Odśwież</button>
      </div>
      ${state.error ? `<div class="arch-err">${state.error}</div>` : ''}
      <div class="arch-filters">
        <select id="arch-f-dost"><option value="">Wszyscy dostawcy</option>${dostawcy.map(d => `<option ${d===state.filterDostawca?'selected':''}>${d}</option>`).join('')}</select>
        <select id="arch-f-mies"><option value="">Wszystkie miesiące</option>${months.map(m => `<option value="${m}" ${m===state.filterMiesiac?'selected':''}>${fmtMonthLabel(m)}</option>`).join('')}</select>
        <select id="arch-f-stat">
          <option value="">Każdy status</option>
          <option value="ok" ${state.filterStatus==='ok'?'selected':''}>OK</option>
          <option value="blad" ${state.filterStatus==='blad'?'selected':''}>Błąd parsowania</option>
        </select>
        ${usage ? `<div class="arch-usage" style="margin-left:auto">${usage}<div class="arch-usage-bar"><div class="arch-usage-fill" style="width:${usagePct}%"></div></div></div>` : ''}
      </div>
      ${state.loading ? `<div class="arch-empty">Ładowanie…</div>` : ''}
      ${!state.loading && state.items.length === 0 ? `<div class="arch-empty">Brak zarchiwizowanych plików. Nowe importy będą się tu pojawiać automatycznie.</div>` : ''}
      ${!state.loading && state.items.length > 0 ? `
      <table class="arch-table">
        <thead><tr><th>Data</th><th>Dostawca</th><th>Źródło</th><th>Plik</th><th>Rozmiar</th><th>Rekordy</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${state.items.map(i => `
          <tr>
            <td style="white-space:nowrap">${fmtDate(i.data)}</td>
            <td><b>${i.dostawca || '—'}</b></td>
            <td><span class="arch-src">${i.zrodlo || '—'}${i.uzytkownik ? ' · ' + i.uzytkownik : ''}</span></td>
            <td><div class="arch-name">${i.oryginalnaNazwa || ''}</div>${i.blad ? `<div style="font-size:11px;color:#dc2626;margin-top:2px">${String(i.blad).slice(0,120)}</div>` : ''}</td>
            <td style="white-space:nowrap">${fmtSize(i.rozmiar)}</td>
            <td>${i.rekordy != null ? i.rekordy : '—'}</td>
            <td><span class="arch-badge ${i.status === 'blad' ? 'blad' : 'ok'}">${i.status === 'blad' ? 'BŁĄD' : 'OK'}</span></td>
            <td><button class="arch-dl" data-arch-dl="${encodeURIComponent(i.id)}" data-arch-name="${(i.oryginalnaNazwa || 'plik').replace(/"/g, '')}">Pobierz</button></td>
          </tr>`).join('')}
        </tbody>
      </table>` : ''}
    `;

    document.getElementById('arch-refresh').onclick = () => loadData();
    view.querySelectorAll('[data-arch-dl]').forEach(btn => {
      btn.onclick = () => downloadFile(decodeURIComponent(btn.dataset.archDl), btn.dataset.archName);
    });
    document.getElementById('arch-f-dost').onchange = e => { state.filterDostawca = e.target.value; loadData(); };
    document.getElementById('arch-f-mies').onchange = e => { state.filterMiesiac = e.target.value; loadData(); };
    document.getElementById('arch-f-stat').onchange = e => { state.filterStatus = e.target.value; loadData(); };
  }

  // Pobieranie przez fetch z Bearer (cookie nie zawsze ustawione) → blob → zapis
  // URL: /file/:month/:name — dwa segmenty, bo Apache odrzuca %2F (zakodowany ukośnik) w ścieżce
  async function downloadFile(id, name) {
    try {
      const slash = String(id).indexOf('/');
      const month = String(id).slice(0, slash);
      const fname = String(id).slice(slash + 1);
      const r = await fetch(API_BASE + '/import-archive/file/' + encodeURIComponent(month) + '/' + encodeURIComponent(fname), {
        headers: { 'Authorization': 'Bearer ' + getToken() }
      });
      if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name || 'plik';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      alert('Nie udało się pobrać pliku: ' + e.message);
    }
  }

  // ============================================================
  // ROUTING + NAV
  // ============================================================
  function isArchiveRoute() {
    return location.pathname.endsWith('/archiwum')
        || location.hash === '#/archiwum'
        || location.hash.startsWith('#/archiwum');
  }

  function ensureNavLink() {
    // Sidebar: <nav> z linkami o data-testid="link-nav-*"
    const nav = document.querySelector('nav');
    if (!nav) return;
    if (document.getElementById('archive-nav-link')) return;
    const historia = nav.querySelector('[data-testid="link-nav-historia"]');
    if (!historia) return;

    const link = historia.cloneNode(true);
    link.id = 'archive-nav-link';
    link.removeAttribute('data-testid');
    link.setAttribute('data-testid', 'link-nav-archiwum');
    // href dziedziczy bazę z linku Historia (ta sama ścieżka, inna końcówka)
    link.href = (historia.href || '/panel/historia').replace(/historia[^/]*$/, 'archiwum');
    // Podmień etykietę (drugi span to tekst)
    const spans = link.querySelectorAll('span span');
    const labelSpan = link.querySelector('span > span:last-child');
    if (labelSpan) labelSpan.textContent = 'Archiwum importów';
    link.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      history.pushState(null, '', link.href);
      window.dispatchEvent(new PopStateEvent('popstate'));
      // bundle pokaże 404 → tick() podmieni na nasz widok
    }, true);
    historia.after(link);
  }

  function cleanup() {
    const v = document.getElementById('archive-inject-view');
    if (v) v.remove();
  }

  // ============================================================
  // TICK LOOP
  // ============================================================
  async function tick() {
    const route = location.pathname + location.hash;
    ensureNavLink();
    if (route !== state.lastRoute) {
      const wasArchive = state.lastRoute && (state.lastRoute.endsWith('/archiwum') || state.lastRoute.includes('/archiwum'));
      state.lastRoute = route;
      if (isArchiveRoute()) {
        setTimeout(() => { loadData(); }, 80);
      } else if (wasArchive) {
        cleanup();
      }
    } else if (isArchiveRoute() && !document.getElementById('archive-inject-view')) {
      loadData();
    }
  }

  // ============================================================
  // INIT
  // ============================================================
  function init() {
    const style = document.createElement('style');
    style.id = 'archive-inject-css';
    style.textContent = CSS;
    document.head.appendChild(style);
    setInterval(tick, 400);
    tick();
    console.log('[archive-inject] ' + VERSION + ' aktywny');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
