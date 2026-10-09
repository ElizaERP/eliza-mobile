import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SessionError, signIn } from '@/core/auth';
import { backendHost } from '@/core/config/env';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';

/**
 * Login dentro de la app: usuario y contraseña van a la API
 * (POST /v1/auth/login), que obtiene los tokens de Keycloak por su red
 * interna. No se abre el navegador.
 *
 * Al quedar autenticado, el guard del layout raíz lleva al home.
 */
export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const canSubmit = username.trim().length > 0 && password.length > 0 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(username, password);
      // El layout raíz navega al home al cambiar el estado a "authenticated".
    } catch (e) {
      setError(e instanceof SessionError ? e.message : 'No fue posible iniciar sesión. Intenta de nuevo.');
      if (e instanceof SessionError && e.kind === 'auth') setPassword('');
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-10 items-center">
            <View className="mb-4 h-20 w-20 items-center justify-center rounded-3xl bg-frost-900">
              <Text className="text-3xl">❄️</Text>
            </View>
            <Text className="text-3xl font-bold tracking-widest text-frost-900">ELIZA</Text>
            <Text className="mt-1 text-sm text-graphite-600">Plataforma operativa · BCM Congelados</Text>
          </View>

          <Text className="mb-1 text-xs font-medium text-graphite-600">Usuario o correo</Text>
          <TextInput
            value={username}
            onChangeText={(v) => {
              setUsername(v);
              setError(null);
            }}
            placeholder="vendedor@bcm-congelados.com"
            placeholderTextColor="#8295A3"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
            keyboardType="email-address"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            editable={!busy}
            className="mb-4 min-h-14 rounded-2xl border border-ice-100 bg-white px-4 text-base text-graphite-900"
          />

          <Text className="mb-1 text-xs font-medium text-graphite-600">Contraseña</Text>
          <View className="mb-6 min-h-14 flex-row items-center rounded-2xl border border-ice-100 bg-white">
            <TextInput
              ref={passwordRef}
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                setError(null);
              }}
              placeholder="••••••••"
              placeholderTextColor="#8295A3"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
              editable={!busy}
              className="min-h-14 flex-1 px-4 text-base text-graphite-900"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              onPress={() => setShowPassword((s) => !s)}
              className="min-h-14 justify-center px-4"
            >
              <Text className="text-sm font-semibold text-frost-700">{showPassword ? 'Ocultar' : 'Mostrar'}</Text>
            </Pressable>
          </View>

          <Button label="Iniciar sesión" onPress={() => void submit()} loading={busy} disabled={!canSubmit} />

          {error ? <Text className="mt-4 text-center text-sm text-danger">{error}</Text> : null}

          <Text className="mt-8 text-center text-xs text-graphite-400">
            ¿Olvidaste tu contraseña? Pídele al administrador que la restablezca.
          </Text>
          {backendHost ? (
            <Text className="mt-2 text-center text-xs text-graphite-400">Servidor: {backendHost}</Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
