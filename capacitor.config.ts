import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.quicklist.twa',
  appName: 'QuickList',
  webDir: 'www',
  server: {
    url: 'https://qwicklist-v3.web.app',
    cleartext: false
  },
  android: {
    backgroundColor: '#14161B'
  }
};

export default config;
