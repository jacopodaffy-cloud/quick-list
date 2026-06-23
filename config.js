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
  firebase: {
    apiKey: "AIzaSyCqpquRDztkMRJ3HHU-Uuxuh9-xU48pUmw",
    authDomain: "qwicklist-d8ee6.firebaseapp.com",
    projectId: "qwicklist-d8ee6",
    storageBucket: "qwicklist-d8ee6.firebasestorage.app",
    messagingSenderId: "491197590751",
    appId: "1:491197590751:web:c5f047971bbb6a42104d6a",
    measurementId: "G-P8K9NESGCR"
  }
};
