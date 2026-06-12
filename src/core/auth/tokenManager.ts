import * as SecureStore from 'expo-secure-store';
import { refreshAsync, type TokenResponse } from 'expo-auth-session';
import { env } from '@/core/config/env';
import { discovery } from './discovery';

/**
 * Token Manager — patrón del Documento de Seguridad (§3.1.2):
 *  - access_token SOLO en memoria
 *  - refresh_token en almacenamiento seguro (Keychain / Android Keystore)
 *  - renovación proactiva cuando faltan < 60 segundos para expirar
 *  - Refresh Token Rotation: cada refresh reemplaza el token guardado
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

export async function storeSession(tokens: TokenResponse): Promise<void> {
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
    const tokens = await refreshAsync(
      { clientId: env.keycloakClientId, refreshToken },
      discovery,
    );
    await storeSession(tokens);
    return tokens.accessToken;
  } catch {
    // Refresh inválido/revocado → la sesión murió (Keycloak rota los refresh tokens)
    await clearSession();
    onSessionExpired?.();
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
