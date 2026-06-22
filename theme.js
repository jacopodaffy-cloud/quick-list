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
  } catch (e) { /* never block boot on a theme read */ }
})();
