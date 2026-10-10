import type { ExpoConfig } from 'expo/config';

/**
 * ELIZA Mobile
 * Configuración por ambiente vía variables EXPO_PUBLIC_*:
 *  - en desarrollo (Expo Go) salen del archivo .env;
 *  - en los builds de EAS salen de eas.json (el .env no se sube a la nube).
 */
const EAS_PROJECT_ID = '82b30911-f051-4bc2-9d93-e62658a2662a';

const config: ExpoConfig = {
  name: 'ELIZA',
  slug: 'eliza-mobile',
  owner: 'santodev097',
  version: '0.12.0',
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
  /**
   * Actualizaciones por aire (EAS Update): los cambios de JavaScript (pantallas,
   * textos, lógica) llegan a los teléfonos sin reinstalar el APK.
   * runtimeVersion = version: una actualización solo llega a los APK de la MISMA
   * versión. Si un cambio agrega una librería nativa, se sube la versión y se
   * construye un APK nuevo (ver ACTUALIZACIONES.md).
   */
  runtimeVersion: { policy: 'appVersion' },
  updates: {
    url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
    checkAutomatically: 'ON_LOAD',
    fallbackToCacheTimeout: 0,
  },
  extra: {
    // Proyecto en EAS (expo.dev): https://expo.dev/accounts/santodev097/projects/eliza-mobile
    eas: { projectId: EAS_PROJECT_ID },
  },
};

export default config;
