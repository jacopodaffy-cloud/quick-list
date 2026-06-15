'use strict';

/* ============================================================
   QuickList — lists, by color
   Vanilla, local-first, zero dependencies, installable PWA.

   Architecture (each section maps to a "component"):
     1. Utils
     2. Color system          → <ColorPicker>, hue identity
     3. Store                 → state + CRUD, persistence
     4. Router / Views        → <Home>, <ListDetail>
     5. Components (markup)    → <ListCard>, <ItemRow>, <EmptyState>
     6. Interactions          → <Find/Sort/Filter>, <DragReorder>,
                                <SwipeDelete>, <SmartAdd/Paste>, <Quantity>,
                                <AutoTidy>, <Voice>, <Share>, <Copy>,
                                <Sheet>, <Toast>
     7. Init
   ============================================================ */

/* ====================== 1. Utils ====================== */
const $ = s => document.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const buzz = (p = 8) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { } };
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const norm = s => String(s).trim().toLowerCase();
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function showFatal(err) {
  if (showFatal._done) return; showFatal._done = true;
  const msg = (err && (err.message || String(err))) || 'Unknown error';
  document.body.innerHTML =
    `<div style="max-width:520px;margin:0 auto;padding:60px 24px;font-family:system-ui,sans-serif;color:#14161B">
      <div style="background:#fff;border-radius:22px;padding:24px;box-shadow:0 8px 24px rgba(0,0,0,.08)">
        <div style="font-size:34px">⚡</div>
        <h2 style="margin:8px 0;font-size:20px">Something went wrong</h2>
        <p style="font-size:13px;color:#5A6072;word-break:break-word">${esc(msg)}</p>
        <div style="margin-top:16px;display:flex;gap:8px">
          <button onclick="location.reload()" style="background:#14161B;color:#fff;border:0;border-radius:999px;padding:12px 20px;font-weight:700;cursor:pointer">Reload</button>
          <button onclick="localStorage.removeItem('quicklist.v1');location.reload()" style="background:#EEF0F4;border:0;border-radius:999px;padding:12px 20px;font-weight:700;cursor:pointer">Reset data</button>
        </div>
      </div>
    </div>`;
}
window.addEventListener('error', e => showFatal(e.error || e.message));

/* icons */
const ic = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const I = {
  plus: ic('<path d="M12 5v14M5 12h14"/>'),
  back: ic('<path d="m15 19-7-7 7-7"/>'),
  dots: ic('<circle cx="5" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.7" fill="currentColor" stroke="none"/>'),
  grip: ic('<circle cx="9" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.4" fill="currentColor" stroke="none"/>'),
  tick: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="tk" d="m5 12.5 5 5L19 6"/></svg>',
  mic: ic('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>'),
  send: ic('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  search: ic('<circle cx="11" cy="11" r="7"/><path d="m21 21-4-4"/>'),
  x: ic('<path d="M18 6 6 18M6 6l12 12"/>'),
  sliders: ic('<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2.4" fill="var(--surface)"/><circle cx="15" cy="12" r="2.4" fill="var(--surface)"/><circle cx="8" cy="18" r="2.4" fill="var(--surface)"/>'),
  pin: ic('<path d="M12 17v5"/><path d="M9 3h6l1 7 2.5 2.5H5.5L8 10z"/>'),
  unpin: ic('<path d="M12 17v5"/><path d="M9 3h6l1 7 2.5 2.5H5.5L8 10z"/><path d="m3 3 18 18"/>'),
  copy: ic('<rect x="9" y="9" width="12" height="12" rx="3"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
  whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.08.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35zM12 2a10 10 0 0 0-8.6 15.07L2 22l5.05-1.32A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3 .78.8-2.92-.2-.3A8.2 8.2 0 1 1 12 20.2z"/></svg>',
  trash: ic('<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6"/>'),
  duplicate: ic('<rect x="8" y="8" width="13" height="13" rx="3"/><path d="M4 16a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2"/>'),
  palette: ic('<path d="M12 22a10 10 0 1 1 0-20 8.5 8.5 0 0 1 0 17h-1.5a1.5 1.5 0 0 0-1 2.6A1.9 1.9 0 0 1 12 22Z"/><circle cx="7.5" cy="10.5" r="1" fill="currentColor"/><circle cx="12" cy="7.5" r="1" fill="currentColor"/><circle cx="16.5" cy="10.5" r="1" fill="currentColor"/>'),
  broom: ic('<path d="M19.4 4.6 14 10M9 21l-5-5 5.5-5.5a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L9 21ZM4 16l-2 5 5-2"/>'),
  sink: ic('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>'),
  spark: ic('<path d="M12 2l1.6 5L19 8.5l-4.4 3.2L16 17l-4-3-4 3 1.4-5.3L5 8.5 10.4 7Z"/>'),
};

/* ====================== 2. Color system ====================== */
const PALETTE = [
  { id: 'coral', hex: '#F2555A' }, { id: 'tangerine', hex: '#F2883E' }, { id: 'amber', hex: '#E8A917' },
  { id: 'lime', hex: '#86B93A' }, { id: 'emerald', hex: '#21A971' }, { id: 'teal', hex: '#15A8A0' },
  { id: 'sky', hex: '#2E97E8' }, { id: 'indigo', hex: '#5A63E0' }, { id: 'violet', hex: '#9457D6' }, { id: 'pink', hex: '#E25CA6' },
];
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return { r: n >> 16 & 255, g: n >> 8 & 255, b: n & 255 }; }
function luminance(h) {
  const { r, g, b } = hexRgb(h);
  const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); };
  return .2126 * f(r) + .7152 * f(g) + .0722 * f(b);
}
const onColor = h => luminance(h) > .42 ? '#171717' : '#FFFFFF';
function applyHue(el, hex) { el.style.setProperty('--c', hex); el.style.setProperty('--on', onColor(hex)); }
const colorIndex = hex => { const i = PALETTE.findIndex(p => p.hex === hex); return i < 0 ? 99 : i; };

/* ====================== 3. Store ====================== */
const KEY = 'quicklist.v1';
let state;            // assigned in init() (avoids TDZ on mkList/mkItem)
let homeQuery = '';   // runtime search text

function blank() { return { v: 1, lists: [], nextColor: 0, sort: 'recent', filterColor: null }; }
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.lists)) { s.sort = s.sort || 'recent'; if (!('filterColor' in s)) s.filterColor = null; return s; }
  } catch (e) { }
  return seed();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { } }

const mkItem = (text, done = false, qty = null) => ({ id: uid(), text, done: !!done, qty: qty && qty > 1 ? qty : null });
function mkList(color) {
  return { id: uid(), title: '', color: color || nextColor(), items: [], pinned: false, tidy: false, createdAt: Date.now(), updatedAt: Date.now() };
}
function nextColor() { const c = PALETTE[state.nextColor % PALETTE.length].hex; state.nextColor++; return c; }
const getList = id => state.lists.find(l => l.id === id);
const touch = l => { l.updatedAt = Date.now(); };
function tidySort(l) { if (!l.tidy) return; const u = l.items.filter(i => !i.done), d = l.items.filter(i => i.done); l.items = [...u, ...d]; }

/* CRUD */
function createList() { const l = mkList(); state.lists.unshift(l); save(); return l; }
function deleteList(id) {
  const i = state.lists.findIndex(l => l.id === id); if (i < 0) return;
  const [removed] = state.lists.splice(i, 1); save();
  if (view.name === 'detail' && view.id === id) showHome(false); else renderHome();
  toast('List deleted', 'Undo', () => { state.lists.splice(i, 0, removed); save(); rerender(); });
}
function duplicateList(id) {
  const src = getList(id); if (!src) return;
  const copy = { ...src, id: uid(), pinned: false, title: src.title ? src.title + ' copy' : '', items: src.items.map(it => mkItem(it.text, it.done, it.qty)), createdAt: Date.now(), updatedAt: Date.now() };
  state.lists.unshift(copy); save(); showDetail(copy.id); toast('List duplicated');
}
function clearDone(id) {
  const l = getList(id); if (!l) return;
  const removed = l.items.filter(i => i.done);
  if (!removed.length) { toast('Nothing checked off yet'); return; }
  l.items = l.items.filter(i => !i.done); touch(l); save(); rerender();
  toast(`Cleared ${removed.length}`, 'Undo', () => { l.items.push(...removed); tidySort(l); save(); rerender(); });
}
function togglePin(id) {
  const l = getList(id); if (!l) return;
  l.pinned = !l.pinned; touch(l); save();
  toast(l.pinned ? 'Pinned to top' : 'Unpinned');
}
function toggleTidy(id) {
  const l = getList(id); if (!l) return;
  l.tidy = !l.tidy; if (l.tidy) tidySort(l); touch(l); save(); rerender();
  toast(l.tidy ? 'Checked items sink to the bottom' : 'Manual order');
}
function seed() {
  const s = blank();
  const groc = mkList('#21A971'); groc.title = 'Weekend groceries'; groc.pinned = true; groc.tidy = true;
  groc.items = [mkItem('Sourdough', true), mkItem('Oat milk', false, 2), mkItem('Avocados', true, 3), mkItem('Cherry tomatoes'), mkItem('Parmesan'), mkItem('Coffee beans')];
  tidySort(groc);
  const trip = mkList('#2E97E8'); trip.title = '';
  trip.items = ['Charger', 'Passport', 'Sunglasses', 'Headphones', 'Swimsuit'].map(t => mkItem(t));
  const ideas = mkList('#9457D6'); ideas.title = 'Weekend ideas';
  ideas.items = ['Bike along the river', 'That new ramen place', 'Finish the book', 'Call mum'].map((t, i) => mkItem(t, i === 3));
  s.lists = [groc, trip, ideas]; s.nextColor = 3;
  return s;
}

/* ====================== 4. Router / Views ====================== */
const view = { name: 'home', id: null };
let histOK = true;
const pushNav = o => { if (histOK) try { history.pushState(o, ''); } catch (e) { histOK = false; } };
function navBack() { if (histOK) history.back(); else manualBack(); }
function manualBack() { if (sheetOpen()) return closeSheet(); if (view.name === 'detail') showHome(false); }
window.addEventListener('popstate', e => {
  if (sheetOpen()) return closeSheetNow();
  if (e.state && e.state.v === 'detail' && getList(e.state.id)) showDetail(e.state.id, false);
  else showHome(false);
});

function showHome(push = false) {
  view.name = 'home'; view.id = null;
  $('#page-detail').hidden = true;
  const h = $('#page-home'); h.hidden = false;
  h.style.animation = 'none'; void h.offsetWidth; h.style.animation = '';
  renderHome(); window.scrollTo(0, 0);
  if (push) pushNav({ v: 'home' });
}
function showDetail(id, push = true) {
  if (!getList(id)) return showHome(false);
  view.name = 'detail'; view.id = id;
  $('#page-home').hidden = true;
  const d = $('#page-detail'); d.hidden = false;
  d.style.animation = 'none'; void d.offsetWidth; d.style.animation = '';
  $('#add-input').value = ''; syncSend();
  renderDetail(); window.scrollTo(0, 0);
  if (push) pushNav({ v: 'detail', id });
}
const rerender = () => view.name === 'detail' ? renderDetail() : renderHome();

/* ====================== 5. Components (markup) ====================== */
const titleOr = l => l.title.trim();
const progress = l => { const t = l.items.length; return t ? l.items.filter(i => i.done).length / t : 1.1; };

// home ordering: pinned first, then chosen sort; with text + colour filters
function homeView() {
  let ls = state.lists.slice();
  if (state.filterColor) ls = ls.filter(l => l.color === state.filterColor);
  const q = norm(homeQuery);
  if (q) ls = ls.filter(l => norm(l.title).includes(q) || l.items.some(i => norm(i.text).includes(q)));
  const cmp = {
    recent: (a, b) => b.updatedAt - a.updatedAt,
    name: (a, b) => (a.title || '￿').localeCompare(b.title || '￿'),
    progress: (a, b) => progress(a) - progress(b),
    color: (a, b) => colorIndex(a.color) - colorIndex(b.color) || b.updatedAt - a.updatedAt,
  }[state.sort] || ((a, b) => b.updatedAt - a.updatedAt);
  ls.sort(cmp);
  ls.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)); // stable: pinned to front
  return ls;
}
function previewItems(l, q) {
  let its = l.items.slice();
  if (q) its.sort((a, b) => (norm(b.text).includes(q) ? 1 : 0) - (norm(a.text).includes(q) ? 1 : 0));
  return its.slice(0, 3);
}
const hl = (text, q) => q ? esc(text).replace(new RegExp(`(${reEsc(q)})`, 'ig'), '<mark>$1</mark>') : esc(text);

function ListCard(l) {
  const done = l.items.filter(i => i.done).length, total = l.items.length;
  const pct = total ? Math.round(done / total * 100) : 0;
  const t = titleOr(l), q = norm(homeQuery);
  return `<button class="card" style="--c:${l.color}" data-open="${l.id}" aria-label="${esc(t || 'Untitled list')}">
    <span class="card-top">
      <span class="swatch-dot">${l.pinned ? `<span class="pin-flag">${I.pin}</span>` : ''}</span>
      <span class="card-menu" data-menu="${l.id}" role="button" aria-label="List options">${I.dots}</span>
    </span>
    <span class="card-title ${t ? '' : 'untitled'}">${t ? hl(t, q) : 'Untitled'}</span>
    ${total ? `<span class="card-preview">${previewItems(l, q).map(it =>
      `<span class="pl ${it.done ? 'done' : ''}">${hl(it.text, q)}</span>`).join('')}</span>` : ''}
    <span class="card-foot">
      <span class="card-bar"><i style="width:${pct}%"></i></span>
      <span class="card-count">${total ? `${done}/${total}` : 'empty'}</span>
    </span>
  </button>`;
}

function ItemRow(it) {
  return `<div class="item-wrap">
    <div class="del-bg">${I.trash}</div>
    <div class="item ${it.done ? 'done' : ''}" data-id="${it.id}">
      <span class="handle" data-handle aria-label="Drag to reorder">${I.grip}</span>
      <button class="check" data-check="${it.id}" role="checkbox" aria-checked="${it.done}" aria-label="${esc(it.text)}">${I.tick}</button>
      <span class="item-text" data-edit="${it.id}"><span class="tx">${esc(it.text)}</span></span>
      ${it.qty > 1 ? `<button class="qty" data-qty="${it.id}" aria-label="Quantity ${it.qty}, tap to add one">×${it.qty}</button>` : ''}
    </div>
  </div>`;
}

/* ---- Home view ---- */
function renderHome() {
  const total = state.lists.length;
  const ls = homeView();
  const filtering = !!(homeQuery.trim() || state.filterColor);
  $('#home-sub').textContent = total
    ? (filtering ? `${ls.length} of ${total} shown` : `${total} ${total === 1 ? 'list' : 'lists'}`)
    : 'Tap + to start';
  $('#search-wrap').hidden = total === 0;
  $('#search-clear').hidden = !homeQuery;

  const grid = $('#grid');
  if (total === 0) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1">
      <div class="empty-dots">${PALETTE.slice(0, 5).map(p => `<i style="background:${p.hex}"></i>`).join('')}</div>
      <h2>A blank canvas</h2>
      <p>Make a list for anything — groceries, a trip, an idea. Pick a colour, no title needed.</p>
      <button class="btn btn-c" style="--c:#5A63E0;--on:#fff" data-new>${I.plus} New list</button>
    </div>`;
    return;
  }
  if (ls.length === 0) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1">
      <div class="glyph">🔍</div><h2>No matches</h2>
      <p>Nothing here fits that search${state.filterColor ? ' and colour' : ''}.</p>
      <button class="btn btn-soft" data-clear-filters>Clear filters</button>
    </div>`;
    return;
  }
  grid.innerHTML = ls.map(ListCard).join('');
  [...grid.querySelectorAll('.card')].forEach((c, i) => c.style.animationDelay = Math.min(i * 35, 250) + 'ms');
}

/* ---- Detail view ---- */
function renderDetail() {
  const l = getList(view.id); if (!l) return showHome(false);
  applyHue($('#page-detail'), l.color);

  const ti = $('#detail-title');
  if (ti.value !== l.title) ti.value = l.title;

  const done = l.items.filter(i => i.done).length, total = l.items.length;
  $('#detail-meta').innerHTML = `<span class="chip-color"></span>${total ? `${done} of ${total} done` : 'Empty list'}${l.pinned ? ' · pinned' : ''}`;
  $('#progress').style.display = total ? '' : 'none';
  $('#progress-fill').style.width = (total ? Math.round(done / total * 100) : 0) + '%';

  const wrap = $('#items');
  if (total) {
    wrap.innerHTML = l.items.map(ItemRow).join('');
    [...wrap.querySelectorAll('.item')].forEach((r, i) => { if (!noAnim) r.style.animationDelay = Math.min(i * 26, 160) + 'ms'; else r.style.animation = 'none'; });
  } else wrap.innerHTML = '';
  noAnim = false;

  $('#detail-empty').innerHTML = total ? '' : `<div class="detail-empty">
    <div class="ring">${I.spark}</div>
    <h3>Nothing here yet</h3>
    <p>Type below, paste a whole list, or tap the mic and say it.</p>
  </div>`;
}
let noAnim = false;

/* ====================== 6a. Smart add / paste / quantity ====================== */
const stripMarker = s => s.replace(/^\s*(?:[-*•·–—‣]|\d+[.)]|\[\s*[xX·]?\s*\])\s+/, '');
function parseQty(text) {
  let t = text, qty = null, m;
  if ((m = t.match(/(?:^|\s)[x×](\d{1,3})\b/i)) || (m = t.match(/\b(\d{1,3})\s*[x×](?=\s|$)/i))) {
    qty = clamp(parseInt(m[1], 10), 1, 999);
    t = (t.slice(0, m.index) + ' ' + t.slice(m.index + m[0].length)).replace(/\s{2,}/g, ' ').trim();
  }
  return { text: t, qty: qty && qty > 1 ? qty : null };
}
function smartLine(line) {
  const done = /^\s*(?:[-*•]\s*)?\[\s*[xX]\s*\]/.test(line);
  const { text, qty } = parseQty(stripMarker(line).trim());
  return text ? { text, qty, done } : null;
}
function addItems(raw) {
  const l = getList(view.id); if (!l) return;
  // split on new lines first (preserves per-line markers), then commas within a line
  const parts = raw.split(/\r?\n/).flatMap(line => line.split(',')).map(s => s.trim()).filter(Boolean);
  let added = 0;
  for (const p of parts) { const it = smartLine(p); if (it) { l.items.push(mkItem(it.text, it.done, it.qty)); added++; } }
  if (!added) return;
  if (l.tidy) tidySort(l);
  touch(l); save(); buzz(8); renderDetail();
  requestAnimationFrame(() => { const el = $('#items').lastElementChild; el && el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
}
function bumpQty(id) {
  const l = getList(view.id); if (!l) return;
  const it = l.items.find(i => i.id === id); if (!it) return;
  it.qty = (it.qty || 1) >= 9 ? 2 : (it.qty || 1) + 1;
  touch(l); save(); buzz(6);
  const b = document.querySelector(`.qty[data-qty="${id}"]`);
  if (b) { b.textContent = '×' + it.qty; b.style.transform = 'scale(1.25)'; setTimeout(() => b.style.transform = '', 130); }
}
function syncSend() { $('#add-send').disabled = !$('#add-input').value.trim(); }

/* ====================== 6b. Voice ====================== */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, listening = false;
function toggleVoice() {
  if (!SR) { toast("Voice input isn't supported here"); return; }
  if (listening) { rec && rec.stop(); return; }
  rec = new SR();
  rec.lang = navigator.language || 'en-US';
  rec.interimResults = true; rec.continuous = false;
  let finalText = '';
  rec.onstart = () => { listening = true; $('#mic').classList.add('listening'); $('#voice-hint').textContent = 'Listening… speak your item'; buzz(10); };
  rec.onresult = e => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript; }
    $('#add-input').value = (finalText + interim).replace(/\s+/g, ' ').trimStart(); syncSend();
  };
  rec.onerror = ev => { $('#voice-hint').textContent = ev.error === 'not-allowed' ? 'Microphone access denied' : ''; };
  rec.onend = () => {
    listening = false; $('#mic').classList.remove('listening'); $('#voice-hint').textContent = '';
    const txt = $('#add-input').value.trim();
    if (txt) { addItems(txt); $('#add-input').value = ''; syncSend(); }
  };
  try { rec.start(); } catch (e) { }
}

/* ====================== 6c. Drag to reorder ====================== */
let drag = null;
function onPointerDown(e) {
  const handle = e.target.closest('[data-handle]');
  if (handle) { startDrag(e, handle.closest('.item')); return; }
  if (e.target.closest('.qty') || e.target.closest('.check')) return;
  const text = e.target.closest('.item-text');
  if (text) startSwipe(e, text.closest('.item-wrap'), text.dataset.edit);
}
function startDrag(e, row) {
  if (!row) return;
  e.preventDefault();
  const container = $('#items');
  const rows = [...container.querySelectorAll('.item')];
  const rects = rows.map(r => r.getBoundingClientRect());
  const h = rects[0].height;
  const gap = rects.length > 1 ? rects[1].top - rects[0].bottom : 9;
  drag = { row, rows, rects, container, h, gap, startY: e.clientY, index: rows.indexOf(row), current: rows.indexOf(row) };
  row.classList.add('dragging');
  rows.forEach(r => { if (r !== row) r.classList.add('shift'); });
  container.style.touchAction = 'none';
  try { row.setPointerCapture(e.pointerId); } catch (x) { }
  buzz(12);
  window.addEventListener('pointermove', onDragMove, { passive: false });
  window.addEventListener('pointerup', onDragEnd);
  window.addEventListener('pointercancel', onDragEnd);
}
function onDragMove(e) {
  if (!drag) return;
  e.preventDefault();
  const dy = e.clientY - drag.startY;
  drag.row.style.transform = `translateY(${dy}px) scale(1.02)`;
  let target = 0;
  for (let i = 0; i < drag.rects.length; i++) {
    const mid = drag.rects[i].top + drag.rects[i].height / 2;
    if (e.clientY > mid) target = i + (i >= drag.index ? 1 : 0); else { target = i; break; }
  }
  target = clamp(target > drag.index ? target - 1 : target, 0, drag.rows.length - 1);
  if (target !== drag.current) {
    drag.current = target; buzz(5);
    const step = drag.h + drag.gap;
    drag.rows.forEach((r, i) => {
      if (r === drag.row) return;
      let shift = 0;
      if (drag.index < target && i > drag.index && i <= target) shift = -step;
      else if (drag.index > target && i >= target && i < drag.index) shift = step;
      r.style.transform = shift ? `translateY(${shift}px)` : '';
    });
  }
}
function onDragEnd() {
  if (!drag) return;
  window.removeEventListener('pointermove', onDragMove);
  window.removeEventListener('pointerup', onDragEnd);
  window.removeEventListener('pointercancel', onDragEnd);
  const { index, current, container } = drag;
  drag.rows.forEach(r => { r.classList.remove('shift', 'dragging'); r.style.transform = ''; });
  container.style.touchAction = '';
  if (current !== index) {
    const l = getList(view.id);
    const [moved] = l.items.splice(index, 1);
    l.items.splice(current, 0, moved);
    if (l.tidy) tidySort(l);
    touch(l); save(); buzz(14);
  }
  drag = null; noAnim = true; renderDetail();
}

/* ====================== 6d. Swipe to delete (or tap to edit) ====================== */
let swipe = null;
function startSwipe(e, wrap, itemId) {
  swipe = { wrap, row: wrap.querySelector('.item'), itemId, x0: e.clientX, y0: e.clientY, dx: 0, mode: '' };
  window.addEventListener('pointermove', onSwipeMove, { passive: false });
  window.addEventListener('pointerup', onSwipeEnd);
  window.addEventListener('pointercancel', onSwipeEnd);
}
function onSwipeMove(e) {
  if (!swipe) return;
  const dx = e.clientX - swipe.x0, dy = e.clientY - swipe.y0;
  if (!swipe.mode) {
    if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { swipe.mode = 'swipe'; swipe.wrap.classList.add('swiping'); }
    else if (Math.abs(dy) > 10) { cleanupSwipe(); return; }
    else return;
  }
  if (swipe.mode !== 'swipe') return;
  e.preventDefault();
  swipe.dx = Math.min(0, dx);
  swipe.row.style.transition = 'none';
  swipe.row.style.transform = `translateX(${swipe.dx}px)`;
}
function onSwipeEnd() {
  if (!swipe) return;
  const { row, wrap, itemId, dx, mode } = swipe;
  cleanupSwipe();
  if (mode === 'swipe') {
    row.style.transition = ''; row.style.transform = '';
    if (dx < -90) deleteItem(itemId);
    else setTimeout(() => wrap.classList.remove('swiping'), 160); // let it slide back, then hide red
  } else if (!mode) beginEdit(itemId); // tap, no movement
}
function cleanupSwipe() {
  window.removeEventListener('pointermove', onSwipeMove);
  window.removeEventListener('pointerup', onSwipeEnd);
  window.removeEventListener('pointercancel', onSwipeEnd);
  swipe = null;
}

/* ====================== item mutations ====================== */
function toggleItem(itemId) {
  const l = getList(view.id); if (!l) return;
  const it = l.items.find(i => i.id === itemId); if (!it) return;
  it.done = !it.done; touch(l);
  if (l.tidy) { tidySort(l); save(); noAnim = true; renderDetail(); }
  else {
    save();
    const row = document.querySelector(`.item[data-id="${itemId}"]`);
    if (row) { row.classList.toggle('done', it.done); const cb = row.querySelector('.check'); cb && cb.setAttribute('aria-checked', it.done); }
  }
  buzz(it.done ? 10 : 6);
  const done = l.items.filter(i => i.done).length, total = l.items.length;
  $('#progress-fill').style.width = Math.round(done / total * 100) + '%';
  $('#detail-meta').innerHTML = `<span class="chip-color"></span>${done} of ${total} done${l.pinned ? ' · pinned' : ''}`;
  if (done === total && total > 0) toast('List complete ✓');
}
function deleteItem(itemId) {
  const l = getList(view.id); if (!l) return;
  const idx = l.items.findIndex(i => i.id === itemId); if (idx < 0) return;
  const row = document.querySelector(`.item[data-id="${itemId}"]`);
  const [removed] = l.items.splice(idx, 1); touch(l); save(); buzz(12);
  if (row) { row.classList.add('removing'); setTimeout(renderDetail, 180); } else renderDetail();
  toast('Item deleted', 'Undo', () => { l.items.splice(idx, 0, removed); save(); renderDetail(); });
}
function beginEdit(itemId) {
  const l = getList(view.id); if (!l) return;
  const it = l.items.find(i => i.id === itemId); if (!it) return;
  const span = document.querySelector(`.item-text[data-edit="${itemId}"]`); if (!span) return;
  const raw = it.text + (it.qty > 1 ? ` x${it.qty}` : '');
  const input = document.createElement('input');
  input.className = 'item-edit'; input.value = raw; input.setAttribute('aria-label', 'Edit item');
  span.replaceWith(input); input.focus(); input.setSelectionRange(raw.length, raw.length);
  const commit = () => {
    const v = input.value.trim();
    if (!v) { const i = l.items.indexOf(it); if (i >= 0) l.items.splice(i, 1); }
    else { const { text, qty } = parseQty(stripMarker(v)); it.text = text || v; it.qty = qty; }
    touch(l); save(); renderDetail();
  };
  input.addEventListener('blur', commit, { once: true });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); if (e.key === 'Escape') { input.value = raw; input.blur(); } });
}

/* ====================== 6e. Share / Copy ====================== */
function listToText(l) {
  const lines = [];
  const t = l.title.trim();
  if (t) { lines.push(t); lines.push(''); }
  l.items.forEach(it => lines.push((it.done ? '✓ ' : '• ') + it.text + (it.qty > 1 ? ` ×${it.qty}` : '')));
  return lines.join('\n');
}
function shareWhatsApp(id) {
  const l = getList(id); if (!l) return;
  if (!l.items.length) { toast('Add an item first'); return; }
  window.open('https://wa.me/?text=' + encodeURIComponent(listToText(l)), '_blank', 'noopener');
}
async function copyList(id) {
  const l = getList(id); if (!l) return;
  if (!l.items.length) { toast('Add an item first'); return; }
  const text = listToText(l);
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(text);
    else { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
    buzz(10); toast('Copied as text');
  } catch (e) { toast('Could not copy'); }
}

/* ====================== 6f. Sheets ====================== */
const sheetOpen = () => !!$('#sheet-root').firstElementChild;
function openSheet(html) {
  if (sheetOpen()) closeSheetNow(true); else pushNav({ v: 'sheet' });
  $('#sheet-root').innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="handle-bar"></div>${html}</div>`;
  const bd = $('#backdrop'); bd.hidden = false;
  requestAnimationFrame(() => { $('#sheet-root').firstElementChild.classList.add('show'); bd.classList.add('show'); });
}
function closeSheetNow(keepBd) {
  const el = $('#sheet-root').firstElementChild; if (!el) return;
  el.classList.remove('show');
  if (!keepBd) { $('#backdrop').classList.remove('show'); setTimeout(() => { $('#backdrop').hidden = true; }, 240); }
  setTimeout(() => { if ($('#sheet-root').firstElementChild === el) $('#sheet-root').innerHTML = ''; }, 260);
}
const closeSheet = () => { if (sheetOpen()) navBack(); };

function openFindSheet() {
  const sorts = [['recent', 'Recent'], ['name', 'Name'], ['progress', 'To-do first'], ['color', 'Colour']];
  openSheet(`
    <h2 class="sheet-title">Sort &amp; filter</h2>
    <p class="sheet-sub">How your lists are arranged on the home screen.</p>
    <div class="seg">${sorts.map(([k, lab]) => `<button class="seg-btn ${state.sort === k ? 'on' : ''}" data-sort="${k}">${lab}</button>`).join('')}</div>
    <p class="field-label">Filter by colour</p>
    <div class="filter-row">
      <button class="fcell all ${!state.filterColor ? 'on' : ''}" data-filter="">All</button>
      ${PALETTE.map(p => `<button class="fcell ${state.filterColor === p.hex ? 'on' : ''}" style="background:${p.hex};color:${p.hex}" data-filter="${p.hex}" aria-label="${p.id}"></button>`).join('')}
    </div>`);
}
function openListMenu(id) {
  const l = getList(id); if (!l) return;
  openSheet(`
    <h2 class="sheet-title">${esc(titleOr(l) || 'Untitled list')}</h2>
    <p class="sheet-sub">${l.items.length} ${l.items.length === 1 ? 'item' : 'items'}</p>
    <div class="menu-list">
      <button class="menu-item" data-act="open" data-id="${id}">${I.spark} Open</button>
      <button class="menu-item" data-act="pin" data-id="${id}">${l.pinned ? I.unpin + ' Unpin' : I.pin + ' Pin to top'}</button>
      <button class="menu-item" data-act="color" data-id="${id}">${I.palette} Change colour</button>
      <button class="menu-item" data-act="copy" data-id="${id}">${I.copy} Copy as text</button>
      <button class="menu-item" data-act="whatsapp" data-id="${id}">${I.whatsapp} Share on WhatsApp</button>
      <button class="menu-item" data-act="duplicate" data-id="${id}">${I.duplicate} Duplicate</button>
      <div class="menu-sep"></div>
      <button class="menu-item danger" data-act="delete" data-id="${id}">${I.trash} Delete</button>
    </div>`);
}
function openDetailMenu(id) {
  const l = getList(id); if (!l) return;
  openSheet(`
    <h2 class="sheet-title">List options</h2>
    <div class="menu-list">
      <button class="menu-item" data-act="pin" data-id="${id}">${l.pinned ? I.unpin + ' Unpin from home' : I.pin + ' Pin to top'}</button>
      <button class="menu-item ${l.tidy ? 'on' : ''}" data-act="tidy" data-id="${id}">${I.sink} Keep checked at bottom <span class="mi-note">${l.tidy ? 'On' : 'Off'}</span></button>
      <button class="menu-item" data-act="color" data-id="${id}">${I.palette} Change colour</button>
      <button class="menu-item" data-act="cleardone" data-id="${id}">${I.broom} Clear checked items</button>
      <button class="menu-item" data-act="duplicate" data-id="${id}">${I.duplicate} Duplicate list</button>
      <div class="menu-sep"></div>
      <button class="menu-item danger" data-act="delete" data-id="${id}">${I.trash} Delete list</button>
    </div>`);
}
function openColorSheet(id) {
  const l = getList(id); if (!l) return;
  openSheet(`
    <h2 class="sheet-title">Colour</h2>
    <p class="sheet-sub">Sets the identity for this list everywhere.</p>
    <div class="color-grid">
      ${PALETTE.map(p => `<button class="color-cell ${l.color === p.hex ? 'sel' : ''}" style="background:${p.hex};color:${p.hex}" data-color="${p.hex}" data-id="${id}" aria-label="${p.id}"></button>`).join('')}
    </div>`);
}
function setColor(id, hex) {
  const l = getList(id); if (!l) return;
  l.color = hex; touch(l); save(); buzz(8); closeSheet(); rerender();
}

/* ====================== 6g. Toast ====================== */
let toastT = null, toastFn = null;
function toast(msg, actionLabel, fn) {
  toastFn = fn || null;
  $('#toast-root').innerHTML = `<div class="toast">${esc(msg)}${actionLabel ? `<button class="toast-action" data-toast-action>${esc(actionLabel)}</button>` : ''}</div>`;
  requestAnimationFrame(() => $('#toast-root').firstElementChild?.classList.add('show'));
  clearTimeout(toastT);
  toastT = setTimeout(() => { const el = $('#toast-root').firstElementChild; if (el) { el.classList.remove('show'); setTimeout(() => $('#toast-root').innerHTML = '', 280); } }, 3800);
}

/* ====================== Event wiring ====================== */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-open],[data-menu],[data-new],[data-act],[data-color],[data-check],[data-qty],[data-sort],[data-filter],[data-clear-filters],[data-toast-action]');
  if (!t) return;

  if (t.dataset.menu) { e.stopPropagation(); return openListMenu(t.dataset.menu); }
  if (t.hasAttribute('data-open')) return showDetail(t.dataset.open);
  if (t.hasAttribute('data-new')) { const l = createList(); showDetail(l.id); setTimeout(() => $('#add-input').focus(), 320); return; }
  if (t.dataset.check) return toggleItem(t.dataset.check);
  if (t.dataset.qty) return bumpQty(t.dataset.qty);
  if (t.dataset.color) return setColor(t.dataset.id, t.dataset.color);
  if (t.hasAttribute('data-clear-filters')) { homeQuery = ''; $('#home-search').value = ''; state.filterColor = null; save(); renderHome(); return; }
  if (t.hasAttribute('data-toast-action')) { if (toastFn) { toastFn(); toastFn = null; } $('#toast-root').innerHTML = ''; return; }

  if (t.hasAttribute('data-sort')) {
    state.sort = t.dataset.sort; save(); renderHome();
    [...document.querySelectorAll('.seg-btn')].forEach(b => b.classList.toggle('on', b.dataset.sort === state.sort));
    return;
  }
  if (t.hasAttribute('data-filter')) {
    state.filterColor = t.dataset.filter || null; save(); renderHome();
    [...document.querySelectorAll('.fcell')].forEach(b => b.classList.toggle('on', (b.dataset.filter || '') === (state.filterColor || '')));
    return;
  }

  if (t.dataset.act) {
    const id = t.dataset.id, act = t.dataset.act;
    if (act === 'open') { closeSheet(); setTimeout(() => showDetail(id), 60); }
    else if (act === 'pin') { closeSheet(); togglePin(id); rerender(); }
    else if (act === 'tidy') { closeSheet(); toggleTidy(id); }
    else if (act === 'color') { closeSheet(); setTimeout(() => openColorSheet(id), 280); }
    else if (act === 'copy') { closeSheet(); copyList(id); }
    else if (act === 'whatsapp') { closeSheet(); shareWhatsApp(id); }
    else if (act === 'duplicate') { closeSheet(); setTimeout(() => duplicateList(id), 60); }
    else if (act === 'cleardone') { closeSheet(); clearDone(id); }
    else if (act === 'delete') { closeSheet(); setTimeout(() => deleteList(id), 60); }
  }
});

$('#fab').addEventListener('click', () => { const l = createList(); showDetail(l.id); setTimeout(() => $('#add-input').focus(), 320); });
$('#sort-btn').addEventListener('click', openFindSheet);
$('#detail-back').addEventListener('click', navBack);
$('#detail-copy').addEventListener('click', () => copyList(view.id));
$('#detail-whatsapp').addEventListener('click', () => shareWhatsApp(view.id));
$('#detail-menu').addEventListener('click', () => openDetailMenu(view.id));
$('#detail-meta').addEventListener('click', () => openColorSheet(view.id));

$('#detail-title').addEventListener('input', () => { const l = getList(view.id); if (l) { l.title = $('#detail-title').value; touch(l); save(); } });

$('#home-search').addEventListener('input', e => { homeQuery = e.target.value; renderHome(); });
$('#search-clear').addEventListener('click', () => { homeQuery = ''; $('#home-search').value = ''; renderHome(); $('#home-search').focus(); });

$('#addbar').addEventListener('submit', e => { e.preventDefault(); const v = $('#add-input').value.trim(); if (v) { addItems(v); $('#add-input').value = ''; syncSend(); } });
$('#add-input').addEventListener('input', syncSend);
$('#add-input').addEventListener('paste', e => {
  const txt = (e.clipboardData || window.clipboardData)?.getData('text') || '';
  if (/[\n,]/.test(txt) && txt.trim()) { e.preventDefault(); addItems(txt); $('#add-input').value = ''; syncSend(); }
});
$('#mic').addEventListener('click', toggleVoice);

$('#items').addEventListener('pointerdown', onPointerDown);

$('#backdrop').addEventListener('click', closeSheet);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (sheetOpen()) closeSheet(); else if (view.name === 'detail') navBack(); }
});

/* ====================== 7. Init ====================== */
function init() {
  state = load();
  try { history.replaceState({ v: 'home' }, ''); } catch (e) { histOK = false; }
  $('#page-detail').hidden = true; $('#page-home').hidden = false; $('#backdrop').hidden = true;

  $('#detail-back').innerHTML = I.back;
  $('#detail-copy').innerHTML = I.copy;
  $('#detail-whatsapp').innerHTML = I.whatsapp;
  $('#detail-menu').innerHTML = I.dots;
  $('#sort-btn').innerHTML = I.sliders;
  $('#search-ic').innerHTML = I.search;
  $('#search-clear').innerHTML = I.x;
  $('#mic').innerHTML = I.mic;
  $('#add-send').innerHTML = I.send;
  $('#fab-icon').innerHTML = I.plus;
  if (!SR) $('#mic').style.display = 'none';

  showHome(false);
  syncSend();

  try { if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js'); } catch (e) { }
}
try { init(); } catch (err) { showFatal(err); }
