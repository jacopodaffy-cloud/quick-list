# QuickList — PRD (2026‑06‑30)

Product: **QuickList** — premium, mobile‑first list app (each list is a colour). Vanilla HTML/CSS/JS, local‑first PWA, shipped to Android as a self‑contained Capacitor app (AAB/APK) via GitHub Actions.

Firebase project: `qwicklist-d8ee6` · Android app id: `app.quicklist.twa` · Repo: `github.com/jacopodaffy-cloud/quick-list` (branch `main` → GitHub Pages + Android CI).

This release: **assets `?v=42`, sw cache `quicklist-v43`, Android `versionCode 42`.**

---

## 0. Goals for today

1. **Login works in the installed app** (Google + email/password). Top priority — "login is essential."
2. **Back/exit is predictable**: the system back gesture and the on‑screen back button go to the *previous page*, never straight out of the app; you can leave a shared list on the first tap.
3. **Gamification is visible and rewarding**: making lists clearly earns badges, points and levels, with a moment of celebration.
4. **A central database of every list** the admin can browse.
5. Keep the **AAB + APK** build pipeline green so the result can be uploaded to Google Play.

---

## 1. Login (Google + email/password)

### What I verified in Firebase (`qwicklist-d8ee6`)
- Google sign‑in **enabled**; email/password **enabled**; anonymous **enabled**.
- Authorized domains correct (`jacopodaffy-cloud.github.io`, `localhost`, `*.web.app`).
- Android app `app.quicklist.twa` registered with **SHA‑1 `8edb5edf…`** + SHA‑256.
- The project's `google-services.json` contains **both** OAuth clients the app needs:
  - **Android client (type 1)** `…-c8upq1r4…` bound to SHA‑1 `8edb5edf…`
  - **Web client (type 3)** `…-13eaa8v0…` (the `serverClientId` the app hands to Firebase).

**Conclusion: Firebase is configured correctly.** Because the failing app was **sideloaded** (signed by the upload keystore, whose SHA‑1 *is* registered), this is **not** a Play App‑Signing / SHA mismatch. The "tapping Google exits the app" symptom is a **native plugin wiring** problem, not a console problem.

### Root‑cause hypothesis
The native path (`@codetrix-studio/capacitor-google-auth`) was added but the setup was incomplete/fragile:
- `google-services.json` was **not in the repo** and the **google‑services Gradle plugin was not applied**, so the native Google/OAuth config wasn't compiled into the app the standard way.
- `doGoogle()` called `GoogleAuth.signIn()` **without first initialising** the plugin. An uninitialised native call can throw at the native layer, which JS `try/catch` cannot catch → the process dies → "the app exits."

### Changes
1. **Commit the real `google-services.json`** (public identifiers only — safe to commit, same status as the `apiKey`).
2. **Apply the google‑services Gradle plugin** in CI (project `classpath` + app `apply plugin`) and copy `google-services.json` into `android/app/`.
3. **Initialise before sign‑in**: `doGoogle()` calls a guarded `GoogleAuth.initialize({ clientId: <web client>, scopes, grantOfflineAccess:false })`, then `signIn()`, with logging (`[QL] …` → visible in `logcat`) and a friendly error toast on any JS‑level failure. Email/password stays the always‑works fallback.
4. Keep the existing `server_client_id` string‑resource injection.

### Acceptance
- Cloud build is green; AAB + APK produced; emulator smoke test reports the app **opens** (no launch regression).
- On a device: tapping **Continue with Google** opens the Google account picker and signs in (data syncs to `users/{uid}`); email/password sign‑up → sign‑in → data persists.
- **If Google still fails on device**, the app shows a message and stays open (never exits), and we capture `adb logcat` to read the exact native error and iterate once.

### Honest constraint
This machine has no Android Studio/device, so the native Google tap **cannot be verified locally** — only the cloud build + launch smoke test can. Expect a possible 1 device‑test iteration.

---

## 2. Back / exit navigation

### Bugs
- **Edge‑swipe / system back exits the app** instead of returning to the previous page. Cause: no native Android back handler (`@capacitor/app` not installed), so the OS back gesture isn't routed through the app's in‑page history.
- **Can't leave a shared list on the first tap** (have to tap back several times). Cause: the join→detail transition used `history.back()` + `setTimeout` + `pushState`, a timing race that leaves a phantom history entry on slower devices.

### Changes
1. Add **`@capacitor/app`** and register a `backButton` listener: if a sheet is open or we're in a list → go back one step in‑app; only **exit** when already on Home with nothing open.
2. Make sheet→detail transitions **deterministic**: replace the racy back+timeout+push with a single `replaceState` that converts the sheet's history entry into the detail entry (no race, back works first tap). Applies to join‑by‑code, "Open" from a menu, and duplicate.

### Acceptance
- In a list (incl. a shared list): one back tap **and** one edge‑swipe both return to Home.
- On Home with nothing open: back/edge‑swipe exits (expected).
- Opening a sheet then backing out closes the sheet and stays put.

---

## 3. Gamification (make the existing system shine)

The badge engine already exists (50 badges across 7 categories, points, levels, opt‑in leaderboard) but is under‑surfaced.

### Changes
1. **Level on Home**: the home subtitle shows the current level alongside the list count.
2. **Completion celebration**: finishing a list (all items checked) triggers a confetti burst + a richer toast ("🎉 List complete · +points"). Animations are transform‑only so they render in any environment.
3. **Level‑up moment**: when an action pushes you to a new level, show a "Level up — Level N" toast + haptic.
4. Existing badge‑unlock toasts retained.

### Acceptance
- Creating/finishing lists and checking items visibly moves points/level and pops badge toasts.
- Completing a list shows a celebratory moment.
- No regression to sync (stats still merge by MAX across devices).

---

## 4. Central database of all lists (admin)

**Decision (user):** a central admin view of **everyone's** lists, accepting the privacy trade‑off. Kept strictly admin‑only and server‑enforced.

### How it works
- Every signed‑in (cloud) user already stores their full state at `users/{uid}` (lists + items). Firestore rules already let the admin (`jacopodaffy@gmail.com`, verified token email) read all `users/{uid}`. No rule change needed.
- **`admin.html`** gains an **all‑lists browser**: per‑user rows expand to show each list (title, colour, item count, done/total); plus global totals (users / lists / items). Admin login is Google + email allow‑list; non‑admins are rejected and signed out. All user text is escaped (no stored XSS).

### Privacy note
This intentionally lets the admin read list **content**, which the previous model avoided. Personal *account* data (passwords) is still never readable — only list content the user saved to their own cloud doc. Documented in `SECURITY.md`.

### Acceptance
- Admin opens `admin.html`, signs in, sees totals and can expand any user to read their lists. Non‑admin is denied.

---

## 5. Release / build

- One push to `main` deploys the web app (GitHub Pages) **and** builds a signed **AAB + APK** (Actions → run artifacts).
- **Bump every release**: `versionCode` (→ **42**), asset `?v=` (→ 42), sw cache (→ `quicklist-v43`). Play rejects a re‑used `versionCode`.
- Keystore is injected from repo secrets (never committed). Emulator smoke test gates "does it open".

### Out of scope today
- Native Apple/iOS. Push notifications. Real‑time presence in shared lists. Server‑side functions.

---

## 6. Risks
- Native Google tap is unverifiable locally → may need one device‑test iteration (logcat).
- Gradle plugin edit happens in CI → if it breaks the build, fix from CI logs before relying on the artifact (email/password login already works in the currently‑shipped app, so users aren't stranded).
- Admin all‑lists view widens data exposure by design — keep the admin allow‑list tight.
