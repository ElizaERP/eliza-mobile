import { queryClient } from '@/core/query/queryClient';
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
 * Borra todo lo que la app tiene en memoria de la sesión anterior: consultas
 * (productos, stock, pedidos, órdenes…) y mutaciones pendientes. Sin esto, el
 * siguiente usuario —o el mismo usuario en otro tenant— vería por un momento
 * los datos del anterior, que siguen en la caché de TanStack Query.
 */
function vaciarCache(): void {
  void queryClient.cancelQueries();
  queryClient.clear();
}

/**
 * Termina la sesión en la app: primero pasa a "no autenticado" (la navegación
 * desmonta las pantallas y sus consultas dejan de pedir datos) y después vacía
 * la caché, para que ninguna pantalla montada vuelva a llenarla.
 */
function terminarSesion(): void {
  useAuthStore.getState().setUnauthenticated();
  vaciarCache();
}

/**
 * Restaura la sesión al arrancar la app: si hay refresh token guardado,
 * intenta renovarlo. Si no hay o falla, queda no autenticado.
 */
export async function bootstrapSession(): Promise<void> {
  const store = useAuthStore.getState();
  store.setLoading();

  // El refresh token venció o fue revocado: misma limpieza que un cierre de sesión.
  setOnSessionExpired(terminarSesion);

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
  // Segunda barrera: aunque algo hubiera quedado en caché, el usuario nuevo
  // empieza siempre con la caché vacía.
  vaciarCache();
  useAuthStore.getState().setAuthenticated(claimsToUser(decodeJwt(tokens.accessToken)));
}

/** Cierra sesión: la API revoca el refresh token en Keycloak, se limpia el storage y la caché. */
export async function signOut(): Promise<void> {
  const refreshToken = await getStoredRefreshToken();
  if (refreshToken) await logout(refreshToken);
  await clearSession();
  terminarSesion();
}
