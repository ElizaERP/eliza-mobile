import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { signOut, useAuthStore } from '@/core/auth';
import { Button } from '@/components/ui/Button';
import { InfoRow } from '@/components/ui/InfoRow';

/**
 * Perfil: muestra los claims del token (verificación visual de que
 * tenant_id y roles llegan correctamente) + cierre de sesión.
 */
export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const [busy, setBusy] = useState(false);

  const handleSignOut = async () => {
    setBusy(true);
    await signOut();
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Mi perfil' }} />
      <ScrollView className="flex-1 bg-snow px-5 pt-5">
        <View className="rounded-2xl border border-ice-100 bg-white p-5">
          <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-graphite-400">
            Sesión
          </Text>
          <InfoRow label="Nombre" value={user?.name ?? '—'} />
          <InfoRow label="Usuario" value={user?.username ?? '—'} />
          <InfoRow label="Email" value={user?.email ?? '—'} />
        </View>

        <View className="mt-4 rounded-2xl border border-ice-100 bg-white p-5">
          <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-graphite-400">
            Contexto multi-tenant (claims del JWT)
          </Text>
          <InfoRow label="Tenant" value={user?.tenantId ?? '⚠️ sin tenant_id'} />
          <InfoRow label="Planta" value={user?.plantId ?? '—'} />
          <InfoRow label="Bodega" value={user?.warehouseId ?? '—'} />
          <InfoRow label="Roles" value={user?.roles.length ? user.roles.join(', ') : '⚠️ sin roles'} />
        </View>

        <View className="my-6">
          <Button label="Cerrar sesión" variant="danger" onPress={() => void handleSignOut()} loading={busy} />
        </View>
      </ScrollView>
    </>
  );
}
