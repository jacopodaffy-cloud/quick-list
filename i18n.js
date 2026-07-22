/* ============================================================
   QuickList — internationalisation
   ------------------------------------------------------------
   Loaded as a plain script BEFORE app.js (same pattern as
   config.js / theme.js), so there is no build step and no module
   loader to satisfy the strict CSP.

   ARCHITECTURE — the English string IS the key.
   Instead of inventing key names ("settings.title") the source
   text is the lookup key:  t('Settings')  →  'Impostazioni'.
   For an app that was written in English first this means:
     • a missing translation renders correct English automatically,
       so "gracefully fall back to English" is free and cannot rot;
     • no key/description drift, and the call site stays readable;
     • adding a language = one resource file, zero code changes.

   Resource files live in i18n/<code>.js and self-register:
       I18N.register('it', { 'Settings': 'Impostazioni', … });
   English needs no file — it is the identity mapping.

   Interpolation uses {named} placeholders:
       t('{n} lists', { n: 3 })
   ============================================================ */
window.I18N = (function () {
  'use strict';

  /* Every shipped language. `bcp47` drives SpeechRecognition and
     Intl formatting; `native` is what the picker shows (a language
     is always listed in its own script, never translated). */
  var LANGS = [
    { code: 'en',      native: 'English',              english: 'English',              bcp47: 'en-US' },
    { code: 'it',      native: 'Italiano',             english: 'Italian',              bcp47: 'it-IT' },
    { code: 'es',      native: 'Español',              english: 'Spanish',              bcp47: 'es-ES' },
    { code: 'fr',      native: 'Français',             english: 'French',               bcp47: 'fr-FR' },
    { code: 'de',      native: 'Deutsch',              english: 'German',               bcp47: 'de-DE' },
    { code: 'pt-BR',   native: 'Português (Brasil)',   english: 'Portuguese (Brazil)',  bcp47: 'pt-BR' },
    { code: 'nl',      native: 'Nederlands',           english: 'Dutch',                bcp47: 'nl-NL' },
    { code: 'pl',      native: 'Polski',               english: 'Polish',               bcp47: 'pl-PL' },
    { code: 'ru',      native: 'Русский',              english: 'Russian',              bcp47: 'ru-RU' },
    { code: 'tr',      native: 'Türkçe',               english: 'Turkish',              bcp47: 'tr-TR' },
    { code: 'zh-Hans', native: '简体中文',              english: 'Chinese (Simplified)', bcp47: 'zh-CN' },
    { code: 'ja',      native: '日本語',                english: 'Japanese',             bcp47: 'ja-JP' },
    { code: 'ar',      native: 'العربية',               english: 'Arabic',               bcp47: 'ar-SA', rtl: true },
    { code: 'hi',      native: 'हिन्दी',                  english: 'Hindi',                bcp47: 'hi-IN' }
  ];

  /* Cache-bust resource files with the SAME ?v= this file was loaded with, read
     off our own <script> tag. That keeps locales in step with index.html's
     asset version automatically — one less thing to bump by hand. */
  var ASSET_V = (function () {
    try {
      var el = document.currentScript;
      var m = el && el.src && el.src.match(/[?&]v=([^&]+)/);
      return m ? m[1] : '1';
    } catch (e) { return '1'; }
  })();

  var SETTINGS_KEY = 'quicklist.settings';
  var dicts = {};          // code → { englishString: translation }
  var loaded = { en: true };   // en is the identity mapping, always "loaded"
  var current = 'en';
  var onChange = null;

  var byCode = {};
  LANGS.forEach(function (l) { byCode[l.code] = l; });

  /* ---------- translation ---------- */
  /* t(key) returns the translation for the CURRENT language, or the key
     itself (i.e. English) when there is no entry. Never throws, never
     returns undefined — a broken resource file degrades to English. */
  function t(key, vars) {
    var s = key;
    var table = dicts[current];
    if (table) {
      var hit = table[key];
      if (typeof hit === 'string' && hit) s = hit;
    }
    if (vars) {
      s = s.replace(/\{(\w+)\}/g, function (m, name) {
        return Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : m;
      });
    }
    return s;
  }

  /* Resource files call this. Merging (rather than replacing) lets a file
     be split or patched without clobbering what is already registered. */
  function register(code, table) {
    if (!code || !table) return;
    dicts[code] = Object.assign(dicts[code] || {}, table);
    loaded[code] = true;
  }

  /* ---------- persistence ---------- */
  function readSettings() {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch (e) { return {}; }
  }
  function persist(code) {
    try {
      var s = readSettings();
      s.lang = code;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    } catch (e) { /* private mode — the choice just won't survive a reload */ }
  }

  /* First run: follow the device. navigator.languages is ordered by
     preference, so the first entry we actually ship wins. Falls back to
     English when nothing matches. */
  function detect() {
    var wanted = (navigator.languages && navigator.languages.length)
      ? navigator.languages : [navigator.language || 'en'];
    for (var i = 0; i < wanted.length; i++) {
      var tag = String(wanted[i] || '');
      if (byCode[tag]) return tag;                                  // exact ('pt-BR')
      var base = tag.toLowerCase().split('-')[0];
      if (base === 'zh') return 'zh-Hans';                          // any Chinese → Simplified
      if (base === 'pt') return 'pt-BR';
      for (var j = 0; j < LANGS.length; j++) {
        if (LANGS[j].code.toLowerCase().split('-')[0] === base) return LANGS[j].code;
      }
    }
    return 'en';
  }

  /* ---------- loading ---------- */
  /* Resource files are fetched on demand as same-origin scripts (allowed by
     script-src 'self'). A failure resolves rather than rejects: the app must
     still boot, just in English. */
  function load(code) {
    if (loaded[code]) return Promise.resolve(true);
    return new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = 'i18n/' + code + '.js?v=' + ASSET_V;
      s.async = false;
      s.onload = function () { resolve(true); };
      s.onerror = function () { resolve(false); };   // stay in English
      document.head.appendChild(s);
    });
  }

  /* Mirror the language onto <html> so the browser hyphenates, spell-checks
     and (for Arabic) mirrors the layout correctly. theme.js does this before
     first paint too, so switching never flashes the wrong direction. */
  function applyDocument() {
    var meta = byCode[current] || byCode.en;
    var root = document.documentElement;
    root.setAttribute('lang', meta.code);
    root.setAttribute('dir', meta.rtl ? 'rtl' : 'ltr');
  }

  /* ---------- public API ---------- */
  /* Called once before init(). Resolves when the saved (or detected)
     language is ready to render. */
  function boot() {
    var saved = readSettings().lang;
    var code = byCode[saved] ? saved : detect();
    current = code;
    return load(code).then(function () {
      if (!loaded[current]) current = 'en';
      applyDocument();
      return current;
    });
  }

  /* Switch language at runtime: persist, load, apply, then let the app
     re-render. Resolves once the new strings are live. */
  function setLang(code) {
    if (!byCode[code]) code = 'en';
    persist(code);
    return load(code).then(function (ok) {
      current = (ok || code === 'en') ? code : 'en';
      applyDocument();
      if (typeof onChange === 'function') onChange(current);
      return current;
    });
  }

  return {
    t: t,
    register: register,
    boot: boot,
    setLang: setLang,
    langs: function () { return LANGS.slice(); },
    meta: function (code) { return byCode[code || current] || byCode.en; },
    current: function () { return current; },
    bcp47: function () { return (byCode[current] || byCode.en).bcp47; },
    isRTL: function () { return !!(byCode[current] || byCode.en).rtl; },
    onChange: function (fn) { onChange = fn; }
  };
})();

/* Short global alias. Deliberately NOT `t`: app.js already uses `t` as a local
   variable in a dozen functions, which would shadow the translator and throw. */
window.tr = window.I18N.t;
