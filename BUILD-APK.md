# Turning QuickList into an Android APK

## First, the honest part

QuickList is a web app (HTML/CSS/JS). An Android "app" for it is a thin native shell — a **Trusted Web Activity (TWA)** — that opens your hosted site full-screen, with no browser bar. That shell is what becomes the `.apk`.

Two consequences:

1. **The app has to be online first.** A TWA loads a URL. An APK built against `localhost` would open nothing on a real phone. So step 1 is always: put the folder on a public HTTPS address (free, takes 2 minutes).
2. **Building the binary needs the Android toolchain** (JDK + Android SDK + Gradle). This machine doesn't have them (only Node is installed). So rather than half-install ~1 GB of SDK here, use the path below — it needs **no tools on your computer** and produces a **signed** APK you can install.

---

## The 5-minute path (recommended — no tools)

### 1. Put it online
- Go to **https://app.netlify.com/drop**
- Drag the whole `quicklist` folder onto the page.
- You get a URL like `https://quicklist-abc123.netlify.app` — open it on your phone to confirm it works. (Vercel, GitHub Pages, or Cloudflare Pages work too.)

### 2. Package it into an APK
- Go to **https://www.pwabuilder.com**
- Paste your URL, hit **Start**. It reads the manifest already in this folder (name, icons, colours) and scores it.
- Click **Package for stores → Android**.
- Choose **"Signed test APK"** to sideload now, or **App Bundle (.aab)** for the Play Store.
- Download the zip. It contains `app-release-signed.apk` plus `signing-key-info.txt` — **keep that key file**, you need the same key for every future update.

### 3. Install on your phone
- Copy the `.apk` to the phone, tap it, allow "install from unknown sources".
- For the address bar to fully disappear (true full-screen TWA), the package's `assetlinks.json` must be hosted at `https://<your-domain>/.well-known/assetlinks.json`. PWABuilder gives you that file and exact instructions; until it's in place the app still runs, just with a thin top bar.

That's it — a real, signed, installable QuickList.

---

## Alternative: build locally with Bubblewrap (needs setup)

If you'd rather build on this PC, Node is here; Bubblewrap can fetch the rest:

```bash
npm install -g @bubblewrap/cli
# point it at your HOSTED manifest (not localhost):
bubblewrap init --manifest https://<your-domain>/manifest.webmanifest
# Bubblewrap offers to download the JDK + Android SDK on first run — accept.
bubblewrap build
# → produces app-release-signed.apk and a signing key
```

A pre-filled [`twa-manifest.json`](twa-manifest.json) is included to speed this up — set its `host`/`startUrl`/`webManifestUrl` to your real domain first.

---

## Alternative: Capacitor (bundles the app *inside* the APK)

If you want the app to ship **inside** the APK (works with no server at all), wrap it with Capacitor. This needs Android Studio (JDK + SDK) installed:

```bash
npm create @capacitor/app
# copy index.html, app.css, app.js, manifest, sw.js, icons into the web dir
npx cap add android
npx cap open android   # build the APK from Android Studio
```

Heavier setup, but the result is fully self-contained.

---

### Which should you pick?
- **Just want it on your phone, fast:** Netlify Drop + PWABuilder (top of page).
- **Comfortable with a terminal, want it local:** Bubblewrap.
- **Must run with no internet at all, app embedded in the APK:** Capacitor.

If you deploy to a URL and tell me the address, I can pre-fill `twa-manifest.json` for you and walk through the Bubblewrap build step by step.
