/**
 * Configuración de ambiente.
 * Las variables EXPO_PUBLIC_* se inyectan en build-time desde .env.
 * Deben referenciarse de forma estática (no process.env[nombre]).
 *
 * Desde el login sin navegador, la app solo habla con la API: el inicio de
 * sesión también pasa por ella (POST /v1/auth/login), así que ya no hace
 * falta la URL de Keycloak.
 *
 * Si falta una variable obligatoria NO se lanza un error al importar
 * (eso dejaba la app congelada en el splash): se expone `configError`
 * y el layout raíz muestra una pantalla que explica qué falta.
 */
function clean(value: string | undefined): string {
  return (value ?? '').trim().replace(/\/+$/, '');
}

const apiBaseUrl = clean(process.env.EXPO_PUBLIC_API_BASE_URL);

/** Mensaje para el usuario si la configuración está incompleta; null si está bien. */
export const configError: string | null = apiBaseUrl
  ? null
  : 'Falta la variable de ambiente EXPO_PUBLIC_API_BASE_URL. Copiá .env.example a .env, completalo y reiniciá con "npm run start:clear".';

export const env = {
  /** Base de la API con su prefijo global, sin versión (DEV: https://<host>/api) */
  apiBaseUrl,
} as const;

/** Host del backend, para mostrarlo en pantalla (sin protocolo ni path). */
export const backendHost = apiBaseUrl.replace(/^https?:\/\//, '').split('/')[0] ?? '';
