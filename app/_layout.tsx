import '../global.css';

import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/core/query/queryClient';
import { configError } from '@/core/config/env';
import { bootstrapSession, useAuthStore } from '@/core/auth';

/**
 * Layout raíz: providers + guard de autenticación.
 * Mientras status === 'loading' se muestra el splash (app/index.tsx).
 * Si la configuración de ambiente está incompleta, se muestra el motivo
 * en lugar de quedarse en el splash.
 */
export default function RootLayout() {
  const status = useAuthStore((s) => s.status);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (configError) return;
    void bootstrapSession();
  }, []);

  useEffect(() => {
    if (configError || status === 'loading') return;
    const inAppGroup = segments[0] === '(app)';
    // dismissAll vacía la pila (login, auth/callback) antes de reemplazar: así el
    // home no muestra flecha de volver hacia pantallas del login, y viceversa.
    if (status === 'authenticated' && !inAppGroup) {
      if (router.canDismiss()) router.dismissAll();
      router.replace('/(app)/home');
    } else if (status === 'unauthenticated' && inAppGroup) {
      if (router.canDismiss()) router.dismissAll();
      router.replace('/(auth)/login');
    }
  }, [status, segments, router]);

  if (configError) {
    return (
      <View className="flex-1 items-center justify-center bg-frost-900 px-8">
        <StatusBar style="light" />
        <Text className="text-3xl font-bold tracking-widest text-white">ELIZA</Text>
        <Text className="mt-6 text-center text-base font-semibold text-ice-400">
          Configuración incompleta
        </Text>
        <Text className="mt-3 text-center text-sm text-ice-100">{configError}</Text>
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}
