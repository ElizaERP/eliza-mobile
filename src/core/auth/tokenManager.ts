import * as SecureStore from 'expo-secure-store';
import { refresh, SessionError, type SessionTokens } from './sessionApi';

/**
 * Token Manager — patrón del Documento de Seguridad (§3.1.2):
 *  - access_token SOLO en memoria
 *  - refresh_token en almacenamiento seguro (Keychain / Android Keystore)
 *  - renovación proactiva cuando faltan < 60 segundos para expirar
 *  - cada refresh reemplaza el refresh token guardado
 *
 * La renovación va contra la API (POST /v1/auth/refresh), no contra Keycloak.
 * Solo se cierra la sesión cuando la API dice que el refresh ya no sirve;
 * un corte de red no saca al usuario.
 */

const REFRESH_TOKEN_KEY = 'eliza.refresh_token';
const EXPIRY_SKEW_SECONDS = 60;

interface MemorySession {
  accessToken: string;
  /** epoch en segundos */
  expiresAt: number;
}

let session: MemorySession | null = null;
let refreshInFlight: Promise<string | null> | null = null;
let onSessionExpired: (() => void) | null = null;

export function setOnSessionExpired(handler: () => void): void {
  onSessionExpired = handler;
}

function toMemorySession(accessToken: string, expiresIn: number | undefined): MemorySession {
  const ttl = typeof expiresIn === 'number' && expiresIn > 0 ? expiresIn : 300;
  return { accessToken, expiresAt: Math.floor(Date.now() / 1000) + ttl };
}

export async function storeSession(tokens: SessionTokens): Promise<void> {
  session = toMemorySession(tokens.accessToken, tokens.expiresIn);
  if (tokens.refreshToken) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
  }
}

export async function getStoredRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function clearSession(): Promise<void> {
  session = null;
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

function isAccessTokenValid(): boolean {
  if (!session) return false;
  return session.expiresAt - Math.floor(Date.now() / 1000) > EXPIRY_SKEW_SECONDS;
}

export function getAccessTokenInMemory(): string | null {
  return session?.accessToken ?? null;
}

async function doRefresh(): Promise<string | null> {
  const refreshToken = await getStoredRefreshToken();
  if (!refreshToken) return null;
  try {
    const tokens = await refresh(refreshToken);
    await storeSession(tokens);
    return tokens.accessToken;
  } catch (e) {
    if (e instanceof SessionError && e.kind === 'auth') {
      // La sesión venció o fue cerrada: hay que volver a iniciar sesión.
      await clearSession();
      onSessionExpired?.();
    }
    // Sin conexión o servidor caído: se conserva el refresh token para reintentar luego.
    return null;
  }
}

/**
 * Devuelve un access token válido, renovando con el refresh token si es
 * necesario. Las renovaciones concurrentes se colapsan en una sola.
 */
export async function getValidAccessToken(): Promise<string | null> {
  if (isAccessTokenValid()) return session!.accessToken;
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}
