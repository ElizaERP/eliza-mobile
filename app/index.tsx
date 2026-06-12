import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/core/auth';

/** Splash: espera el bootstrap de sesión y redirige. */
export default function SplashScreen() {
  const status = useAuthStore((s) => s.status);
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') router.replace('/(app)/home');
    if (status === 'unauthenticated') router.replace('/(auth)/login');
  }, [status, router]);

  return (
    <View className="flex-1 items-center justify-center bg-frost-900">
      <Text className="text-4xl font-bold tracking-widest text-white">ELIZA</Text>
      <Text className="mt-2 text-sm text-ice-400">BCM Congelados</Text>
      <ActivityIndicator className="mt-8" color="#38BDF8" />
    </View>
  );
}
