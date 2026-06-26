import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.quicklist.twa',
  appName: 'QuickList',
  webDir: 'www',
  // NO server.url: the app is self-contained — the web code (index.html, app.js,
  // app.css, …) is bundled INTO the APK and loaded locally. This guarantees that
  // a new AAB physically contains the new code, with no dependency on a remote
  // site or its cache. (A remote server.url made the APK just a shell, so the
  // bundled code was ignored and updates never showed.)
  android: {
    backgroundColor: '#14161B'
  },
  plugins: {
    // Native Google sign-in (lightweight — only Google Sign-In via play-services-auth,
    // NO Firebase native SDK, so nothing Firebase initializes at app launch). We hand
    // the returned idToken to the Firebase JS SDK the app already uses for Firestore.
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '491197590751-13eaa8v0e0478r59476r25kjj6ahm9vl.apps.googleusercontent.com',
      forceCodeForRefreshToken: false
    }
  }
};

export default config;
