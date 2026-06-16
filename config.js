/* ============================================================
   QuickList configuration  —  SAFE TO COMMIT / PUBLISH
   ------------------------------------------------------------
   Firebase's `apiKey` is a PUBLIC project identifier, NOT a secret.
   It is meant to ship in the browser. Your data is protected by:
     • Firestore Security Rules  (each user can only touch users/{their-uid})
     • the OAuth "Authorized domains" allow-list in the Firebase console
     • Firebase Auth handling all password hashing server-side
   See SECURITY.md and SETUP-ACCOUNTS.md.

   NEVER put a private key here: no service-account JSON, no
   "client_secret", no admin SDK key. Those would be a real leak.

   Leave firebase = null to run in local mode (accounts stay on this
   device). Paste your firebaseConfig object to enable Google sign-in
   and cross-device cloud sync.
   ============================================================ */
window.QUICKLIST_CONFIG = {
  firebase: null
  // firebase: {
  //   apiKey: "AIza...",
  //   authDomain: "your-app.firebaseapp.com",
  //   projectId: "your-app",
  //   appId: "1:...:web:..."
  // }
};
