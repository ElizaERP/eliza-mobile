import { decodeJwt, extractRoles, type KeycloakAccessTokenClaims } from './jwt';
import { login, logout } from './sessionApi';
import {
  clearSession,
  getStoredRefreshToken,
  getValidAccessToken,
  setOnSessionExpired,
  storeSession,
} from './tokenManager';
import { useAuthStore, type AuthUser } from './authStore';

function claimsToUser(claims: KeycloakAccessTokenClaims): AuthUser {
  return {
    id: claims.sub,
    username: claims.preferred_username ?? claims.sub,
    name: claims.name ?? claims.preferred_username ?? 'Usuario',
    email: claims.email ?? null,
    tenantId: claims.tenant_id ?? null,
    plantId: claims.plant_id ?? null,
    warehouseId: claims.warehouse_id ?? null,
    roles: extractRoles(claims),
  };
}

/**
 * Restaura la sesión al arrancar la app: si hay refresh token guardado,
 * intenta renovarlo. Si no hay o falla, queda no autenticado.
 */
export async function bootstrapSession(): Promise<void> {
  const store = useAuthStore.getState();
  store.setLoading();

  setOnSessionExpired(() => useAuthStore.getState().setUnauthenticated());

  const refreshToken = await getStoredRefreshToken();
  if (!refreshToken) {
    store.setUnauthenticated();
    return;
  }
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    store.setUnauthenticated();
    return;
  }
  store.setAuthenticated(claimsToUser(decodeJwt(accessToken)));
}

/**
 * Inicia sesión con usuario y contraseña (POST /v1/auth/login).
 * Lanza SessionError con un mensaje listo para mostrar si falla.
 */
export async function signIn(username: string, password: string): Promise<void> {
  const tokens = await login(username, password);
  await storeSession(tokens);
  useAuthStore.getState().setAuthenticated(claimsToUser(decodeJwt(tokens.accessToken)));
}

/** Cierra sesión: la API revoca el refresh token en Keycloak y se limpia el storage. */
export async function signOut(): Promise<void> {
  const refreshToken = await getStoredRefreshToken();
  if (refreshToken) await logout(refreshToken);
  await clearSession();
  useAuthStore.getState().setUnauthenticated();
}
