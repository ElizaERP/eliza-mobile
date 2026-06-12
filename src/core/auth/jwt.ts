/**
 * Decodificador de JWT sin dependencias externas.
 * Solo decodifica el payload (la validación criptográfica la hace el backend).
 */

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64Decode(input: string): string {
  let str = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = str.length % 4;
  if (pad === 2) str += '==';
  else if (pad === 3) str += '=';
  else if (pad === 1) throw new Error('JWT base64 inválido');

  let output = '';
  let buffer = 0;
  let bits = 0;
  for (const ch of str) {
    if (ch === '=') break;
    const value = B64_CHARS.indexOf(ch);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  // Decodificación UTF-8
  try {
    return decodeURIComponent(
      output
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    );
  } catch {
    return output;
  }
}

export interface KeycloakAccessTokenClaims {
  sub: string;
  exp: number;
  iat: number;
  iss: string;
  preferred_username?: string;
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  /** Custom claim inyectado por el client scope eliza-claims */
  tenant_id?: string;
  plant_id?: string;
  warehouse_id?: string;
  /** Claim plano inyectado por eliza-claims */
  roles?: string[];
  /** Claim estándar de Keycloak */
  realm_access?: { roles?: string[] };
}

export function decodeJwt<T = KeycloakAccessTokenClaims>(token: string): T {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) {
    throw new Error('Token JWT con formato inválido');
  }
  return JSON.parse(base64Decode(parts[1])) as T;
}

export function extractRoles(claims: KeycloakAccessTokenClaims): string[] {
  const flat = claims.roles ?? [];
  const realm = claims.realm_access?.roles ?? [];
  return Array.from(new Set([...flat, ...realm]));
}
