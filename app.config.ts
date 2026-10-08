import type { ExpoConfig } from 'expo/config';

/**
 * ELIZA Mobile — Sprint 9.1
 * Configuración por ambiente vía variables EXPO_PUBLIC_* (archivo .env).
 * El scheme "eliza" habilita el deep link eliza://auth/callback para OIDC.
 */
const config: ExpoConfig = {
  name: 'ELIZA',
  slug: 'eliza-mobile',
  version: '0.9.1',
  scheme: 'eliza',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.bcmcongelados.eliza',
  },
  android: {
    package: 'com.bcmcongelados.eliza',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    ['expo-splash-screen', { backgroundColor: '#0B3A53', resizeMode: 'contain' }],
  ],
  experiments: { typedRoutes: true },
};

export default config;
