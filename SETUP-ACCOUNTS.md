# Turning on accounts + cross-device sync

QuickList works **right now** with device-local accounts (sign up / sign in / sign out, data kept per account on the device). To get **Google sign-in** and **your lists on every device**, connect a free Firebase project — about 5 minutes, no servers to run.

## What you get
- "Continue with Google" works.
- Email/password accounts live in the cloud.
- Sign in on a new phone or computer → your lists are already there.

## Steps

### 1. Create a Firebase project
- Go to **https://console.firebase.google.com** → **Add project** (any name). Analytics optional.

### 2. Add a Web app
- In the project, click the **`</>`** (Web) icon → register an app.
- Firebase shows a `firebaseConfig` object. Copy it.

### 3. Enable sign-in methods
- **Build → Authentication → Get started.**
- Enable **Email/Password**.
- Enable **Google** (pick a support email).

### 4. Create the database + lock it down
- **Build → Firestore Database → Create database** (Production mode).
- Open the **Rules** tab and paste exactly this, then **Publish**:
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

### 5. Allow your domains
- **Authentication → Settings → Authorized domains.** Make sure `localhost` and your real domain (`jacopodaffy-cloud.github.io`) are listed. Remove anything you don't recognise.

### 6. Paste the config into QuickList
- Open `config.js` and replace `firebase: null` with your object:
```js
window.QUICKLIST_CONFIG = {
  firebase: {
    apiKey: "AIza…",
    authDomain: "your-app.firebaseapp.com",
    projectId: "your-app",
    appId: "1:…:web:…"
  }
};
```
- That's it. Re-open the app: the account sheet now does real Google + email/password, and everything syncs.

> The values in `config.js` are **public on purpose** — see SECURITY.md. The only thing protecting your data is the Firestore rule in step 4, so don't skip it.

## How sync behaves
- On sign-in, your cloud data is pulled and merged with anything on the device (newest version of each list wins).
- Every change is pushed to the cloud (debounced), and other signed-in devices update live.
- Offline still works — changes are saved locally and pushed when you're back online.

## Building the Android APK after this
Once deployed with config in place, follow [BUILD-APK.md](BUILD-APK.md) (Netlify/your host + PWABuilder). The login and sync work the same inside the APK because it loads your hosted site.
