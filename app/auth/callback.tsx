import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';

/**
 * Destino del redirect OIDC: eliza://auth/callback (build nativo) o
 * exp://<host>:<puerto>/--/auth/callback (Expo Go).
 *
 * Expo Router trata ese deep link como una ruta; sin este archivo muestra
 * "Unmatched Route". El intercambio code → tokens lo hace la pantalla de login
 * (useAuthRequest recibe la respuesta) y el guard del layout raíz lleva al home
 * al quedar autenticado. Si en 20 s no pasó nada, se ofrece volver al login.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 20_000);
    return () => clearTimeout(t);
  }, []);

  return (
    <View className="flex-1 items-center justify-center bg-frost-900 px-8">
      <ActivityIndicator color="#38BDF8" />
      <Text className="mt-4 text-center text-sm text-ice-100">Completando inicio de sesión…</Text>
      {slow ? (
        <View className="mt-8 w-full">
          <Text className="mb-4 text-center text-xs text-ice-100">
            Está tardando más de lo normal. Volvé a la pantalla de inicio e intentá de nuevo.
          </Text>
          <Button label="Volver al inicio de sesión" onPress={() => router.replace('/(auth)/login')} />
        </View>
      ) : null}
    </View>
  );
}
