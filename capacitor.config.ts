import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.quicklist.twa',
  appName: 'QuickList',
  webDir: 'www',
  // No server.url: the APK bundles the web files directly (www/).
  // This means JS/CSS fixes take effect with each build — no firebase deploy needed.
  android: {
    backgroundColor: '#14161B'
  }
};

export default config;
