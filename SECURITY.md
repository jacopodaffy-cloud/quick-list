# QuickList — Security Audit & Model

_Last full audit: 2026-06-18 (after Firebase was connected and the admin panel added)._

## Scorecard

| Area | Status |
|---|---|
| Hardcoded secrets in code | ✅ none (Firebase web config is public by design) |
| Signing keystore in git | ⚠️ **was committed — now untracked; action required (commit + rotate)** |
| Firestore security rules | ⚠️ **added to repo — action required: deploy them** |
| Admin panel XSS | ✅ fixed (output escaped) |
| Login rate limiting | ✅ added (5 / 50 min) |
| Input sanitisation | ✅ added (deep, on every read/write) |
| Account deletion | ✅ added (self-service, immediate) |
| Output escaping / XSS | ✅ app + admin escape all user text; CSP in place |
| Secrets management | ✅ `.gitignore` blocks keys; `.env.example` provided |

---

## 1. Secret scan — what was found

Scanned the whole project for `AIza…`, `-----BEGIN`, `private_key`, `client_secret`, `serviceAccount`, `sk_live/test`, hardcoded passwords, and `.env` files.

- **Firebase web config** (`config.js`, `admin.html`) — `apiKey`, `projectId`, `appId`. **Not secret.** Google designs the web `apiKey` to ship in the browser; it's a project identifier, not a credential. Safe to publish. Real protection = Firestore rules + App Check.
- **No** service-account JSON, admin SDK key, private key, or hardcoded password anywhere. ✅
- **`quicklist-release.keystore`** — see Finding A.

## 2. Findings

### A. CRITICAL — Android signing keystore was committed to git
`quicklist-release.keystore` (your app-signing key) was tracked by git. If that repo is public, anyone could download it and **sign malicious apps that masquerade as QuickList**.

- **Done:** untracked it (`git rm --cached`, file kept on disk) and added `*.keystore`/`*.jks` to `.gitignore`.
- **You must:** commit this removal. If the repo was ever pushed publicly, treat the key as compromised — generate a new keystore for future releases and keep it (and its passwords) in a password manager, never in the repo.

### B. CRITICAL — Firestore rules must be deployed
There was no `firestore.rules` in the project, so the database is protected only by whatever is set in the Firebase console. If it's still in "test mode", **every user's lists are world-readable/writable**. (If `admin.html` lists users today without the rule below, the DB is currently open.)

- **Done:** added [`firestore.rules`](firestore.rules) (users isolated to their own `uid`; admin email may read all; everything else denied) and wired it into `firebase.json`.
- **You must:** deploy it → `firebase deploy --only firestore:rules`, then confirm in the console that test-mode rules are gone.

### C. HIGH — Firebase Hosting was serving dev/secret files
`firebase.json` had `"public": "."` with a thin ignore list, so files like the keystore, `.env`, and build configs would be **downloadable from your hosting URL**.

- **Done:** expanded the hosting `ignore` list to exclude `*.keystore`, `*.jks`, `.env*`, `config.local.js`, `tools/**`, gradle/capacitor/build files, and docs.

### D. HIGH (fixed) — Stored XSS in admin.html
The admin dashboard injected `displayName`/`email`/`uid` into the page with `innerHTML` and no escaping. A user could set their username to `<img src=x onerror=…>`; when you opened the admin panel, it would run **in your admin session**.

- **Done:** added `esc()` and escaped every interpolated value in `admin.html`.

### E. MEDIUM — Admin gate is client-side
`admin.html` checks `user.email === ADMIN_EMAIL` in JavaScript. That's fine as a UX gate but is **not** the security boundary — a client check can be bypassed.

- **Mitigation:** the real enforcement is the Firestore rule (`request.auth.token.email == 'jacopodaffy@gmail.com'`), which is server-side. For stronger security, switch to a **custom claim** (`request.auth.token.admin == true`) set once via the Admin SDK, so admin status isn't tied to a guessable email.

### F. INFO — Public apiKey
Not a vulnerability. Mitigate abuse (people using your key elsewhere) by enabling **Firebase App Check** and keeping Authorized Domains tight.

## 3. New protections added this round

- **Login rate limiting** — max **5 failed sign-ins per 50 minutes**, then a cooldown with a clear message. Client-side throttle layered on top of Firebase Auth's own server-side rate limiting. (See `rlBlocked`/`rlRecordFail` in `app.js`.)
- **Deep input sanitisation** — every state that enters the app (localStorage, cloud pull, shared link, merge) passes through `normalize()`: non-objects dropped, arrays capped (≤500 lists, ≤500 items), text trimmed + control-chars stripped + length-capped (title ≤80, item ≤200), quantities clamped (≤999), colours/sort validated to known values, malformed entries rejected. Live inputs (`addItems`, title, item edit, signup) are cleaned too.
- **Account deletion (right to be forgotten)** — profile → **Delete account** → confirm → deletes the Firestore document **and** the Firebase Auth identity (or the local account + data), immediately. `delete-account.html` updated to match.
- **Output escaping everywhere** — all user text is HTML-escaped before hitting the DOM, in both the app and the admin panel.
- **CSP** — restricts scripts/connections to self + Google's Firebase/Fonts origins; `object-src 'none'`, `base-uri 'none'`. Blocks injected scripts and exfiltration.
- **Secrets hygiene** — `.gitignore` blocks keystores, `.env*`, private keys, service accounts; `.env.example` documents that any future backend secrets go in env vars, never the repo.

## 4. Actions you should take (in order)

1. `firebase deploy --only firestore:rules` — **the most important one.** Then verify in console there are no leftover test-mode rules.
2. Commit the keystore removal. If the repo is/was public, generate a fresh keystore and store it + its passwords in a password manager.
3. In Firebase console → **App Check**, register the web app (reCAPTCHA) to stop your public apiKey being abused elsewhere.
4. Authentication → Settings → **Authorized domains**: keep only `localhost`, `qwicklist-d8ee6.firebaseapp.com`, `qwicklist-v3.web.app`, and `jacopodaffy-cloud.github.io`.
5. Turn on **2-factor auth** on the `jacopodaffy@gmail.com` Google account — it can read every user's data via the admin panel, so it's a high-value target.

## 5. Residual / accepted risks (honest list)

- **Client-side rate limiting can be cleared** by wiping localStorage. It stops casual brute-forcing in the UI; Firebase Auth also throttles server-side. For a hard server limit, add App Check or a Cloud Function gateway.
- **List content is not end-to-end encrypted.** It's protected in transit (HTTPS) and at rest by Firestore rules, but Google — and you, as admin — can read stored lists. True zero-knowledge would require client-side encryption (a larger project); flagged, not implemented.
- **localStorage is readable by anyone with the unlocked device** (and would be readable by any XSS). XSS is mitigated by escaping + CSP; device-local exposure is inherent to a local-first app.
- **The admin account can read all users' data by design.** That power is concentrated in one Google account — protect it (action #5).
- **Firestore rules don't yet validate document shape** (field types/sizes server-side). The client sanitises on read, but a determined authenticated user could write odd data to *their own* doc. Optional hardening: add field validation to the rules.

This file is the living record — re-run the scan and review after any change that touches auth, hosting, or data.
