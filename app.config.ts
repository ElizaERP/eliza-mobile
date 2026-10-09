import type { ExpoConfig } from 'expo/config';

/**
 * ELIZA Mobile
 * Configuración por ambiente vía variables EXPO_PUBLIC_*:
 *  - en desarrollo (Expo Go) salen del archivo .env;
 *  - en los builds de EAS salen de eas.json (el .env no se sube a la nube).
 */
const config: ExpoConfig = {
  name: 'ELIZA',
  slug: 'eliza-mobile',
  owner: 'santodev097',
  version: '0.11.0',
  scheme: 'eliza',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  icon: './assets/icon.png',
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.bcmcongelados.eliza',
  },
  android: {
    package: 'com.bcmcongelados.eliza',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0B3A53',
    },
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    // El build nativo exige una imagen para el splash (sin ella falla con
    // "drawable/splashscreen_logo not found"); Expo Go no la pedía.
    [
      'expo-splash-screen',
      { image: './assets/splash-icon.png', imageWidth: 180, backgroundColor: '#0B3A53', resizeMode: 'contain' },
    ],
  ],
  experiments: { typedRoutes: true },
  extra: {
    // Proyecto en EAS (expo.dev): https://expo.dev/accounts/santodev097/projects/eliza-mobile
    eas: { projectId: '82b30911-f051-4bc2-9d93-e62658a2662a' },
  },
};

export default config;
