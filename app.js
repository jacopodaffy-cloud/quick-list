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

/* ====================== 0. Version & Force Update ====================== */
const APP_VERSION_CODE = 2;

async function checkForceUpdate() {
  try {
    const res = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    if (data.minVersionCode && APP_VERSION_CODE < data.minVersionCode) {
      showUpdateWall(data.playStoreUrl || 'https://play.google.com/store/apps/details?id=app.quicklist.twa');
    }
  } catch (e) { /* offline — don't block the user */ }
}

function showUpdateWall(url) {
  const wall = document.createElement('div');
  wall.id = 'update-wall';
  wall.innerHTML = `
    <div class="update-box">
      <div class="update-logo">Quick<span>list</span></div>
      <div class="update-icon">🚀</div>
      <h2 class="update-title">Update available</h2>
      <p class="update-msg">A new version of QuickList is required to continue. Update now to keep your lists in sync.</p>
      <a class="btn update-btn" href="${url}" target="_blank" rel="noopener">Update on Play Store</a>
    </div>
  `;
  document.body.appendChild(wall);
}

/* ====================== 1. Utils ====================== */
const $ = s => document.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const buzz = (p = 8) => { try { if (settings && settings.haptics === false) return; navigator.vibrate && navigator.vibrate(p); } catch (e) { } };
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const norm = s => String(s).trim().toLowerCase();
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ---- input sanitisation: trim, strip control chars, cap length ---- */
const MAX = { title: 80, item: 200, items: 500, lists: 500, user: 40, email: 120, pw: 200, img: 900000 };
const isImgData = s => typeof s === 'string' && /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(s) && s.length <= MAX.img;
const cleanText = (s, max) => String(s == null ? '' : s).replace(new RegExp('[\\u0000-\\u001F\\u007F]','g'), '').replace(/\s+/g, ' ').trim().slice(0, max || 200);

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
          <button id="fatal-reload" style="background:#14161B;color:#fff;border:0;border-radius:999px;padding:12px 20px;font-weight:700;cursor:pointer">Reload</button>
          <button id="fatal-reset" style="background:#EEF0F4;border:0;border-radius:999px;padding:12px 20px;font-weight:700;cursor:pointer">Reset data</button>
        </div>
      </div>
    </div>`;
  const r = document.getElementById('fatal-reload'), x = document.getElementById('fatal-reset');
  if (r) r.addEventListener('click', () => location.reload());
  if (x) x.addEventListener('click', () => { try { localStorage.removeItem('quicklist.v1'); } catch (e) { } location.reload(); });
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
  person: ic('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  cloudOn: ic('<path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.4A3.5 3.5 0 0 1 18 18H7z"/><path d="m9.5 13.5 1.8 1.8 3.5-3.5"/>'),
  device: ic('<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 18h2"/>'),
  refresh: ic('<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v5h-5"/>'),
  signout: ic('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>'),
  shield: ic('<path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>'),
  /* Settings — a clean filled cog ("rotella") with a punched-out centre hole
     (fill-rule evenodd), so the circle is unmistakably part of the gear. Solid
     fill reads crisply at any size/density and in light & dark. */
  gear: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65A.488.488 0 0 0 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1a.5.5 0 0 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"/></svg>',
  trophy: ic('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0Z"/><path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3"/>'),
  medal: ic('<circle cx="12" cy="15" r="6"/><path d="m9 9-3-6M15 9l3-6M9.5 3h5"/><path d="m12 12 .9 1.9 2.1.3-1.5 1.5.4 2.1-1.9-1-1.9 1 .4-2.1L9 14.2l2.1-.3Z" fill="currentColor" stroke="none"/>'),
  award: ic('<circle cx="12" cy="9" r="6"/><path d="m8.5 14-1.5 7 5-3 5 3-1.5-7"/>'),
  sun: ic('<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>'),
  moon: ic('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>'),
  monitor: ic('<rect x="3" y="4" width="18" height="13" rx="2.5"/><path d="M8 21h8M12 17v4"/>'),
  check: ic('<path d="m20 6-11 11-5-5"/>'),
  users: ic('<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 5.2a3.2 3.2 0 0 1 0 6.1"/><path d="M21.5 20a6.5 6.5 0 0 0-4.5-6.2"/>'),
  link: ic('<path d="M9 15l6-6"/><path d="M11 6.5l1.2-1.2a3.5 3.5 0 0 1 5 5L16 11.5"/><path d="M13 17.5l-1.2 1.2a3.5 3.5 0 0 1-5-5L8 12.5"/>'),
  camera: ic('<path d="M3 8.5A2 2 0 0 1 5 6.5h1.5l1-1.8a1.5 1.5 0 0 1 1.3-.7h4.4a1.5 1.5 0 0 1 1.3.7l1 1.8H19a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><circle cx="12" cy="13" r="3.3"/>'),
  image: ic('<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="m4 18 5-5 4 4 3-3 4 4"/>'),
};
const GOOGLE_G = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M22.5 12.2c0-.68-.06-1.36-.18-2.02H12v3.83h5.9a5.05 5.05 0 0 1-2.19 3.31v2.74h3.54c2.07-1.91 3.25-4.72 3.25-7.86z"/><path fill="#34A853" d="M12 23c2.94 0 5.42-.97 7.23-2.64l-3.54-2.74c-.98.66-2.24 1.05-3.69 1.05-2.84 0-5.25-1.92-6.11-4.5H2.23v2.83A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.89 14.17a6.6 6.6 0 0 1 0-4.34V7H2.23a11 11 0 0 0 0 9.99l3.66-2.82z"/><path fill="#EA4335" d="M12 4.75c1.6 0 3.04.55 4.18 1.62l3.13-3.13C17.42 1.46 14.94.5 12 .5A11 11 0 0 0 2.23 7l3.66 2.83C6.75 6.67 9.16 4.75 12 4.75z"/></svg>';

/* ====================== Settings & theme ======================
   Settings are device-level (not per-account): theme, haptics, and
   whether you appear on the global ranking. Theme is also bootstrapped
   in theme.js before first paint so there's no flash. */
const SETTINGS_KEY = 'quicklist.settings';
const DEFAULT_SETTINGS = { theme: 'system', haptics: true, leaderboard: true };
let settings = loadSettings();
function loadSettings() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch (e) { s = {}; }
  const out = { ...DEFAULT_SETTINGS, ...(s && typeof s === 'object' ? s : {}) };
  if (!['system', 'light', 'dark'].includes(out.theme)) out.theme = 'system';
  out.haptics = out.haptics !== false;
  out.leaderboard = out.leaderboard !== false;
  return out;
}
function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { } }
const prefersDark = () => !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
const effectiveDark = () => settings.theme === 'dark' || (settings.theme === 'system' && prefersDark());
function applyTheme() {
  const root = document.documentElement;
  if (settings.theme === 'light' || settings.theme === 'dark') root.setAttribute('data-theme', settings.theme);
  else root.removeAttribute('data-theme');
  const tc = document.getElementById('tc');
  if (tc) tc.setAttribute('content', effectiveDark() ? '#0D0E12' : '#F5F6F8');
}
function setTheme(t) { if (['system', 'light', 'dark'].includes(t)) { settings.theme = t; saveSettings(); applyTheme(); } }

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
const KEY = 'quicklist.v1';              // guest (no account) data
const SESSION_KEY = 'quicklist.session';
const ACCOUNTS_KEY = 'quicklist.accounts'; // device-local accounts (PBKDF2-hashed)
let state;            // assigned in init() (avoids TDZ on mkList/mkItem)
let homeQuery = '';   // runtime search text
let session = null;   // { uid, email, username, provider } | null  (set in init)

const dataKeyFor = uid => 'quicklist.data.' + uid;
const activeKey = () => session ? dataKeyFor(session.uid) : KEY;

const newStats = () => ({ created: 0, completed: 0, checked: 0, since: Date.now() });
function blank() { return { v: 1, lists: [], nextColor: 0, sort: 'recent', filterColor: null, stats: newStats(), updatedAt: Date.now() }; }
const validColor = c => (PALETTE.some(p => p.hex === c) ? c : PALETTE[0].hex);
const cleanId = id => (typeof id === 'string' && /^[\w-]{1,40}$/.test(id)) ? id : uid();
function normStats(st) {
  st = (st && typeof st === 'object') ? st : {};
  const n = v => (Number.isFinite(v) && v >= 0) ? Math.min(Math.floor(v), 1e7) : 0;
  return { created: n(st.created), completed: n(st.completed), checked: n(st.checked), since: Number.isFinite(st.since) ? st.since : Date.now() };
}
/* Deep sanitiser — every state that enters the app (storage, cloud pull,
   shared link, merge) passes through here: malformed dropped, oversized clamped. */
function normalize(s) {
  if (!s || typeof s !== 'object' || !Array.isArray(s.lists)) return null;
  const out = {
    v: 1,
    sort: ['recent', 'name', 'progress', 'color'].includes(s.sort) ? s.sort : 'recent',
    filterColor: PALETTE.some(p => p.hex === s.filterColor) ? s.filterColor : null,
    nextColor: Number.isFinite(s.nextColor) ? Math.max(0, Math.floor(s.nextColor)) : 0,
    stats: normStats(s.stats),
    updatedAt: Number.isFinite(s.updatedAt) ? s.updatedAt : Date.now(),
    lists: s.lists.slice(0, MAX.lists)
      .filter(l => l && typeof l === 'object' && Array.isArray(l.items))
      .map(l => ({
        id: cleanId(l.id),
        title: cleanText(l.title, MAX.title),
        color: validColor(l.color),
        pinned: !!l.pinned,
        tidy: !!l.tidy,
        code: (typeof l.code === 'string' && /^[A-Z0-9]{4,10}$/.test(l.code)) ? l.code : null,
        shared: !!(l.shared && typeof l.code === 'string' && /^[A-Z0-9]{4,10}$/.test(l.code)),
        createdAt: Number.isFinite(l.createdAt) ? l.createdAt : Date.now(),
        updatedAt: Number.isFinite(l.updatedAt) ? l.updatedAt : Date.now(),
        items: l.items.slice(0, MAX.items)
          .filter(i => i && typeof i === 'object')
          .map(i => ({
            id: cleanId(i.id),
            text: cleanText(i.text, MAX.item),
            done: !!i.done,
            qty: (Number.isFinite(i.qty) && i.qty > 1) ? Math.min(999, Math.floor(i.qty)) : null,
            img: isImgData(i.img) ? i.img : null,
          }))
          .filter(i => i.text.length > 0 || i.img),   // keep image-only items
      })),
  };
  return out;
}
const readData = key => { try { return normalize(JSON.parse(localStorage.getItem(key))); } catch (e) { return null; } };
const writeData = (key, s) => { try { localStorage.setItem(key, JSON.stringify(s)); } catch (e) { } };

function load() {
  const s = readData(activeKey());
  if (s) return s;
  return session ? blank() : seed();      // accounts start empty; guest gets the demo
}
function save() {
  state.updatedAt = Date.now();
  writeData(activeKey(), state);
  schedulePush();                          // account cloud push (no-op unless signed into cloud)
  for (const l of state.lists) if (l.shared && l.code) schedulePushShared(l);   // collaborative lists
}

const mkItem = (text, done = false, qty = null, img = null) => ({ id: uid(), text: cleanText(text, MAX.item), done: !!done, qty: qty && qty > 1 ? Math.min(999, Math.floor(qty)) : null, img: isImgData(img) ? img : null });
function mkList(color) {
  return { id: uid(), title: '', color: color || nextColor(), items: [], pinned: false, tidy: false, createdAt: Date.now(), updatedAt: Date.now() };
}
function nextColor() { const c = PALETTE[state.nextColor % PALETTE.length].hex; state.nextColor++; return c; }
const getList = id => state.lists.find(l => l.id === id);
const touch = l => { l.updatedAt = Date.now(); };
function tidySort(l) { if (!l.tidy) return; const u = l.items.filter(i => !i.done), d = l.items.filter(i => i.done); l.items = [...u, ...d]; }

/* CRUD */
function createList() {
  if (state.lists.length >= MAX.lists) { toast('You have reached the list limit'); return state.lists[0]; }
  const l = mkList(); state.lists.unshift(l); bumpStat('created'); save(); checkBadges(); return l;
}
function deleteList(id) {
  const i = state.lists.findIndex(l => l.id === id); if (i < 0) return;
  const [removed] = state.lists.splice(i, 1); save();
  if (view.name === 'detail' && view.id === id) showHome(false); else renderHome();
  toast('List deleted', 'Undo', () => { state.lists.splice(i, 0, removed); save(); rerender(); });
}
function duplicateList(id) {
  const src = getList(id); if (!src) return;
  const copy = { ...src, id: uid(), pinned: false, title: src.title ? src.title + ' copy' : '', items: src.items.map(it => mkItem(it.text, it.done, it.qty)), createdAt: Date.now(), updatedAt: Date.now() };
  state.lists.unshift(copy); bumpStat('created'); save(); checkBadges(); showDetail(copy.id); toast('List duplicated');
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

/* ====================== 3c. Achievements (stats · badges · points) ======================
   Stats live inside `state` so they persist on the device and sync with the
   account. Points and badges are derived — no separate source of truth. */
const statsOf = () => (state && state.stats) || newStats();
function bumpStat(key, by = 1) {
  if (!state.stats) state.stats = newStats();
  state.stats[key] = (state.stats[key] || 0) + by;
}
const distinctColors = () => new Set((state.lists || []).map(l => l.color)).size;
const listIsComplete = l => l.items.length > 0 && l.items.every(i => i.done);
const listCount = () => (state.lists || []).length;
const sharedCount = () => (state.lists || []).filter(l => l.shared).length;
const maxListSize = () => (state.lists || []).reduce((m, l) => Math.max(m, (l.items || []).length), 0);

/* 50 badges across 7 categories. All values are derived (no extra source of
   truth) — `val` reads stats / live lists / level. `cat` groups them in the UI. */
const BADGE_CATS = [
  { id: 'create', label: 'Creating' }, { id: 'finish', label: 'Completing' },
  { id: 'check', label: 'Checking off' }, { id: 'colour', label: 'Colours' },
  { id: 'collab', label: 'Collaboration' }, { id: 'level', label: 'Levels' },
  { id: 'collect', label: 'Collecting' },
];
const BADGES = [
  // — Creating (lists created) —
  { id: 'cr1',  cat: 'create', icon: '🌱', name: 'First List',    desc: 'Create your first list', goal: 1,   val: s => s.created },
  { id: 'cr3',  cat: 'create', icon: '✏️', name: 'Getting Started',desc: 'Create 3 lists',        goal: 3,   val: s => s.created },
  { id: 'cr5',  cat: 'create', icon: '🗂️', name: 'Organiser',     desc: 'Create 5 lists',         goal: 5,   val: s => s.created },
  { id: 'cr10', cat: 'create', icon: '🧱', name: 'Builder',       desc: 'Create 10 lists',        goal: 10,  val: s => s.created },
  { id: 'cr15', cat: 'create', icon: '📚', name: 'Collector',     desc: 'Create 15 lists',        goal: 15,  val: s => s.created },
  { id: 'cr25', cat: 'create', icon: '🏗️', name: 'Architect',     desc: 'Create 25 lists',        goal: 25,  val: s => s.created },
  { id: 'cr40', cat: 'create', icon: '🏙️', name: 'Developer',     desc: 'Create 40 lists',        goal: 40,  val: s => s.created },
  { id: 'cr60', cat: 'create', icon: '🏛️', name: 'Master Planner',desc: 'Create 60 lists',        goal: 60,  val: s => s.created },
  { id: 'cr80', cat: 'create', icon: '🌆', name: 'Visionary',     desc: 'Create 80 lists',        goal: 80,  val: s => s.created },
  { id: 'cr120',cat: 'create', icon: '🌍', name: 'List Tycoon',   desc: 'Create 120 lists',       goal: 120, val: s => s.created },
  // — Completing (lists finished) —
  { id: 'fi1',  cat: 'finish', icon: '✅', name: 'Closer',        desc: 'Complete your first list', goal: 1,  val: s => s.completed },
  { id: 'fi3',  cat: 'finish', icon: '👍', name: 'Finisher',      desc: 'Complete 3 lists',       goal: 3,   val: s => s.completed },
  { id: 'fi5',  cat: 'finish', icon: '🔥', name: 'On a Roll',     desc: 'Complete 5 lists',       goal: 5,   val: s => s.completed },
  { id: 'fi10', cat: 'finish', icon: '⚡', name: 'Achiever',      desc: 'Complete 10 lists',      goal: 10,  val: s => s.completed },
  { id: 'fi20', cat: 'finish', icon: '🎯', name: 'Sharpshooter',  desc: 'Complete 20 lists',      goal: 20,  val: s => s.completed },
  { id: 'fi30', cat: 'finish', icon: '🏅', name: 'Champion',      desc: 'Complete 30 lists',      goal: 30,  val: s => s.completed },
  { id: 'fi50', cat: 'finish', icon: '🏆', name: 'Conqueror',     desc: 'Complete 50 lists',      goal: 50,  val: s => s.completed },
  { id: 'fi75', cat: 'finish', icon: '💪', name: 'Unstoppable',   desc: 'Complete 75 lists',      goal: 75,  val: s => s.completed },
  { id: 'fi100',cat: 'finish', icon: '👑', name: 'Legend',        desc: 'Complete 100 lists',     goal: 100, val: s => s.completed },
  { id: 'fi150',cat: 'finish', icon: '🦄', name: 'Mythic',        desc: 'Complete 150 lists',     goal: 150, val: s => s.completed },
  // — Checking off (items ticked) —
  { id: 'ch10', cat: 'check', icon: '☑️', name: 'Ticker',         desc: 'Check off 10 items',     goal: 10,  val: s => s.checked },
  { id: 'ch25', cat: 'check', icon: '✔️', name: 'Tidy',           desc: 'Check off 25 items',     goal: 25,  val: s => s.checked },
  { id: 'ch50', cat: 'check', icon: '🧹', name: 'Sweeper',        desc: 'Check off 50 items',     goal: 50,  val: s => s.checked },
  { id: 'ch100',cat: 'check', icon: '💯', name: 'Centurion',      desc: 'Check off 100 items',    goal: 100, val: s => s.checked },
  { id: 'ch200',cat: 'check', icon: '🚀', name: 'Productive',     desc: 'Check off 200 items',    goal: 200, val: s => s.checked },
  { id: 'ch300',cat: 'check', icon: '⭐', name: 'Star Checker',   desc: 'Check off 300 items',    goal: 300, val: s => s.checked },
  { id: 'ch500',cat: 'check', icon: '🌟', name: 'Power User',     desc: 'Check off 500 items',    goal: 500, val: s => s.checked },
  { id: 'ch750',cat: 'check', icon: '🔋', name: 'Machine',        desc: 'Check off 750 items',    goal: 750, val: s => s.checked },
  { id: 'ch1k', cat: 'check', icon: '🧠', name: 'Mastermind',     desc: 'Check off 1000 items',   goal: 1000,val: s => s.checked },
  { id: 'ch2k', cat: 'check', icon: '🛸', name: 'Legendary Doer', desc: 'Check off 2000 items',   goal: 2000,val: s => s.checked },
  // — Colours —
  { id: 'co2',  cat: 'colour', icon: '🎨', name: 'Two-Tone',      desc: 'Use 2 different colours',goal: 2,   val: () => distinctColors() },
  { id: 'co3',  cat: 'colour', icon: '🖌️', name: 'Colourful',     desc: 'Use 3 colours',          goal: 3,   val: () => distinctColors() },
  { id: 'co5',  cat: 'colour', icon: '🌸', name: 'Palette',       desc: 'Use 5 colours',          goal: 5,   val: () => distinctColors() },
  { id: 'co7',  cat: 'colour', icon: '🌷', name: 'Vivid',         desc: 'Use 7 colours',          goal: 7,   val: () => distinctColors() },
  { id: 'co10', cat: 'colour', icon: '🌈', name: 'Full Spectrum', desc: 'Use all 10 colours',     goal: 10,  val: () => distinctColors() },
  // — Collaboration (shared lists) —
  { id: 'cl1',  cat: 'collab', icon: '🔗', name: 'Sharer',        desc: 'Share a list with a code',goal: 1,  val: () => sharedCount() },
  { id: 'cl2',  cat: 'collab', icon: '🤝', name: 'Team Player',   desc: 'Have 2 shared lists',    goal: 2,   val: () => sharedCount() },
  { id: 'cl5',  cat: 'collab', icon: '👥', name: 'Collaborator',  desc: 'Have 5 shared lists',    goal: 5,   val: () => sharedCount() },
  // — Levels (points) —
  { id: 'lv2',  cat: 'level', icon: '🥉', name: 'Level 2',        desc: 'Reach level 2',          goal: 2,   val: () => levelOf() },
  { id: 'lv3',  cat: 'level', icon: '🥈', name: 'Level 3',        desc: 'Reach level 3',          goal: 3,   val: () => levelOf() },
  { id: 'lv5',  cat: 'level', icon: '🥇', name: 'Level 5',        desc: 'Reach level 5',          goal: 5,   val: () => levelOf() },
  { id: 'lv8',  cat: 'level', icon: '🎖️', name: 'Level 8',        desc: 'Reach level 8',          goal: 8,   val: () => levelOf() },
  { id: 'lv12', cat: 'level', icon: '🏵️', name: 'Level 12',       desc: 'Reach level 12',         goal: 12,  val: () => levelOf() },
  { id: 'lv16', cat: 'level', icon: '💠', name: 'Level 16',       desc: 'Reach level 16',         goal: 16,  val: () => levelOf() },
  { id: 'lv20', cat: 'level', icon: '🔱', name: 'Level 20',       desc: 'Reach level 20',         goal: 20,  val: () => levelOf() },
  // — Collecting (lists at once / big lists) —
  { id: 'ct5',  cat: 'collect', icon: '📦', name: 'Stocked',      desc: 'Have 5 lists at once',   goal: 5,   val: () => listCount() },
  { id: 'ct10', cat: 'collect', icon: '🗄️', name: 'Library',      desc: 'Have 10 lists at once',  goal: 10,  val: () => listCount() },
  { id: 'ct25', cat: 'collect', icon: '🏪', name: 'Warehouse',    desc: 'Have 25 lists at once',  goal: 25,  val: () => listCount() },
  { id: 'bg20', cat: 'collect', icon: '📜', name: 'Long List',    desc: 'A list with 20+ items',  goal: 20,  val: () => maxListSize() },
  { id: 'bg50', cat: 'collect', icon: '📃', name: 'Epic List',    desc: 'A list with 50+ items',  goal: 50,  val: () => maxListSize() },
];
const badgeValue = b => Math.min(b.val(statsOf()), b.goal);
const badgeEarned = b => b.val(statsOf()) >= b.goal;
const earnedCount = () => BADGES.filter(badgeEarned).length;
function points() { const s = statsOf(); return (s.completed || 0) * 15 + (s.created || 0) * 3 + (s.checked || 0); }
function levelOf(p = points()) { return Math.floor(Math.sqrt(p / 25)) + 1; }   // gentle curve: 1,2,3 at 0/25/100/225…

/* Celebrate a badge the first time it is earned (per session). Snapshot the
   already-earned set at load so reopening the app doesn't re-toast. */
let seenBadges = null;
function snapshotBadges() { seenBadges = new Set(BADGES.filter(badgeEarned).map(b => b.id)); }
function checkBadges() {
  if (!seenBadges) { snapshotBadges(); schedulePublishRank(); return; }
  for (const b of BADGES) {
    if (badgeEarned(b) && !seenBadges.has(b.id)) {
      seenBadges.add(b.id);
      buzz(18);
      toast(`${b.icon} Badge unlocked — ${b.name}`, 'View', () => { achvTab = 'badges'; openAchievementsSheet(); });
    }
  }
  schedulePublishRank();
}

/* ====================== 3b. Accounts & Sync ======================
   Security: the browser only ever holds the PUBLIC Firebase config
   (config.js) — never a private/service key. Device-local account
   passwords are PBKDF2-hashed via Web Crypto (never stored in clear);
   cloud passwords are handled entirely by Firebase Auth over HTTPS.
   Cloud data lives at users/{uid}, locked to that uid by Firestore
   rules (see SECURITY.md).
   ================================================================ */
const CFG = (window.QUICKLIST_CONFIG || {});
const CLOUD_ENABLED = !!(CFG.firebase && CFG.firebase.apiKey);
let cloud = null, cloudUnsub = null, pushTimer = null, authMode = 'signin', authBusy = false;

const loadSession = () => { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { return null; } };
const saveSession = s => { try { s ? localStorage.setItem(SESSION_KEY, JSON.stringify(s)) : localStorage.removeItem(SESSION_KEY); } catch (e) { } };
const initials = s => { const n = (s.username || s.email || 'You').trim(); const p = n.split(/[\s@._-]+/).filter(Boolean); return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '·'; };

/* ---- device-local accounts (Web Crypto PBKDF2) ---- */
const bytesToHex = b => [...b].map(x => x.toString(16).padStart(2, '0')).join('');
const hexToBytes = h => new Uint8Array(h.match(/.{2}/g).map(x => parseInt(x, 16)));
async function pbkdf2(password, saltHex) {
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, km, 256);
  return { salt: bytesToHex(salt), hash: bytesToHex(new Uint8Array(bits)) };
}
const readAccounts = () => { try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY)) || {}; } catch (e) { return {}; } };
const writeAccounts = a => { try { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(a)); } catch (e) { } };
const matchUser = (a, id) => !!id && (norm(a.username) === norm(id) || (!!a.email && norm(a.email) === norm(id)));

async function localSignUp({ username, email, password }) {
  username = cleanText(username, MAX.user); email = cleanText(email, MAX.email);
  password = String(password || '');
  if (username.length < 2) throw new Error('Pick a username (at least 2 characters)');
  if (password.length < 6) throw new Error('Password needs at least 6 characters');
  if (password.length > MAX.pw) throw new Error('Password is too long');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('That email address looks wrong');
  const accts = readAccounts();
  if (Object.values(accts).some(a => matchUser(a, username) || (email && matchUser(a, email)))) throw new Error('That username or email is already taken');
  const { salt, hash } = await pbkdf2(password);
  const u = { uid: 'local_' + uid(), username, email, salt, hash, createdAt: Date.now() };
  accts[u.uid] = u; writeAccounts(accts);
  return { uid: u.uid, username, email, provider: 'local' };
}
async function localSignIn({ id, password }) {
  const a = Object.values(readAccounts()).find(x => matchUser(x, id));
  if (!a) throw new Error('No account found with that username or email');
  const { hash } = await pbkdf2(password || '', a.salt);
  if (hash !== a.hash) throw new Error('Wrong password — try again');
  return { uid: a.uid, username: a.username, email: a.email, provider: 'local' };
}

/* ---- cloud (Firebase, loaded only when configured) ---- */
const FB = 'https://www.gstatic.com/firebasejs/10.12.5/';
async function ensureCloud() {
  if (cloud) return cloud;
  if (!CLOUD_ENABLED) throw new Error('Cloud sync is not set up yet');
  const [app, authm, fs] = await Promise.all([
    import(FB + 'firebase-app.js'), import(FB + 'firebase-auth.js'), import(FB + 'firebase-firestore.js'),
  ]);
  const fbApp = app.initializeApp(CFG.firebase);
  cloud = { authm, fs, auth: authm.getAuth(fbApp), db: fs.getFirestore(fbApp) };
  // Handle redirect result after Google sign-in on mobile
  try {
    const result = await authm.getRedirectResult(cloud.auth);
    if (result && result.user) {
      const u = result.user;
      await activateSession({ uid: u.uid, email: u.email || '', username: u.displayName || (u.email || 'You').split('@')[0], provider: 'cloud' }, { adoptGuest: true });
    }
  } catch (e) { /* ignore */ }
  return cloud;
}
async function cloudPull(uid) {
  const c = await ensureCloud();
  const snap = await c.fs.getDoc(c.fs.doc(c.db, 'users', uid));
  return snap.exists() ? normalize(snap.data()) : null;
}
function schedulePush() {
  if (!session || session.provider !== 'cloud') return;
  clearTimeout(pushTimer); pushTimer = setTimeout(cloudPush, 1200);
}
async function cloudPush() {
  if (!session || session.provider !== 'cloud') return;
  try { const c = await ensureCloud(); await c.fs.setDoc(c.fs.doc(c.db, 'users', session.uid), JSON.parse(JSON.stringify(state))); }
  catch (e) { /* offline — kept in local cache, retried on next change */ }
}

/* ====================== 3d. Collaborative lists (share by code) ======================
   Anyone can share a list (gets a random code); others join with that code — NO
   account needed. Each shared list is mirrored to Firestore at shared/{code} and
   synced live both ways (last-write-wins at list level). Access uses Firebase
   ANONYMOUS auth so the rules can still require a token. One-time Firebase setup:
   enable Anonymous sign-in, and add the rule:
     match /shared/{code} { allow read, write: if request.auth != null; }
   (see SETUP-ACCOUNTS.md). Degrades gracefully with a clear message if absent. */
const sharedUnsubs = {};        // code -> firestore unsubscribe
const sharedPushTimers = {};    // code -> debounce timer
const SHARE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // no ambiguous 0/O/1/I/L
function genCode(n = 6) { let s = ''; const a = crypto.getRandomValues(new Uint8Array(n)); for (let i = 0; i < n; i++) s += SHARE_ALPHABET[a[i] % SHARE_ALPHABET.length]; return s; }
const cleanCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);

/* Ensure a Firebase auth token (the account, or an invisible anonymous one) so
   shared docs are reachable. The anon user is NEVER promoted to an account
   session (see the isAnonymous guard in initAuth). */
async function ensureAuthToken() {
  const c = await ensureCloud();
  if (!c.auth.currentUser) await c.authm.signInAnonymously(c.auth);
  return c;
}
const normRemoteList = rl => { const s = normalize({ lists: [rl] }); return s && s.lists[0]; };
const sharePayload = l => ({ code: l.code, title: l.title || '', color: l.color, items: JSON.parse(JSON.stringify(l.items || [])), updatedAt: l.updatedAt || Date.now() });

async function pushSharedNow(l) {
  if (!CLOUD_ENABLED || !l || !l.shared || !l.code) return;
  try { const c = await ensureAuthToken(); await c.fs.setDoc(c.fs.doc(c.db, 'shared', l.code), sharePayload(l)); }
  catch (e) { /* offline / not set up — retried on next change */ }
}
function schedulePushShared(l) {
  if (!CLOUD_ENABLED || !l || !l.shared || !l.code) return;
  clearTimeout(sharedPushTimers[l.code]);
  sharedPushTimers[l.code] = setTimeout(() => pushSharedNow(l), 900);
}
function subscribeShared(l) {
  if (!CLOUD_ENABLED || !l || !l.code || sharedUnsubs[l.code]) return;
  const code = l.code, localId = l.id;
  ensureAuthToken().then(c => {
    if (sharedUnsubs[code]) return;
    sharedUnsubs[code] = c.fs.onSnapshot(c.fs.doc(c.db, 'shared', code), snap => {
      if (!snap.exists() || snap.metadata.hasPendingWrites) return;   // ignore our own optimistic writes
      const remote = snap.data(); const rl = remote && normRemoteList(remote);
      if (!rl) return;
      const local = state.lists.find(x => x.id === localId || x.code === code);
      if (!local) return;
      if ((remote.updatedAt || 0) <= (local.updatedAt || 0)) return;  // ours is newer/equal
      local.title = rl.title; local.color = rl.color; local.items = rl.items; local.updatedAt = remote.updatedAt;
      writeData(activeKey(), state);   // persist WITHOUT re-pushing
      if (view.name === 'detail' && view.id === local.id) { if (!editingNow()) { noAnim = true; renderDetail(); } }
      else if (view.name === 'home') renderHome();
    }, () => { });
  }).catch(() => { });
}
function unsubscribeShared(code) { if (sharedUnsubs[code]) { try { sharedUnsubs[code](); } catch (e) { } delete sharedUnsubs[code]; } }
function resubscribeAllShared() { if (!CLOUD_ENABLED) return; for (const l of (state.lists || [])) if (l.shared && l.code) subscribeShared(l); }

/* Map Firebase failures to a message that tells the user exactly what to fix
   (the two one-time setup steps), instead of a vague "try again". */
function shareErrMsg(e) {
  const code = (e && e.code) || '';
  if (/operation-not-allowed/.test(code)) return 'Turn on "Anonymous" sign-in in your Firebase console, then retry.';
  if (/permission-denied|insufficient/.test(code)) return 'Deploy the Firestore rules first (firestore.rules), then retry.';
  if (/network|unavailable|failed/.test(code)) return 'Network problem — check your connection and try again.';
  return (e && !e.code && e.message) || 'Something went wrong — try again.';
}
async function createShare(id) {
  const l = getList(id); if (!l) return;
  if (l.shared && l.code) return openShareSheet(l);
  if (!CLOUD_ENABLED) { toast('Cloud sharing is not set up yet'); return; }
  toast('Creating share link…');
  try {
    const c = await ensureAuthToken();
    const code = genCode();
    // Write FIRST and await it: if the rules aren't deployed or anon auth is off,
    // this throws and we surface the reason — we never show a code that doesn't work.
    await c.fs.setDoc(c.fs.doc(c.db, 'shared', code), sharePayload({ ...l, code, shared: true }));
    l.code = code; l.shared = true; touch(l); save();
    subscribeShared(l); checkBadges();
    openShareSheet(l);
  } catch (e) { toast(shareErrMsg(e)); }
}
function stopSharing(id) {
  const l = getList(id); if (!l) return;
  const code = l.code; l.shared = false; l.code = null; touch(l); save();
  if (code) unsubscribeShared(code);
  closeSheet(); rerender(); toast('Stopped syncing — this copy is now private');
}
async function joinByCode(raw) {
  const code = cleanCode(raw);
  if (code.length < 4) throw new Error('Enter the full code');
  if (!CLOUD_ENABLED) throw new Error('Cloud sharing is not set up yet');
  const existing = state.lists.find(x => x.code === code);
  if (existing) { subscribeShared(existing); return existing; }
  const c = await ensureAuthToken();
  const snap = await c.fs.getDoc(c.fs.doc(c.db, 'shared', code));
  if (!snap.exists()) throw new Error('No list found with that code');
  const rl = normRemoteList(snap.data());
  const l = mkList(rl ? rl.color : undefined);
  l.title = rl ? rl.title : ''; l.items = rl ? rl.items : []; l.code = code; l.shared = true;
  l.updatedAt = snap.data().updatedAt || Date.now();
  state.lists.unshift(l); save(); subscribeShared(l); checkBadges();
  return l;
}

/* ---- registration database: a profile record per signed-up user ----
   Lives at profiles/{uid}, separate from the list data at users/{uid}, so
   it survives every data push. Holds only identity + timestamps (no list
   content). createdAt is written once; lastLoginAt updates every sign-in. */
async function writeProfile(user) {
  if (!CLOUD_ENABLED || !user || user.provider !== 'cloud') return;
  try {
    const c = await ensureCloud();
    const ref = c.fs.doc(c.db, 'profiles', user.uid);
    let exists = false;
    try { exists = (await c.fs.getDoc(ref)).exists(); } catch (e) { }
    const rec = {
      uid: user.uid,
      email: cleanText(user.email || '', MAX.email),
      displayName: cleanText(user.username || '', MAX.user),
      provider: user.provider,
      lastLoginAt: Date.now(),
    };
    if (!exists) rec.createdAt = Date.now();
    await c.fs.setDoc(ref, rec, { merge: true });
  } catch (e) { /* profile is best-effort; never block sign-in on it */ }
}

/* ---- global ranking (opt-in) ----
   Publishes only a display name + score to leaderboard/{uid}. No email, no
   list content. Controlled by the Settings → "Show me on the ranking" toggle. */
let rankTimer = null;
function schedulePublishRank() {
  if (!session || session.provider !== 'cloud' || !settings.leaderboard) return;
  clearTimeout(rankTimer); rankTimer = setTimeout(publishLeaderboard, 1500);
}
async function publishLeaderboard() {
  if (!session || session.provider !== 'cloud' || !settings.leaderboard) return;
  try {
    const c = await ensureCloud();
    await c.fs.setDoc(c.fs.doc(c.db, 'leaderboard', session.uid), {
      uid: session.uid,
      name: cleanText(session.username || 'Anonymous', MAX.user) || 'Anonymous',
      points: points(),
      completed: statsOf().completed || 0,
      badges: earnedCount(),
      updatedAt: Date.now(),
    });
  } catch (e) { /* offline — retried on next change */ }
}
async function removeFromLeaderboard() {
  if (!CLOUD_ENABLED || !session || session.provider !== 'cloud') return;
  try { const c = await ensureCloud(); await c.fs.deleteDoc(c.fs.doc(c.db, 'leaderboard', session.uid)); } catch (e) { }
}
async function fetchLeaderboard(max = 100) {
  const c = await ensureCloud();
  const q = c.fs.query(c.fs.collection(c.db, 'leaderboard'), c.fs.orderBy('points', 'desc'), c.fs.limit(max));
  const snap = await c.fs.getDocs(q);
  const rows = []; snap.forEach(d => { const v = d.data(); if (v && Number.isFinite(v.points)) rows.push(v); });
  return rows;
}
function editingNow() {
  const a = document.activeElement;
  return a && (a.id === 'detail-title' || a.classList.contains('item-edit') || a.id === 'add-input' || a.id === 'home-search');
}
function cloudSubscribe() {
  if (!session || session.provider !== 'cloud') return;
  ensureCloud().then(c => {
    if (cloudUnsub) cloudUnsub();
    cloudUnsub = c.fs.onSnapshot(c.fs.doc(c.db, 'users', session.uid), snap => {
      if (!snap.exists() || snap.metadata.hasPendingWrites) return;   // ignore our own optimistic writes
      const remote = normalize(snap.data());
      if (!remote) return;
      // MERGE (never drop the list you're working on) instead of replacing wholesale
      const merged = mergeStates(remote, state);
      if (JSON.stringify(merged.lists) === JSON.stringify(state.lists)) return; // nothing actually changed
      state = merged; writeData(activeKey(), state);
      // re-render in place; a background sync must NEVER navigate you away or interrupt typing
      if (!sheetOpen() && !editingNow()) rerender();
    }, () => { });
  }).catch(() => { });
}

/* ---- merge (list-level last-write-wins) + session activation ---- */
function mergeStates(primary, secondary) {
  const a = primary || blank(), b = secondary || { lists: [] };
  const map = new Map();
  for (const l of [...(a.lists || []), ...(b.lists || [])]) {
    const ex = map.get(l.id);
    if (!ex || (l.updatedAt || 0) > (ex.updatedAt || 0)) map.set(l.id, l);
  }
  // Achievement counters are cumulative and monotonic — take the max across
  // devices so progress (points/badges) is never lost or double-counted on sync.
  const sa = normStats(a.stats), sb = normStats(b.stats);
  const stats = {
    created: Math.max(sa.created, sb.created),
    completed: Math.max(sa.completed, sb.completed),
    checked: Math.max(sa.checked, sb.checked),
    since: Math.min(sa.since, sb.since),
  };
  return {
    ...a,
    lists: [...map.values()].sort((x, y) => (y.updatedAt || 0) - (x.updatedAt || 0)),
    stats,
    nextColor: Math.max(a.nextColor || 0, b.nextColor || 0),
    updatedAt: Date.now(),
  };
}
async function activateSession(user, { adoptGuest = false } = {}) {
  session = user; saveSession(session);
  let base = readData(activeKey());                  // this account's cache on this device
  if (user.provider === 'cloud') {
    try { base = mergeStates(await cloudPull(user.uid), base); } catch (e) { }
  }
  if (!base) base = blank();
  if (adoptGuest) {                                  // bring the work you did as a guest into a fresh account
    const guest = readData(KEY);
    if (guest && guest.lists.length && base.lists.length === 0) base = mergeStates(base, guest);
  }
  state = normalize(base) || blank();
  writeData(activeKey(), state);
  snapshotBadges();                                  // baseline for this account (no false "unlocked" toasts)
  if (user.provider === 'cloud') { cloudPush(); cloudSubscribe(); writeProfile(user); schedulePublishRank(); }
  refreshAccountUI();
}
function endSession() {
  if (cloudUnsub) { cloudUnsub(); cloudUnsub = null; }
  if (cloud && cloud.auth && cloud.auth.currentUser) cloud.authm.signOut(cloud.auth).catch(() => { });
  session = null; saveSession(null);
  state = load(); snapshotBadges(); refreshAccountUI();
}

/* ---- auth actions invoked by the UI ---- */
async function doGoogle() {
  const c = await ensureCloud();
  const provider = new c.authm.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  // Use browserPopupRedirectResolver explicitly so the popup works inside TWA
  // (Android Chrome Custom Tab) without falling back to a full-page redirect.
  // signInWithRedirect is intentionally avoided: TWA environments don't preserve
  // sessionStorage across redirects, causing "missing initial state" errors.
  const resolver = c.authm.browserPopupRedirectResolver;
  try {
    const res = await c.authm.signInWithPopup(c.auth, provider, resolver);
    const u = res.user;
    await activateSession({ uid: u.uid, email: u.email || '', username: u.displayName || (u.email || 'You').split('@')[0], provider: 'cloud' }, { adoptGuest: true });
  } catch (e) {
    const code = (e && e.code) || '';
    // If popup is blocked in a strict environment, guide the user to email/password
    if (/popup-blocked|operation-not-supported-in-this-environment|web-storage-unsupported/i.test(code)) {
      throw new Error('Google sign-in popup was blocked. Please use email/password instead.');
    }
    throw e;   // popup-closed-by-user, network, etc. → surface a real message
  }
}
async function doEmailAuth(mode, f) {
  if (CLOUD_ENABLED) {
    const c = await ensureCloud();
    if (mode === 'signup') {
      const cred = await c.authm.createUserWithEmailAndPassword(c.auth, f.email, f.password);
      if (f.username) { try { await c.authm.updateProfile(cred.user, { displayName: f.username }); } catch (e) { } }
      await activateSession({ uid: cred.user.uid, email: f.email, username: f.username || f.email.split('@')[0], provider: 'cloud' }, { adoptGuest: true });
    } else {
      const cred = await c.authm.signInWithEmailAndPassword(c.auth, f.id, f.password);
      const u = cred.user;
      await activateSession({ uid: u.uid, email: u.email || '', username: u.displayName || (u.email || 'You').split('@')[0], provider: 'cloud' });
    }
  } else {
    const user = mode === 'signup' ? await localSignUp(f) : await localSignIn(f);
    await activateSession(user, { adoptGuest: mode === 'signup' });
  }
}

/* ---- login rate limiting: max 5 failed attempts per 50 minutes ----
   Client-side throttle (Firebase Auth also rate-limits server-side). */
const RL_KEY = 'quicklist.rl', RL_MAX = 5, RL_WINDOW = 50 * 60 * 1000;
function rlFails() {
  let f; try { f = JSON.parse(localStorage.getItem(RL_KEY)) || []; } catch (e) { f = []; }
  const now = Date.now(); f = (Array.isArray(f) ? f : []).filter(t => now - t < RL_WINDOW);
  try { localStorage.setItem(RL_KEY, JSON.stringify(f)); } catch (e) { }
  return f;
}
function rlBlocked() {
  const f = rlFails();
  if (f.length < RL_MAX) return 0;
  return Math.max(0, RL_WINDOW - (Date.now() - f[0]));   // ms until the oldest attempt expires
}
function rlRecordFail() { const f = rlFails(); f.push(Date.now()); try { localStorage.setItem(RL_KEY, JSON.stringify(f)); } catch (e) { } }
function rlReset() { try { localStorage.removeItem(RL_KEY); } catch (e) { } }
function rlMessage(ms) { const m = Math.ceil(ms / 60000); return `Too many sign-in attempts. Try again in ${m} minute${m === 1 ? '' : 's'}.`; }

/* ---- account deletion (right to be forgotten) ---- */
async function deleteAccount() {
  const cur = session; if (!cur) return;
  try {
    if (cur.provider === 'cloud') {
      const c = await ensureCloud();
      try { await c.fs.deleteDoc(c.fs.doc(c.db, 'users', cur.uid)); } catch (e) { }        // list data
      try { await c.fs.deleteDoc(c.fs.doc(c.db, 'profiles', cur.uid)); } catch (e) { }     // registration record
      try { await c.fs.deleteDoc(c.fs.doc(c.db, 'leaderboard', cur.uid)); } catch (e) { }  // ranking entry
      if (c.auth.currentUser) await c.authm.deleteUser(c.auth.currentUser);                // the auth identity
    } else {
      const accts = readAccounts(); delete accts[cur.uid]; writeAccounts(accts);
    }
    if (cloudUnsub) { cloudUnsub(); cloudUnsub = null; }
    try { localStorage.removeItem(dataKeyFor(cur.uid)); } catch (e) { }                // wipe local copy
    session = null; saveSession(null);
    state = load(); refreshAccountUI(); closeSheet(); showHome(false);
    toast('Account deleted');
  } catch (e) {
    if (e && e.code === 'auth/requires-recent-login') {
      closeSheet(); endSession(); showHome(false);
      toast('Please sign in again, then delete your account');
    } else toast('Could not delete account — try again');
  }
}

/* ---- account UI ---- */
function refreshAccountUI() {
  const a = $('#avatar'); if (!a) return;
  if (session) { a.textContent = initials(session); a.classList.add('signed'); }
  else { a.innerHTML = I.person; a.classList.remove('signed'); }
}
function openAccountSheet() {
  if (session) return openProfileSheet();
  const signup = authMode === 'signup';
  openSheet(`
    <h2 class="sheet-title">${signup ? 'Create your account' : 'Welcome back'}</h2>
    <p class="sheet-sub">${CLOUD_ENABLED ? 'Save your lists and pick up where you left off on any device.' : 'Keep your lists behind a login on this device. Add cloud config for cross-device sync.'}</p>
    ${!window.Capacitor ? `<button class="btn-google" data-auth="google">${GOOGLE_G}<span>Continue with Google</span></button><div class="auth-or"><span>or</span></div>` : ''}
    <form id="auth-form" class="auth-form" autocomplete="on">
      ${signup ? `<input class="field" name="username" placeholder="Username" autocomplete="username" required>` : ''}
      <input class="field" name="id" type="${signup ? 'email' : 'text'}" placeholder="${signup ? 'Email' : (CLOUD_ENABLED ? 'Email' : 'Email or username')}" autocomplete="${signup ? 'email' : 'username'}" ${signup && CLOUD_ENABLED ? 'required' : ''} ${signup ? 'inputmode="email"' : ''}>
      <input class="field" name="password" type="password" placeholder="Password" autocomplete="${signup ? 'new-password' : 'current-password'}" required>
      <p class="auth-error" id="auth-error" role="alert"></p>
      <button class="btn btn-c btn-block" type="submit" id="auth-submit">${signup ? 'Create account' : 'Sign in'}</button>
    </form>
    <div class="auth-links">
      <button class="link" data-auth="toggle">${signup ? 'Have an account? Sign in' : 'New here? Create an account'}</button>
      ${signup ? '' : `<button class="link" data-auth="forgot">Forgot password?</button>`}
    </div>
    <button class="btn btn-ghost btn-block" data-auth="guest">Continue without an account</button>
    <p class="auth-foot">${I.shield}<span>Passwords are ${CLOUD_ENABLED ? 'handled by Google Firebase' : 'hashed on your device (PBKDF2)'} — never stored in plain text.</span></p>
  `);
}
function openProfileSheet() {
  const isCloud = session.provider === 'cloud';
  openSheet(`
    <div class="acct-head"><span class="acct-avatar">${esc(initials(session))}</span>
      <div class="acct-id"><div class="acct-name">${esc(session.username || 'You')}</div>${session.email ? `<div class="acct-mail">${esc(session.email)}</div>` : ''}</div></div>
    <div class="sync-badge ${isCloud ? 'on' : ''}">${isCloud ? I.cloudOn + '<span>Synced across your devices</span>' : I.device + '<span>Saved on this device</span>'}</div>
    <div class="menu-list">
      ${isCloud ? `<button class="menu-item" data-auth="sync">${I.refresh} Sync now</button>` : ''}
      <button class="menu-item" data-auth="signout">${I.signout} Sign out</button>
      <div class="menu-sep"></div>
      <button class="menu-item danger" data-auth="delete-account">${I.trash} Delete account</button>
    </div>
    ${!isCloud && CLOUD_ENABLED ? `<p class="auth-foot">${I.shield}<span>This account is on this device only. Sign in with Google or a cloud email account for cross-device sync.</span></p>` : ''}
  `);
}
/* ---- Settings ---- */
function openSettingsSheet() {
  const t = settings.theme;
  const opt = (val, icon, label) => `<button class="seg-btn ${t === val ? 'on' : ''}" data-set-theme="${val}">${icon}<span>${label}</span></button>`;
  openSheet(`
    <h2 class="sheet-title">Settings</h2>
    <p class="sheet-sub">Personalise QuickList on this device.</p>
    <p class="field-label">Appearance</p>
    <div class="seg seg-theme">
      ${opt('system', I.monitor, 'System')}
      ${opt('light', I.sun, 'Light')}
      ${opt('dark', I.moon, 'Dark')}
    </div>
    <div class="set-list">
      <div class="set-row">
        <div class="set-label"><div class="set-title">Haptic feedback</div><div class="set-desc">Subtle vibrations on taps and actions.</div></div>
        <button class="toggle ${settings.haptics ? 'on' : ''}" data-auth="toggle-haptics" role="switch" aria-checked="${settings.haptics}" aria-label="Haptic feedback"></button>
      </div>
      <div class="set-row">
        <div class="set-label"><div class="set-title">Show me on the global ranking</div><div class="set-desc">Shares only your display name and score — never your email or list contents.${CLOUD_ENABLED ? '' : ' Needs an account with cloud sync.'}</div></div>
        <button class="toggle ${settings.leaderboard ? 'on' : ''}" data-auth="toggle-leaderboard" role="switch" aria-checked="${settings.leaderboard}" aria-label="Show me on the global ranking"></button>
      </div>
    </div>
    <button class="btn btn-ghost btn-block" style="margin-top:14px" data-auth="close">${I.check}<span>Done</span></button>
    <p class="auth-foot">${I.shield}<span>Settings stay on this device and are never uploaded.</span></p>
  `);
}

/* ---- Achievements (its own full-height screen: Badges + Ranking) ---- */
let achvTab = 'badges';
function badgeCardHTML(b) {
  const earned = badgeEarned(b);
  const pct = Math.round(badgeValue(b) / b.goal * 100);
  return `<div class="badge-card ${earned ? 'earned' : 'locked'}">
    ${earned ? `<span class="badge-check">${I.check}</span>` : ''}
    <span class="badge-ic">${b.icon}</span>
    <span class="badge-name">${esc(b.name)}</span>
    <span class="badge-desc">${esc(b.desc)}</span>
    ${earned ? '' : `<span class="badge-prog"><i style="width:${pct}%"></i></span>`}
  </div>`;
}
function badgesHTML() {
  // Grouped by category with a small section header + per-section earned count.
  return BADGE_CATS.map(cat => {
    const items = BADGES.filter(b => b.cat === cat.id);
    if (!items.length) return '';
    const got = items.filter(badgeEarned).length;
    return `<div class="badge-cat">
      <div class="badge-cat-head"><span>${esc(cat.label)}</span><span class="badge-cat-count">${got}/${items.length}</span></div>
      <div class="badge-grid">${items.map(badgeCardHTML).join('')}</div>
    </div>`;
  }).join('');
}
function rankingHTML() {
  if (!CLOUD_ENABLED || !session || session.provider !== 'cloud') {
    return `<div class="rank-empty">${session
      ? 'This account is saved on this device only.<br>Sign in with Google or a cloud email account to join the global ranking.'
      : 'Sign in to climb the leaderboard and compete with QuickList players everywhere.'}<br><br>
      <button class="btn btn-c" style="--c:#5A63E0;--on:#fff" data-auth="go-signin">${session ? 'Manage account' : 'Sign in to compete'}</button></div>`;
  }
  return `${settings.leaderboard ? '' : `<p class="rank-empty" style="padding:6px 10px 14px">You're hidden from the ranking — turn it on in Settings.</p>`}
    <div class="rank-list" id="rank-list"><div class="rank-empty">Loading the leaderboard…</div></div>`;
}
function fillRanking() {
  if (!CLOUD_ENABLED || !session || session.provider !== 'cloud') return;
  fetchLeaderboard(100).then(rows => {
    const el = $('#rank-list'); if (!el) return;
    const medals = ['🥇', '🥈', '🥉'];
    if (!rows.length) { el.innerHTML = `<div class="rank-empty">No one's on the board yet — be the first!<br>Your points: <b>${points().toLocaleString()}</b></div>`; return; }
    el.innerHTML = rows.map((r, i) => {
      const me = r.uid === session.uid, rank = i + 1;
      const av = (cleanText(r.name || '?', MAX.user).trim()[0] || '?').toUpperCase();
      return `<div class="rank-row ${me ? 'me' : ''}">
        <span class="rank-num ${rank <= 3 ? 'top' : ''}">${rank <= 3 ? medals[rank - 1] : rank}</span>
        <span class="rank-av">${esc(av)}</span>
        <span class="rank-id"><div class="rank-name">${esc(r.name || 'Anonymous')}${me ? ' · you' : ''}</div><div class="rank-sub">${(r.badges || 0)} badges · ${(r.completed || 0)} completed</div></span>
        <span class="rank-pts">${(r.points || 0).toLocaleString()}</span>
      </div>`;
    }).join('');
  }).catch(() => { const el = $('#rank-list'); if (el) el.innerHTML = `<div class="rank-empty">Couldn't load the ranking right now — check your connection and try again.</div>`; });
}
function openAchievementsSheet() {
  const tab = achvTab;
  openSheet(`
    <div class="achv-head">
      <div class="stat-points"><b>${points().toLocaleString()}</b><span>points</span><span class="stat-level">Level ${levelOf()}</span></div>
      <p class="achv-sub">${earnedCount()} of ${BADGES.length} badges unlocked</p>
    </div>
    <div class="seg seg-ico">
      <button class="seg-btn ${tab === 'badges' ? 'on' : ''}" data-achv-tab="badges">${I.medal}<span>Badges</span></button>
      <button class="seg-btn ${tab === 'ranking' ? 'on' : ''}" data-achv-tab="ranking">${I.trophy}<span>Ranking</span></button>
    </div>
    <div id="achv-body">${tab === 'badges' ? badgesHTML() : rankingHTML()}</div>
  `, { tall: true });
  if (tab === 'ranking') fillRanking();
}
function setAchvTab(tab) {
  achvTab = tab;
  const body = $('#achv-body'); if (!body) return;
  body.innerHTML = tab === 'badges' ? badgesHTML() : rankingHTML();
  [...document.querySelectorAll('[data-achv-tab]')].forEach(b => b.classList.toggle('on', b.dataset.achvTab === tab));
  if (tab === 'ranking') fillRanking();
}

async function handleAuth(kind) {
  if (kind === 'toggle') { authMode = authMode === 'signin' ? 'signup' : 'signin'; return openAccountSheet(); }
  if (kind === 'close') return closeSheet();
  if (kind === 'go-signin') { authMode = 'signin'; return openAccountSheet(); }
  if (kind === 'toggle-haptics') { settings.haptics = !settings.haptics; saveSettings(); buzz(12); return openSettingsSheet(); }
  if (kind === 'toggle-leaderboard') {
    settings.leaderboard = !settings.leaderboard; saveSettings();
    if (settings.leaderboard) { publishLeaderboard(); toast('You\'re on the ranking'); }
    else { removeFromLeaderboard(); toast('Hidden from the ranking'); }
    return openSettingsSheet();
  }
  if (kind === 'guest') { closeSheet(); return; }
  if (kind === 'signout') { closeSheet(); endSession(); showHome(false); toast('Signed out'); return; }
  if (kind === 'sync') {
    try { const r = await cloudPull(session.uid); if (r) { state = mergeStates(r, state); writeData(activeKey(), state); cloudPush(); rerender(); } toast('Synced'); }
    catch (e) { toast('Could not sync right now'); }
    return;
  }
  if (kind === 'forgot') {
    if (!CLOUD_ENABLED) { setAuthError('Password reset needs cloud sync. For a device account, create a new one.'); return; }
    openSheet(`
      <h2 class="sheet-title">Reset password</h2>
      <p class="sheet-sub">Enter your email and we'll send you a reset link.</p>
      <form id="reset-form" class="auth-form">
        <input class="field" name="email" type="email" placeholder="Your email" autocomplete="email" inputmode="email" required>
        <p class="auth-error" id="reset-error" role="alert"></p>
        <button class="btn btn-c btn-block" type="submit" id="reset-submit">Send reset link</button>
      </form>
      <button class="btn btn-ghost btn-block" style="margin-top:8px" data-auth="back-to-signin">Back to sign in</button>
    `);
    return;
  }
  if (kind === 'back-to-signin') { authMode = 'signin'; openAccountSheet(); return; }
  if (kind === 'google') {
    if (!CLOUD_ENABLED) { setAuthError('Google sign-in needs cloud setup (one-time). You can still use a device account below.'); return; }
    const blk = rlBlocked(); if (blk) { setAuthError(rlMessage(blk)); return; }
    setAuthBusy(true);
    try { await doGoogle(); rlReset(); closeSheet(); showHome(false); toast('Signed in with Google'); }
    catch (e) { rlRecordFail(); setAuthError(humanAuthError(e)); }
    setAuthBusy(false);
  }
  if (kind === 'delete-account') {
    return openSheet(`
      <h2 class="sheet-title">Delete account?</h2>
      <p class="sheet-sub">This permanently removes your account and all its lists from the database. This can't be undone.</p>
      <div class="sheet-actions">
        <button class="btn btn-soft" data-auth="cancel-delete">Keep my account</button>
        <button class="btn btn-danger" data-auth="confirm-delete">Delete forever</button>
      </div>`);
  }
  if (kind === 'cancel-delete') { closeSheet(); return; }
  if (kind === 'confirm-delete') { await deleteAccount(); return; }
}
async function handleAuthSubmit(form) {
  if (authBusy) return;
  const fd = new FormData(form);
  const mode = authMode;
  const f = mode === 'signup'
    ? { username: (fd.get('username') || '').trim(), email: (fd.get('id') || '').trim(), password: fd.get('password') || '' }
    : { id: (fd.get('id') || '').trim(), password: fd.get('password') || '' };
  if (mode === 'signin') { const blk = rlBlocked(); if (blk) { setAuthError(rlMessage(blk)); return; } }
  setAuthError(''); setAuthBusy(true);
  try {
    await doEmailAuth(mode, f);
    if (mode === 'signin') rlReset();
    closeSheet(); showHome(false); toast(mode === 'signup' ? 'Account created' : 'Signed in');
  }
  catch (e) { if (mode === 'signin') rlRecordFail(); setAuthError(humanAuthError(e)); }
  setAuthBusy(false);
}
async function handleResetSubmit(form) {
  const email = (new FormData(form).get('email') || '').trim();
  if (!email) return;
  const btn = document.getElementById('reset-submit');
  const err = document.getElementById('reset-error');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
  try {
    const c = await ensureCloud();
    await c.authm.sendPasswordResetEmail(c.auth, email);
    closeSheet(); toast('Reset email sent — check your inbox');
  } catch (e) {
    if (err) err.textContent = humanAuthError(e);
    if (btn) { btn.disabled = false; btn.textContent = 'Send reset link'; }
  }
}
function setAuthError(msg) { const el = $('#auth-error'); if (el) el.textContent = msg || ''; }
function setAuthBusy(b) {
  authBusy = b; const btn = $('#auth-submit');
  if (btn) { btn.disabled = b; btn.textContent = b ? 'Please wait…' : (authMode === 'signup' ? 'Create account' : 'Sign in'); }
}
function humanAuthError(e) {
  const c = (e && e.code) || '';
  const map = {
    'auth/email-already-in-use': 'That email already has an account — try signing in.',
    'auth/invalid-email': 'That email address looks wrong.',
    'auth/weak-password': 'Password needs at least 6 characters.',
    'auth/wrong-password': 'Wrong password — try again.',
    'auth/user-not-found': 'No account with that email.',
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/popup-closed-by-user': 'Sign-in was cancelled.',
    'auth/network-request-failed': 'Network problem — check your connection.',
  };
  return map[c] || (e && e.message) || 'Something went wrong — try again.';
}
function initAuth() {
  if (!CLOUD_ENABLED) return;            // local/guest only — nothing async to do
  ensureCloud().then(c => {
    c.authm.onAuthStateChanged(c.auth, u => {
      if (u && u.isAnonymous) return;        // anonymous = shared-list access only, never an account session
      if (u) {
        if (!session || session.uid !== u.uid || session.provider !== 'cloud') {
          activateSession({ uid: u.uid, email: u.email || '', username: u.displayName || (u.email || 'You').split('@')[0], provider: 'cloud' }).then(() => rerender());
        } else cloudSubscribe();
      } else if (session && session.provider === 'cloud') {
        session = null; saveSession(null); state = load(); refreshAccountUI(); rerender();
      }
    });
  }).catch(() => { /* SDK blocked/offline — stay in local/guest mode */ });
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
  document.body.classList.remove('fmt-on', 'view-detail');
  document.body.classList.add('view-home');
  $('#page-detail').hidden = true;
  const h = $('#page-home'); h.hidden = false;
  h.style.animation = 'none'; void h.offsetWidth; h.style.animation = '';
  renderHome();
  requestAnimationFrame(() => { h.scrollTop = 0; updateScrollbar(); });
  if (push) pushNav({ v: 'home' });
}
function showDetail(id, push = true) {
  if (!getList(id)) return showHome(false);
  view.name = 'detail'; view.id = id;
  $('#page-home').hidden = true;
  const d = $('#page-detail'); d.hidden = false;
  d.style.animation = 'none'; void d.offsetWidth; d.style.animation = '';
  $('#add-input').value = ''; syncSend();
  document.body.classList.remove('fmt-on', 'view-home');
  document.body.classList.add('view-detail');
  renderDetail();
  requestAnimationFrame(() => { d.scrollTop = 0; updateScrollbar(); });
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

/* Inline text formatting for list items, stored as lightweight markers in the
   plain-text value (so it persists & syncs unchanged, with no data migration).
   EXTENSIBLE: add italic / strikethrough / etc. by adding one rule below and
   (optionally) one toolbar button — fmtText() and stripFmt() pick it up
   automatically. The text is ESCAPED first and tags are introduced only after,
   so user input can never inject HTML (XSS-safe). Rules are applied outer→inner
   so styles combine, e.g. **__both__** → <strong><u>both</u></strong>. */
const FORMAT_RULES = [
  { re: /\*\*([^*]+?)\*\*/g, tag: 'strong' },   // **bold**
  { re: /__([^_]+?)__/g,     tag: 'u' },         // __underline__
  // future, e.g.: { re: /~~([^~]+?)~~/g, tag: 's' }  // ~~strikethrough~~
];
function fmtText(s) {
  let h = esc(s);
  for (const r of FORMAT_RULES) h = h.replace(r.re, `<${r.tag}>$1</${r.tag}>`);
  return h;
}
function stripFmt(s) {
  let t = String(s == null ? '' : s);
  for (const r of FORMAT_RULES) t = t.replace(r.re, '$1');
  return t;
}

function ListCard(l) {
  const done = l.items.filter(i => i.done).length, total = l.items.length;
  const pct = total ? Math.round(done / total * 100) : 0;
  const t = titleOr(l), q = norm(homeQuery);
  return `<button class="card" style="--c:${l.color}" data-open="${l.id}" aria-label="${esc(t || 'Untitled list')}">
    <span class="card-top">
      <span class="swatch-dot">${l.pinned ? `<span class="pin-flag">${I.pin}</span>` : ''}${l.shared ? `<span class="share-flag" aria-label="Shared list">${I.users}</span>` : ''}</span>
      <span class="card-menu" data-menu="${l.id}" role="button" aria-label="List options">${I.dots}</span>
    </span>
    <span class="card-title ${t ? '' : 'untitled'}">${t ? hl(t, q) : 'Untitled'}</span>
    ${total ? `<span class="card-preview">${previewItems(l, q).map(it =>
      `<span class="pl ${it.done ? 'done' : ''}">${hl(stripFmt(it.text), q)}</span>`).join('')}</span>` : ''}
    <span class="card-foot">
      <span class="card-bar"><i style="width:${pct}%"></i></span>
      <span class="card-count">${total ? `${done}/${total}` : 'empty'}</span>
    </span>
  </button>`;
}

function ItemRow(it) {
  return `<div class="item-wrap">
    <div class="item ${it.done ? 'done' : ''}" data-id="${it.id}">
      <span class="handle" data-handle aria-label="Drag to reorder">${I.grip}</span>
      <button class="check" data-check="${it.id}" role="checkbox" aria-checked="${it.done}" aria-label="${esc(stripFmt(it.text))}">${I.tick}</button>
      <span class="item-text ${it.text ? '' : (it.img ? 'photo-only' : '')}" data-edit="${it.id}"><span class="tx">${fmtText(it.text)}</span></span>
      ${it.img ? `<button class="item-img" data-img="${it.id}" aria-label="View photo"><img src="${it.img}" alt="" loading="lazy"></button>` : ''}
      <button class="item-del" data-del="${it.id}" aria-label="Delete item">${I.trash}</button>
      ${it.qty > 1 ? `<button class="qty" data-qty="${it.id}" aria-label="Quantity ${it.qty}, tap to add one">×${it.qty}</button>` : ''}
    </div>
  </div>`;
}

/* ---- Home view ---- */
function renderHome() {
  requestAnimationFrame(updateScrollbar);   // refresh the scrollbar thumb after the grid re-renders
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
  $('#detail-meta').innerHTML = `<span class="chip-color"></span>${total ? `${done} of ${total} done` : 'Empty list'}${l.pinned ? ' · pinned' : ''}${l.shared ? ' · shared' : ''}`;
  $('#progress').style.display = total ? '' : 'none';
  $('#progress-fill').style.width = (total ? Math.round(done / total * 100) : 0) + '%';

  const wrap = $('#items');
  if (total) {
    wrap.innerHTML = l.items.map(ItemRow).join('');
    // Long lists: skip the staggered entry animation entirely — keeps scrolling
    // and toggling snappy even with hundreds of rows.
    const animate = !noAnim && total <= 40;
    [...wrap.querySelectorAll('.item')].forEach((r, i) => { if (animate) r.style.animationDelay = Math.min(i * 26, 160) + 'ms'; else r.style.animation = 'none'; });
  } else wrap.innerHTML = '';
  noAnim = false;

  $('#detail-empty').innerHTML = total ? '' : `<div class="detail-empty">
    <div class="ring">${I.spark}</div>
    <h3>Nothing here yet</h3>
    <p>Type below, paste a whole list, or tap the mic and say it.</p>
  </div>`;
  requestAnimationFrame(updateScrollbar);   // resize/position the thumb for the new content
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
  requestAnimationFrame(() => { const d = $('#page-detail'); if (d) d.scrollTo({ top: d.scrollHeight, behavior: 'smooth' }); updateScrollbar(); });
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

/* ====================== 6a-2. Photos on items ======================
   An item can hold an optional photo (with or without text). Images are
   downscaled & re-encoded to a small JPEG data-URL on-device, so they store in
   localStorage, sync to shared lists via Firestore, and work fully offline —
   no Firebase Storage needed. */
/* Resize the longest side to <=maxDim and compress until under ~targetBytes. */
function compressImage(file, maxDim = 1000, targetBytes = 280000) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) return reject(new Error('That file is not an image'));
    // Read as a data: URL (NOT a blob: object URL) — the strict CSP blocks blob:
    // images on purpose, but allows data:. Then draw to a canvas and re-encode.
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that image'));
    reader.onload = () => {
      const im = new Image();
      im.onerror = () => reject(new Error('Could not read that image'));
      im.onload = () => {
        let w = im.naturalWidth, h = im.naturalHeight;
        const scale = Math.min(1, maxDim / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale)); h = Math.max(1, Math.round(h * scale));
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d'); ctx.drawImage(im, 0, 0, w, h);
        let q = 0.72, data = cv.toDataURL('image/jpeg', q), guard = 0;
        while (data.length > targetBytes && guard++ < 7) {
          q -= 0.12;
          if (q < 0.35) { w = Math.round(w * 0.82); h = Math.round(h * 0.82); cv.width = w; cv.height = h; ctx.drawImage(im, 0, 0, w, h); q = 0.6; }
          data = cv.toDataURL('image/jpeg', Math.max(0.32, q));
        }
        resolve(data);
      };
      im.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
let imgTarget = 'new';        // 'new' or an existing item id
function pickImageFor(target) { imgTarget = target || 'new'; const inp = $('#img-input'); if (inp) { inp.value = ''; inp.click(); } }
async function onImagePicked(file) {
  if (!file) return;
  if (view.name !== 'detail') return;
  try {
    toast('Adding photo…');
    const data = await compressImage(file);
    if (data.length > MAX.img) { toast('That photo is too large'); return; }
    const l = getList(view.id); if (!l) return;
    const target = imgTarget;
    if (target !== 'new') {
      const it = l.items.find(i => i.id === target);
      if (it) { it.img = data; touch(l); save(); buzz(8); renderDetail(); return; }
    }
    // new item: compose with any typed text
    const raw = $('#add-input').value.trim();
    const parsed = raw ? smartLine(raw) : null;
    l.items.push(mkItem(parsed ? parsed.text : '', parsed ? parsed.done : false, parsed ? parsed.qty : null, data));
    if (l.tidy) tidySort(l);
    $('#add-input').value = ''; syncSend();
    touch(l); save(); buzz(8); renderDetail();
    requestAnimationFrame(() => { const d = $('#page-detail'); if (d) d.scrollTo({ top: d.scrollHeight, behavior: 'smooth' }); updateScrollbar(); });
  } catch (e) { toast((e && e.message) || 'Could not add photo'); }
}
/* Fullscreen photo viewer with Replace / Remove. */
function openImage(itemId) {
  const l = getList(view.id); const it = l && l.items.find(i => i.id === itemId);
  if (!it || !it.img) return;
  const lb = document.createElement('div'); lb.className = 'lightbox';
  lb.innerHTML = `<img src="${it.img}" alt="Item photo">
    <div class="lb-actions">
      <button class="btn btn-soft" data-lb="replace" data-id="${itemId}">${I.camera}<span>Replace</span></button>
      <button class="btn btn-danger" data-lb="remove" data-id="${itemId}">${I.trash}<span>Remove</span></button>
    </div>
    <button class="lb-close" data-lb="close" aria-label="Close">${I.x}</button>`;
  document.body.appendChild(lb);
  requestAnimationFrame(() => lb.classList.add('show'));
  lb.addEventListener('click', e => {
    const b = e.target.closest('[data-lb]');
    const kind = b ? b.dataset.lb : (e.target === lb ? 'close' : '');
    if (kind === 'close') { lb.classList.remove('show'); setTimeout(() => lb.remove(), 200); }
    else if (kind === 'replace') { lb.remove(); pickImageFor(itemId); }
    else if (kind === 'remove') { lb.remove(); removeItemImage(itemId); }
  });
}
function removeItemImage(itemId) {
  const l = getList(view.id); const it = l && l.items.find(i => i.id === itemId); if (!it) return;
  it.img = null;
  if (!it.text.trim()) { const idx = l.items.indexOf(it); if (idx >= 0) l.items.splice(idx, 1); }   // image-only item → remove when emptied
  touch(l); save(); buzz(8); renderDetail(); toast('Photo removed');
}

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

/* ====================== 6c. Drag to reorder (hold the grip) ======================
   A short swipe on the grip scrolls the list normally (pan-y) — nothing
   is intercepted, so scrolling is NEVER affected. HOLD the grip for 300 ms to
   grab that row, then drag up/down to reorder and release to drop. */
let drag = null;
/* Press the grip (the six dots) and drag immediately — no long-press, no
   double-tap. The grip has touch-action:none (CSS) so pressing it starts the
   drag at once; touching anywhere ELSE on the list scrolls natively as before,
   so the scroll is unchanged. */
function onPointerDown(e) {
  const handle = e.target.closest('[data-handle]');
  if (!handle) return;                       // anywhere else → 100% native scroll
  const row = handle.closest('.item'); if (!row) return;
  e.preventDefault();
  startDrag(row, e.clientY, e.pointerId);
}
function startDrag(row, startY, pointerId) {
  if (!row) return;
  const container = $('#items');
  const rows = [...container.querySelectorAll('.item')];
  const rects = rows.map(r => r.getBoundingClientRect());
  const idx = rows.indexOf(row);
  // Measure from the dragged row (always on-screen, so its size is real even
  // with content-visibility windowing) and an adjacent row for the gap.
  const h = (rects[idx] && rects[idx].height) || 56;
  const gap = rects[idx + 1] ? rects[idx + 1].top - rects[idx].bottom
            : rects[idx - 1] ? rects[idx].top - rects[idx - 1].bottom : 9;
  drag = { row, rows, rects, container, h, gap, startY, index: idx, current: idx };
  row.classList.add('dragging');
  rows.forEach(r => { if (r !== row) r.classList.add('shift'); });
  container.style.touchAction = 'none';
  try { row.setPointerCapture(pointerId); } catch (x) { }
  buzz(14);
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

/* Note: there is no horizontal swipe-to-delete. Deletion is an explicit trash
   button on each row (clearer, and it never competes with vertical scrolling).
   Tap-to-edit is wired via the #items click listener. */

/* ====================== item mutations ====================== */
function toggleItem(itemId) {
  const l = getList(view.id); if (!l) return;
  const it = l.items.find(i => i.id === itemId); if (!it) return;
  const wasComplete = listIsComplete(l);
  it.done = !it.done; touch(l);
  if (it.done) bumpStat('checked');
  const nowComplete = listIsComplete(l);
  if (nowComplete && !wasComplete) bumpStat('completed');
  if (l.tidy) { tidySort(l); save(); noAnim = true; renderDetail(); }
  else {
    save();
    const row = document.querySelector(`.item[data-id="${itemId}"]`);
    if (row) { row.classList.toggle('done', it.done); const cb = row.querySelector('.check'); cb && cb.setAttribute('aria-checked', it.done); }
  }
  buzz(it.done ? 10 : 6);
  const done = l.items.filter(i => i.done).length, total = l.items.length;
  $('#progress-fill').style.width = Math.round(done / total * 100) + '%';
  $('#detail-meta').innerHTML = `<span class="chip-color"></span>${done} of ${total} done${l.pinned ? ' · pinned' : ''}${l.shared ? ' · shared' : ''}`;
  if (nowComplete && !wasComplete) toast('List complete ✓');
  checkBadges();
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
  input.className = 'item-edit'; input.value = raw; input.maxLength = MAX.item + 8; input.setAttribute('aria-label', 'Edit item');
  span.replaceWith(input); input.focus(); input.setSelectionRange(raw.length, raw.length);
  const commit = () => {
    const v = input.value.trim();
    if (!v) { const i = l.items.indexOf(it); if (i >= 0) l.items.splice(i, 1); }
    else { const { text, qty } = parseQty(stripMarker(v)); it.text = cleanText(text || v, MAX.item); it.qty = qty; }
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
  l.items.forEach(it => { const t = stripFmt(it.text) || (it.img ? '📷 Photo' : ''); lines.push((it.done ? '✓ ' : '• ') + t + (it.img && it.text ? ' 📷' : '') + (it.qty > 1 ? ` ×${it.qty}` : '')); });
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
function openSheet(html, opts = {}) {
  if (sheetOpen()) closeSheetNow(true); else pushNav({ v: 'sheet' });
  $('#sheet-root').innerHTML = `<div class="sheet${opts.tall ? ' sheet-tall' : ''}" role="dialog" aria-modal="true"><div class="handle-bar"></div>${html}</div>`;
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
      <button class="menu-item ${l.shared ? 'on' : ''}" data-act="share" data-id="${id}">${I.users} ${l.shared ? 'Sharing — show code' : 'Share &amp; collaborate'}${l.shared ? ` <span class="mi-note">${esc(l.code)}</span>` : ''}</button>
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

/* ---- collaborative sharing sheets ---- */
function shareMessage(l) {
  const url = location.origin + location.pathname;
  return `Join my QuickList "${stripFmt(l.title) || 'list'}" — open ${url} , tap Join and enter code:  ${l.code}`;
}
function openShareSheet(l) {
  if (typeof l === 'string') l = getList(l); if (!l) return;
  openSheet(`
    <h2 class="sheet-title">Share &amp; collaborate</h2>
    <p class="sheet-sub">Anyone with this code can open and edit this list — no account needed. Changes sync live for everyone.</p>
    <div class="share-code" id="share-code">${esc(l.code || '')}</div>
    <div class="sheet-actions">
      <button class="btn btn-soft" data-act="copycode" data-id="${l.id}">${I.copy} Copy code</button>
      <button class="btn btn-c" style="--c:#21A971;--on:#fff" data-act="sharecode" data-id="${l.id}">${I.whatsapp} Share</button>
    </div>
    <div class="menu-list">
      <button class="menu-item danger" data-act="stopshare" data-id="${l.id}">${I.trash} Stop sharing this copy</button>
    </div>
    <p class="auth-foot">${I.shield}<span>The code is like a key — only share it with people you want editing the list.</span></p>
  `);
}
function openJoinSheet() {
  openSheet(`
    <h2 class="sheet-title">Join a shared list</h2>
    <p class="sheet-sub">Enter a code someone shared with you to open their list and edit it together — no account needed.</p>
    <form id="join-form" class="auth-form" autocomplete="off">
      <input class="field code-input" name="code" placeholder="ABC123" autocapitalize="characters" autocomplete="off" maxlength="10" aria-label="List code">
      <p class="auth-error" id="join-error" role="alert"></p>
      <button class="btn btn-c btn-block" style="--c:#5A63E0;--on:#fff" type="submit">Join list</button>
    </form>
    <p class="auth-foot">${I.users}<span>${CLOUD_ENABLED ? 'You and everyone with the code see the same list, live.' : 'Cloud sharing isn\'t set up on this build yet.'}</span></p>
  `);
}
async function handleJoinSubmit(form) {
  const err = $('#join-error'), btn = form.querySelector('button[type=submit]');
  const code = (new FormData(form).get('code') || '').trim();
  if (err) err.textContent = '';
  if (btn) { btn.disabled = true; btn.textContent = 'Joining…'; }
  try {
    const l = await joinByCode(code);
    closeSheet(); showDetail(l.id); toast('Joined the list');
  } catch (e) {
    if (err) err.textContent = shareErrMsg(e);
    if (btn) { btn.disabled = false; btn.textContent = 'Join list'; }
  }
}
async function shareCodeOut(id) {
  const l = getList(id); if (!l || !l.code) return;
  const msg = shareMessage(l);
  try {
    if (navigator.share) { await navigator.share({ text: msg }); return; }
  } catch (e) { return; /* user cancelled native share */ }
  window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank', 'noopener');
}
async function copyCode(id) {
  const l = getList(id); if (!l || !l.code) return;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(l.code);
    else { const ta = document.createElement('textarea'); ta.value = l.code; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
    buzz(10); toast('Code copied');
  } catch (e) { toast('Could not copy'); }
}

/* ====================== 6g. Scroll + minimal custom scrollbar ======================
   The detail page is a dedicated scroll container (#page-detail, see CSS) with
   native momentum scrolling. On top of that we draw ONE minimal, always-visible,
   grabbable thumb on the right edge — it reflects the scroll position and can be
   dragged or tapped to move through long lists. It never blocks normal scrolling
   (it's a narrow overlay; the rest of the page scrolls natively as usual). */
/* The active scroll container: the detail list OR the home list-of-lists.
   Both are dedicated scroll containers, so the scrollbar works on either. */
const activeScroller = () => view.name === 'detail' ? $('#page-detail') : $('#page-home');
function updateScrollbar() {
  const sc = activeScroller(), bar = $('#scrollbar'), thumb = $('#scrollthumb');
  if (!sc || !bar || !thumb) return;
  const ch = sc.clientHeight, sh = sc.scrollHeight, st = sc.scrollTop;
  const trackH = bar.clientHeight;
  if (sh <= ch + 4 || trackH <= 0) { thumb.style.opacity = '0'; return; }   // nothing to scroll
  thumb.style.opacity = '1';
  const thumbH = clamp((ch / sh) * trackH, 44, trackH);
  const maxScroll = sh - ch;
  const top = maxScroll > 0 ? (st / maxScroll) * (trackH - thumbH) : 0;
  thumb.style.height = thumbH + 'px';
  thumb.style.transform = `translateY(${Math.round(top)}px)`;
}
let sbRaf = 0;
function onDetailScroll() { if (sbRaf) return; sbRaf = requestAnimationFrame(() => { sbRaf = 0; updateScrollbar(); }); }
function initScrollbar() {
  const bar = $('#scrollbar');
  if (!bar) return;
  // Listen to both scroll containers (home + detail); only the active one is visible.
  ['#page-home', '#page-detail'].forEach(sel => { const el = $(sel); if (el) el.addEventListener('scroll', onDetailScroll, { passive: true }); });
  window.addEventListener('resize', () => updateScrollbar(), { passive: true });
  bar.addEventListener('pointerdown', e => {
    const sc = activeScroller(); if (!sc) return;
    const thumb = $('#scrollthumb');
    const barRect = bar.getBoundingClientRect();
    const thumbRect = thumb.getBoundingClientRect();
    const trackH = bar.clientHeight, thumbH = thumbRect.height;
    const maxScroll = sc.scrollHeight - sc.clientHeight;
    if (maxScroll <= 0) return;
    bar.classList.add('dragging');
    try { bar.setPointerCapture(e.pointerId); } catch (_) { }
    // Grab the thumb where you press; if you press the track outside it, centre on the press.
    let grabOffset = (e.clientY >= thumbRect.top && e.clientY <= thumbRect.bottom) ? (e.clientY - thumbRect.top) : thumbH / 2;
    const apply = clientY => {
      const range = trackH - thumbH;
      const frac = range > 0 ? clamp((clientY - barRect.top - grabOffset) / range, 0, 1) : 0;
      sc.scrollTop = frac * maxScroll;
    };
    apply(e.clientY);
    const move = me => apply(me.clientY);
    const end = () => {
      bar.classList.remove('dragging');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', end, { once: true });
    window.addEventListener('pointercancel', end, { once: true });
  });
}

/* ====================== 6h. Toast ====================== */
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
  const t = e.target.closest('[data-open],[data-menu],[data-new],[data-act],[data-color],[data-check],[data-qty],[data-del],[data-sort],[data-filter],[data-clear-filters],[data-toast-action],[data-auth],[data-set-theme],[data-achv-tab]');
  if (!t) return;

  if (t.dataset.setTheme) { setTheme(t.dataset.setTheme); buzz(8); return openSettingsSheet(); }
  if (t.dataset.achvTab) { buzz(6); return setAchvTab(t.dataset.achvTab); }
  if (t.dataset.auth) return handleAuth(t.dataset.auth);
  if (t.dataset.menu) { e.stopPropagation(); return openListMenu(t.dataset.menu); }
  if (t.hasAttribute('data-open')) return showDetail(t.dataset.open);
  if (t.hasAttribute('data-new')) { const l = createList(); showDetail(l.id); setTimeout(() => $('#add-input').focus(), 320); return; }
  if (t.dataset.check) return toggleItem(t.dataset.check);
  if (t.dataset.del) return deleteItem(t.dataset.del);
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
    else if (act === 'share') { closeSheet(); setTimeout(() => createShare(id), 60); }
    else if (act === 'stopshare') { stopSharing(id); }
    else if (act === 'copycode') { copyCode(id); }
    else if (act === 'sharecode') { shareCodeOut(id); }
    else if (act === 'join') { openJoinSheet(); }
  }
});

$('#fab').addEventListener('click', () => { const l = createList(); showDetail(l.id); setTimeout(() => $('#add-input').focus(), 320); });
$('#join-fab').addEventListener('click', openJoinSheet);
$('#sort-btn').addEventListener('click', openFindSheet);
$('#achv-btn').addEventListener('click', () => { achvTab = 'badges'; openAchievementsSheet(); });
$('#settings-btn').addEventListener('click', openSettingsSheet);
$('#avatar').addEventListener('click', () => { authMode = 'signin'; openAccountSheet(); });
document.addEventListener('submit', e => {
  if (e.target.id === 'auth-form') { e.preventDefault(); handleAuthSubmit(e.target); }
  if (e.target.id === 'reset-form') { e.preventDefault(); handleResetSubmit(e.target); }
  if (e.target.id === 'join-form') { e.preventDefault(); handleJoinSubmit(e.target); }
});
$('#detail-back').addEventListener('click', () => { try { document.activeElement && document.activeElement.blur(); } catch (e) { } navBack(); });
$('#detail-copy').addEventListener('click', () => copyList(view.id));
$('#detail-whatsapp').addEventListener('click', () => shareWhatsApp(view.id));
$('#detail-menu').addEventListener('click', () => openDetailMenu(view.id));
$('#detail-meta').addEventListener('click', () => openColorSheet(view.id));

$('#detail-title').addEventListener('input', () => { const l = getList(view.id); if (l) { l.title = cleanText($('#detail-title').value, MAX.title); touch(l); save(); } });

$('#home-search').addEventListener('input', e => { homeQuery = e.target.value; renderHome(); });
$('#search-clear').addEventListener('click', () => { homeQuery = ''; $('#home-search').value = ''; renderHome(); $('#home-search').focus(); });

$('#addbar').addEventListener('submit', e => { e.preventDefault(); const v = $('#add-input').value.trim(); if (v) { addItems(v); $('#add-input').value = ''; syncSend(); } });
$('#add-input').addEventListener('input', syncSend);
$('#add-input').addEventListener('paste', e => {
  const txt = (e.clipboardData || window.clipboardData)?.getData('text') || '';
  if (/[\n,]/.test(txt) && txt.trim()) { e.preventDefault(); addItems(txt); $('#add-input').value = ''; syncSend(); }
});
$('#mic').addEventListener('click', toggleVoice);
$('#img-btn').addEventListener('click', () => pickImageFor('new'));
$('#img-input').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) onImagePicked(f); });

$('#items').addEventListener('pointerdown', onPointerDown);
// Tap item text to edit — click never fires during scroll, so this never conflicts
$('#items').addEventListener('click', e => {
  if (drag) return;
  const img = e.target.closest('[data-img]');
  if (img) { openImage(img.dataset.img); return; }
  const text = e.target.closest('.item-text');
  if (text) beginEdit(text.dataset.edit);
});

/* ---- inline text formatting (bold / underline) ---- */
function wrapSelection(input, marker) {
  if (!input) return;
  const v = input.value;
  let s = input.selectionStart, e = input.selectionEnd;
  if (s == null) { s = e = v.length; }
  const sel = v.slice(s, e);
  if (sel) {
    input.value = v.slice(0, s) + marker + sel + marker + v.slice(e);
    input.setSelectionRange(s + marker.length, e + marker.length);
  } else {
    input.value = v.slice(0, s) + marker + marker + v.slice(s);
    const p = s + marker.length; input.setSelectionRange(p, p);
  }
}
const fmtTarget = () => { const a = document.activeElement; return (a && (a.id === 'add-input' || a.classList.contains('item-edit'))) ? a : $('#add-input'); };
// pointerdown + preventDefault keeps the text field focused and its selection intact
document.addEventListener('pointerdown', e => {
  const b = e.target.closest('[data-fmt]'); if (!b) return;
  e.preventDefault();
  const input = fmtTarget();
  wrapSelection(input, b.dataset.fmt === 'bold' ? '**' : '__');
  if (input && input.id === 'add-input') syncSend();
  buzz(6);
});
// The formatting bar only appears while a text field is focused (add or edit)
document.addEventListener('focusin', e => { if (e.target.matches('#add-input, .item-edit')) document.body.classList.add('fmt-on'); });
document.addEventListener('focusout', e => {
  if (!e.target.matches('#add-input, .item-edit')) return;
  setTimeout(() => { const a = document.activeElement; if (!a || !a.matches('#add-input, .item-edit')) document.body.classList.remove('fmt-on'); }, 60);
});

/* Keep the add bar visible above the on-screen keyboard. The visualViewport
   shrinks when the keyboard opens; lift the bar by that amount so you can always
   see what you're typing. Works whether or not the WebView honours
   interactive-widget=resizes-content. */
function syncKeyboard() {
  const vv = window.visualViewport; if (!vv) return;
  const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
  document.documentElement.style.setProperty('--kb', kb + 'px');
  document.body.classList.toggle('kb-open', kb > 80);
}
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', syncKeyboard);
  window.visualViewport.addEventListener('scroll', syncKeyboard);
}
$('#add-input').addEventListener('focus', () => {
  setTimeout(() => { syncKeyboard(); try { $('#add-input').scrollIntoView({ block: 'nearest' }); } catch (e) { } }, 250);
});
$('#add-input').addEventListener('blur', () => { setTimeout(syncKeyboard, 50); });

$('#backdrop').addEventListener('click', closeSheet);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (sheetOpen()) closeSheet(); else if (view.name === 'detail') navBack(); }
});

/* Drag-state safety cleanup (native scroll needs no JS) */
document.addEventListener('visibilitychange', () => { if (document.hidden && drag) onDragEnd(); });

/* ====================== 7. Init ====================== */
function init() {
  session = loadSession();      // restore account (if any) BEFORE loading its data
  state = load();               // synchronous, never blocks on the network
  try { history.replaceState({ v: 'home' }, ''); } catch (e) { histOK = false; }
  $('#page-detail').hidden = true; $('#page-home').hidden = false; $('#backdrop').hidden = true;

  $('#avatar').innerHTML = I.person;
  $('#detail-back').innerHTML = I.back;
  $('#detail-copy').innerHTML = I.copy;
  $('#detail-whatsapp').innerHTML = I.whatsapp;
  $('#detail-menu').innerHTML = I.dots;
  $('#sort-btn').innerHTML = I.sliders;
  $('#achv-btn').innerHTML = I.trophy;
  $('#join-fab').innerHTML = I.users;
  $('#settings-btn').innerHTML = I.gear;
  $('#search-ic').innerHTML = I.search;
  $('#search-clear').innerHTML = I.x;
  $('#mic').innerHTML = I.mic;
  $('#img-btn').innerHTML = I.camera;
  $('#add-send').innerHTML = I.send;
  $('#fab-icon').innerHTML = I.plus;
  if (!SR) $('#mic').style.display = 'none';

  applyTheme();                // re-assert saved theme + sync the address-bar colour
  if (window.matchMedia) {     // keep "System" theme live if the OS flips light/dark
    try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (settings.theme === 'system') applyTheme(); }); } catch (e) { }
  }
  refreshAccountUI();
  snapshotBadges();            // baseline so existing progress doesn't fire "unlocked" toasts on load
  initScrollbar();
  resubscribeAllShared();      // resume live sync for any lists shared on this device
  showHome(false);
  syncSend();
  initAuth();                  // async; failures stay contained, app already usable

  // Register the SW only on the web (PWA offline). In the native APK (Capacitor)
  // the assets are already bundled locally, so we SKIP the SW — this prevents any
  // stale cached shell from masking an app update.
  try {
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !window.Capacitor) {
      navigator.serviceWorker.register('sw.js');
    } else if (window.Capacitor && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {});
    }
  } catch (e) { }
  checkForceUpdate();
}
try { init(); } catch (err) { showFatal(err); }
