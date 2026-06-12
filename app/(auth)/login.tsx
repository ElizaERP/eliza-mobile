import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import {
  exchangeCodeAsync,
  makeRedirectUri,
  useAuthRequest,
} from 'expo-auth-session';
import { env } from '@/core/config/env';
import { completeSignIn, discovery } from '@/core/auth';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';

WebBrowser.maybeCompleteAuthSession();

/**
 * Login — Authorization Code + PKCE (S256) contra Keycloak.
 * En Expo Go el redirect es exp://...; en build nativo, eliza://auth/callback.
 */
const redirectUri = makeRedirectUri({ scheme: 'eliza', path: 'auth/callback' });

export default function LoginScreen() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: env.keycloakClientId,
      redirectUri,
      scopes: ['openid', 'profile', 'email'],
      usePKCE: true,
    },
    discovery,
  );

  useEffect(() => {
    if (response?.type !== 'success' || !request?.codeVerifier) {
      if (response?.type === 'error') {
        setError(response.error?.description ?? 'Keycloak rechazó la autenticación');
      }
      return;
    }
    setBusy(true);
    setError(null);
    exchangeCodeAsync(
      {
        clientId: env.keycloakClientId,
        code: response.params.code ?? '',
        redirectUri,
        extraParams: { code_verifier: request.codeVerifier },
      },
      discovery,
    )
      .then(completeSignIn)
      .catch(() => setError('No fue posible intercambiar el código por tokens'))
      .finally(() => setBusy(false));
  }, [response, request?.codeVerifier]);

  return (
    <Screen>
      <View className="flex-1 justify-center">
        <View className="mb-12 items-center">
          <View className="mb-4 h-20 w-20 items-center justify-center rounded-3xl bg-frost-900">
            <Text className="text-3xl">❄️</Text>
          </View>
          <Text className="text-3xl font-bold tracking-widest text-frost-900">ELIZA</Text>
          <Text className="mt-1 text-sm text-graphite-600">
            Plataforma operativa · BCM Congelados
          </Text>
        </View>

        <Button
          label="Iniciar sesión"
          onPress={() => void promptAsync()}
          loading={busy}
          disabled={!request}
        />

        {error ? (
          <Text className="mt-4 text-center text-sm text-danger">{error}</Text>
        ) : null}

        <Text className="mt-8 text-center text-xs text-graphite-400">
          Autenticación segura con Keycloak (OIDC + PKCE)
        </Text>
      </View>
    </Screen>
  );
}
