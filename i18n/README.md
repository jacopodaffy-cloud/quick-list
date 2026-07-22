# QuickList translations

## How it works

The **English string is the key**:

```js
tr('Settings')                     // → 'Impostazioni' in Italian
tr('{n} lists', { n: 3 })          // named placeholders
```

`i18n.js` owns the framework; each language is one self-registering file in this
folder:

```js
I18N.register('it', { 'Settings': 'Impostazioni', … });
```

There is **no `en.js`** — English is the identity mapping. Any key with no
entry falls back to the key itself, i.e. correct English. A missing or broken
resource file therefore degrades to a fully working English app rather than
showing blank labels.

## Adding a language

1. Add one row to `LANGS` in `../i18n.js`:

   ```js
   { code: 'sv', native: 'Svenska', english: 'Swedish', bcp47: 'sv-SE' }
   ```

   Add `rtl: true` for right-to-left scripts — `theme.js` and `i18n.js` then set
   `dir="rtl"` and the `[dir="rtl"]` block in `app.css` mirrors the layout.

2. Create `i18n/sv.js` calling `I18N.register('sv', { … })`.

3. Register it for offline use and for the Android build:
   - add the code to `LOCALES` in `../sw.js`
   - nothing to do in CI — `.github/workflows/android.yml` copies this whole folder

No code changes anywhere else; the picker in Settings is generated from `LANGS`.

## Rules for translators

- Copy the key **exactly** — typographic apostrophes (`’`), ellipses (`…`),
  em dashes (`—`), emoji and double spaces all matter. One wrong character and
  the entry silently never applies.
- Preserve placeholders (`{n}`, `{name}`) verbatim.
- Never translate: **QuickList**, **WhatsApp**, **Google**.
- Keep button and row labels short — they sit in fixed-width chrome.
- `bcp47` also selects the **speech-recognition language** for voice input, so
  it must be a tag the platform recognises.

## Verifying

`tools/` has no runner for this, but the checks that matter are:

```bash
node --check i18n/<code>.js        # parses
```

plus a key-parity pass against the canonical list extracted from the source
(every `tr('…')` call site). Mismatched or missing keys degrade to English
silently, so parity is worth checking whenever strings change.

## Current coverage

The framework is complete and every shipped language covers the extracted key
set. Some secondary sheets (account, sharing, list menu, achievements) are not
yet wrapped in `tr()` and still render in English in every language — by design
they remain fully usable. Extending is mechanical: wrap the string in `tr()`,
then add the key to each file in this folder.
