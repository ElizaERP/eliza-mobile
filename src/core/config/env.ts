/**
 * Configuración de ambiente.
 * Las variables EXPO_PUBLIC_* se inyectan en build-time desde .env.
 * Deben referenciarse de forma estática (no process.env[nombre]).
 */
function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(
      `[ELIZA] Falta la variable de ambiente ${name}. Copiá .env.example a .env y configurala.`,
    );
  }
  return value.trim();
}

export const env = {
  keycloakBaseUrl: required(
    'EXPO_PUBLIC_KEYCLOAK_BASE_URL',
    process.env.EXPO_PUBLIC_KEYCLOAK_BASE_URL,
  ).replace(/\/+$/, ''),
  keycloakRealm: process.env.EXPO_PUBLIC_KEYCLOAK_REALM?.trim() || 'eliza',
  keycloakClientId: process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID?.trim() || 'eliza-mobile',
  apiBaseUrl: required('EXPO_PUBLIC_API_BASE_URL', process.env.EXPO_PUBLIC_API_BASE_URL).replace(
    /\/+$/,
    '',
  ),
} as const;

export const keycloakRealmUrl = `${env.keycloakBaseUrl}/realms/${env.keycloakRealm}`;
