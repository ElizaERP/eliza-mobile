/**
 * Configuración de ambiente.
 * Las variables EXPO_PUBLIC_* se inyectan en build-time desde .env.
 * Deben referenciarse de forma estática (no process.env[nombre]).
 *
 * Si falta una variable obligatoria NO se lanza un error al importar
 * (eso dejaba la app congelada en el splash): se expone `configError`
 * y el layout raíz muestra una pantalla que explica qué falta.
 */
function clean(value: string | undefined): string {
  return (value ?? '').trim().replace(/\/+$/, '');
}

const keycloakBaseUrl = clean(process.env.EXPO_PUBLIC_KEYCLOAK_BASE_URL);
const apiBaseUrl = clean(process.env.EXPO_PUBLIC_API_BASE_URL);

const missing = [
  !keycloakBaseUrl && 'EXPO_PUBLIC_KEYCLOAK_BASE_URL',
  !apiBaseUrl && 'EXPO_PUBLIC_API_BASE_URL',
].filter((name): name is string => Boolean(name));

/** Mensaje para el usuario si la configuración está incompleta; null si está bien. */
export const configError: string | null = missing.length
  ? `Faltan variables de ambiente: ${missing.join(', ')}. Copiá .env.example a .env, completalo y reiniciá con "npm run start:clear".`
  : null;

export const env = {
  /** Base de Keycloak, incluido el path relativo (DEV: https://<host>/auth) */
  keycloakBaseUrl,
  keycloakRealm: process.env.EXPO_PUBLIC_KEYCLOAK_REALM?.trim() || 'eliza',
  keycloakClientId: process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID?.trim() || 'eliza-mobile',
  /** Base de la API con su prefijo global, sin versión (DEV: https://<host>/api) */
  apiBaseUrl,
} as const;

export const keycloakRealmUrl = `${env.keycloakBaseUrl}/realms/${env.keycloakRealm}`;

/** Host del backend, para mostrarlo en pantalla (sin protocolo ni path). */
export const backendHost = apiBaseUrl.replace(/^https?:\/\//, '').split('/')[0] ?? '';
