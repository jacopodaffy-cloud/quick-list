# QuickList — Security

This documents the security review you asked for, and the rules that keep your data yours.

## 1. API-key audit — result: clean

I scanned every app folder for secrets (`api_key`, `secret`, `token`, `password`, `AIza…`, `client_secret`, `private_key`, `.env` files).

- **QuickList ships zero secrets.** There are no keys, tokens, or passwords in the code.
- The only match anywhere was an **empty** `OPENAI_API_KEY=` placeholder in a *different* project's `.env.example` — the correct pattern (example file, no value).

## 2. The one rule that matters for a web app

**A web app cannot keep a secret.** Everything shipped to the browser — every `.js` file, every config — is readable by anyone who opens DevTools. So the security model is *not* "hide a key"; it is "use a key that is safe to be public, and enforce access on the server."

That is exactly how the optional cloud sync works:

- **`config.js` holds only Firebase's public config.** Firebase's `apiKey` is a project *identifier*, not a credential — Google designs it to ship in the browser. It is safe to commit and publish.
- **What actually protects your data:**
  1. **Firestore Security Rules** — the server refuses any read/write to `users/{uid}` unless the signed-in user *is* that uid. Even with the public config, no one can touch your lists.
  2. **OAuth Authorized domains** — Google sign-in only works from domains you allow-list in the Firebase console, so the key can't be reused on a phishing site.
  3. **Firebase Auth handles passwords** — they are hashed and salted on Google's servers; QuickList never sees or stores a cloud password.

- **What must NEVER be in the browser:** a service-account JSON, an Admin SDK key, a `client_secret`, or any *private* key. Those are real leaks. `config.js` calls this out in a comment so it never happens by accident.

## 3. Required Firestore Security Rules

Paste these in **Firebase console → Firestore → Rules** before going live. Without them, the default rules could expose data.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

This is the whole ballgame: a user can only ever read or write their **own** document. Everyone else — including someone holding your public `apiKey` — is denied by the server.

## 4. Passwords

- **Device accounts** (when cloud isn't configured): the password is run through **PBKDF2-SHA-256, 150,000 iterations, with a random 16-byte salt** via the Web Crypto API. Only the salt and hash are stored — **the password itself is never written anywhere**. (Verified: the plaintext never appears in `localStorage`.)
- **Cloud accounts**: passwords are handled entirely by Firebase Auth over HTTPS; QuickList never receives them.
- Honest limit: a device account protects *which account's data loads*, not the raw bytes — anyone with your unlocked device can read `localStorage` directly. Real confidentiality + cross-device sync comes from cloud mode. This is stated in the UI.

## 5. Other hardening in place

- **Content-Security-Policy** (in `index.html`): `default-src 'self'`; scripts only from self + Google's `gstatic`/`apis.google.com`; connections only to self + Google APIs; `object-src 'none'`, `base-uri 'none'`. This blocks injected scripts and exfiltration to arbitrary domains. (Verified the app boots clean under it; the CSP even blocks `blob:` images by design.)
- **XSS-safe rendering** — all user text is HTML-escaped (`esc()`) before it touches the DOM; the app never uses `innerHTML` with raw user input.
- **HTTPS** — required in production (GitHub Pages serves HTTPS). Service worker and Firebase both require it.
- **No third-party trackers, no analytics, no external scripts** beyond Google's own auth/db SDK.
- **Local-first by default** — with no cloud configured, nothing ever leaves the device.

## 6. Your pre-launch checklist

- [ ] Firestore rules above are published.
- [ ] In Firebase Auth → Settings → **Authorized domains**, keep only `localhost` and your real domain (`jacopodaffy-cloud.github.io`).
- [ ] Enable only the sign-in methods you use (Email/Password, Google).
- [ ] `config.js` contains **only** the public web config — no service-account file in the repo.
- [ ] Serve over HTTPS.
