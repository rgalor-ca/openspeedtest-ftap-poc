import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ftap.openspeedtestpoc',
  appName: 'FTAP OpenSpeedTest POC',
  webDir: 'dist/ftap-openspeedtest-poc/browser',
  android: {
    allowMixedContent: true,
  },
  server: {
    cleartext: true,
    allowNavigation: ['*'],
  },
};

export default config;
