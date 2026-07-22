/* ============================================================
   QuickList — theme bootstrap
   Runs in <head> BEFORE first paint so the saved theme is applied
   instantly (no flash of the wrong colour scheme). Kept as a tiny
   external same-origin file so it satisfies the strict CSP — no
   inline scripts allowed (see index.html).
   ============================================================ */
(function () {
  try {
    var s = JSON.parse(localStorage.getItem('quicklist.settings') || '{}') || {};
    var t = s.theme;
    var root = document.documentElement;
    if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t);
    else root.removeAttribute('data-theme'); // 'system' (default) follows the OS
    // Keep the browser UI (status bar / address bar) in step with the theme.
    var dark = t === 'dark' || (t !== 'light' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var m = document.querySelector('meta[name="theme-color"]#tc');
    if (m) m.setAttribute('content', dark ? '#0D0E12' : '#F5F6F8');

    // Language + writing direction, also before first paint: an RTL locale
    // must not render left-to-right for a frame and then flip. i18n.js owns
    // the full language list; this only needs to know which are RTL.
    var RTL = { ar: 1, he: 1, fa: 1, ur: 1 };
    var lang = s.lang;
    if (!lang) {
      // No saved choice yet — mirror the device so the very first paint is
      // already in the right direction. i18n.js re-resolves this properly.
      lang = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
    }
    var base = String(lang).toLowerCase().split('-')[0];
    root.setAttribute('lang', lang);
    root.setAttribute('dir', RTL[base] ? 'rtl' : 'ltr');
  } catch (e) { /* never block boot on a theme read */ }
})();
