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
  },

  /* App Check (optional; also PUBLIC — it's a reCAPTCHA v3 SITE key, the secret
     stays in Google's console). To activate:
       1. Create a reCAPTCHA v3 key at https://www.google.com/recaptcha/admin/create
          with domains: jacopodaffy-cloud.github.io  and  localhost
       2. Firebase console → App Check → register the web app with that key
          (paste the SECRET key there), leave enforcement OFF at first
       3. Paste the SITE key here and redeploy
       4. After the App Check console shows "verified" traffic, turn enforcement
          ON for Firestore + Auth. Never enforce before step 3 is live. */
  appCheckSiteKey: null
};
