import axios, { AxiosError } from 'axios';
import { env } from '@/core/config/env';

/**
 * Sesión contra la API de ELIZA (POST /v1/auth/*), sin navegador.
 * La API obtiene los tokens de Keycloak por su red interna: el teléfono no
 * conoce la URL de Keycloak ni ningún secreto.
 *
 * Cliente axios propio, SIN los interceptores de apiClient: estas rutas se
 * llaman justamente cuando no hay token (o cuando hay que renovarlo), y no
 * deben disparar el refresh ni el signOut automáticos.
 */
const http = axios.create({
  baseURL: `${env.apiBaseUrl}/v1/auth`,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

export interface SessionTokens {
  accessToken: string;
  /** Segundos hasta que vence el access token */
  expiresIn: number;
  refreshToken: string;
  /** Segundos de inactividad hasta que vence la sesión */
  refreshExpiresIn: number;
}

/**
 * Error de sesión ya listo para mostrar.
 *  - kind 'auth': credenciales o sesión inválidas (no reintentar sin que el usuario actúe)
 *  - kind 'rate_limited': demasiados intentos
 *  - kind 'unavailable': sin conexión, servidor caído o Keycloak no disponible
 */
export class SessionError extends Error {
  constructor(
    readonly kind: 'auth' | 'rate_limited' | 'unavailable',
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'SessionError';
  }
}

function toSessionError(e: unknown): SessionError {
  const err = e as AxiosError<{ code?: string; detail?: string }>;
  const status = err.response?.status;
  const code = err.response?.data?.code ?? (status ? `http.${status}` : 'network');
  const detail = err.response?.data?.detail;

  if (!err.response) {
    return new SessionError(
      'unavailable',
      'network',
      'No hay conexión con el servidor. Revisa tu conexión a internet e intenta de nuevo.',
    );
  }
  if (status === 429) {
    return new SessionError('rate_limited', code, 'Demasiados intentos. Espera un minuto e intenta de nuevo.');
  }
  if (status === 401 || status === 403) {
    return new SessionError('auth', code, detail ?? 'Usuario o contraseña incorrectos.');
  }
  return new SessionError(
    'unavailable',
    code,
    detail ?? 'El inicio de sesión no está disponible en este momento. Intenta de nuevo en unos minutos.',
  );
}

export async function login(username: string, password: string): Promise<SessionTokens> {
  try {
    const { data } = await http.post<SessionTokens>('/login', { username: username.trim(), password });
    return data;
  } catch (e) {
    throw toSessionError(e);
  }
}

export async function refresh(refreshToken: string): Promise<SessionTokens> {
  try {
    const { data } = await http.post<SessionTokens>('/refresh', { refreshToken });
    return data;
  } catch (e) {
    throw toSessionError(e);
  }
}

/** Mejor esfuerzo: si falla, la app igual borra la sesión local. */
export async function logout(refreshToken: string): Promise<void> {
  try {
    await http.post('/logout', { refreshToken }, { timeout: 5_000 });
  } catch {
    // sin conexión o sesión ya cerrada: no importa
  }
}
