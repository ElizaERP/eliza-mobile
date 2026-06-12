import '../global.css';

import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/core/query/queryClient';
import { bootstrapSession, useAuthStore } from '@/core/auth';

/**
 * Layout raíz: providers + guard de autenticación.
 * Mientras status === 'loading' se muestra el splash (app/index.tsx).
 */
export default function RootLayout() {
  const status = useAuthStore((s) => s.status);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    void bootstrapSession();
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    const inAppGroup = segments[0] === '(app)';
    if (status === 'authenticated' && !inAppGroup) {
      router.replace('/(app)/home');
    } else if (status === 'unauthenticated' && inAppGroup) {
      router.replace('/(auth)/login');
    }
  }, [status, segments, router]);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}
