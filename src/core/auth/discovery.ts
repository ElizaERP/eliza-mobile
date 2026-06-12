import type { DiscoveryDocument } from 'expo-auth-session';
import { keycloakRealmUrl } from '@/core/config/env';

/**
 * Endpoints OIDC de Keycloak (realm "eliza"), construidos desde la
 * configuración de ambiente — coinciden con el discovery document:
 * {KEYCLOAK_BASE_URL}/realms/{realm}/.well-known/openid-configuration
 */
export const discovery: DiscoveryDocument = {
  authorizationEndpoint: `${keycloakRealmUrl}/protocol/openid-connect/auth`,
  tokenEndpoint: `${keycloakRealmUrl}/protocol/openid-connect/token`,
  revocationEndpoint: `${keycloakRealmUrl}/protocol/openid-connect/revoke`,
  endSessionEndpoint: `${keycloakRealmUrl}/protocol/openid-connect/logout`,
  userInfoEndpoint: `${keycloakRealmUrl}/protocol/openid-connect/userinfo`,
};
