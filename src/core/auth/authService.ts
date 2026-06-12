import { revokeAsync, type TokenResponse } from 'expo-auth-session';
import { env } from '@/core/config/env';
import { discovery } from './discovery';
import { decodeJwt, extractRoles, type KeycloakAccessTokenClaims } from './jwt';
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
  const claims = decodeJwt(accessToken);
  store.setAuthenticated(claimsToUser(claims));
}

/** Completa el login tras el intercambio code → tokens (PKCE). */
export async function completeSignIn(tokens: TokenResponse): Promise<void> {
  await storeSession(tokens);
  const claims = decodeJwt(tokens.accessToken);
  useAuthStore.getState().setAuthenticated(claimsToUser(claims));
}

/** Cierra sesión: revoca el refresh token en Keycloak y limpia el storage. */
export async function signOut(): Promise<void> {
  const refreshToken = await getStoredRefreshToken();
  if (refreshToken) {
    try {
      await revokeAsync({ clientId: env.keycloakClientId, token: refreshToken }, discovery);
    } catch {
      // Si Keycloak no responde igual limpiamos localmente
    }
  }
  await clearSession();
  useAuthStore.getState().setUnauthenticated();
}
