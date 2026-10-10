import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { Stack } from 'expo-router';
import { signOut, useAuthStore } from '@/core/auth';
import { Button } from '@/components/ui/Button';
import { InfoRow } from '@/components/ui/InfoRow';
import { BackendStatus } from '@/components/BackendStatus';
import { buscarActualizacionAhora, infoVersion } from '@/core/updates/useActualizaciones';

/**
 * Perfil: muestra los claims del token (verificación visual de que
 * tenant_id y roles llegan correctamente), prueba de conexión con el
 * backend (API lista + token aceptado) y cierre de sesión.
 * Versión: la del APK y, si llegó una actualización por aire, cuál.
 */
export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const [busy, setBusy] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const version = infoVersion();

  const buscar = async () => {
    setBuscando(true);
    const r = await buscarActualizacionAhora();
    setBuscando(false);
    if (r === 'descargada') {
      Alert.alert('Actualización lista', 'Se descargó una versión nueva. ¿Reiniciar ahora?', [
        { text: 'Más tarde', style: 'cancel' },
        { text: 'Reiniciar', onPress: () => void Updates.reloadAsync() },
      ]);
    } else {
      Alert.alert(
        'Actualizaciones',
        r === 'al_dia' ? 'Ya tienes la última versión.' : r === 'desarrollo' ? 'En modo desarrollo no hay actualizaciones por aire.' : 'No se pudo revisar. Intenta con conexión.',
      );
    }
  };

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

        <BackendStatus />

        <View className="mt-4 rounded-2xl border border-ice-100 bg-white p-5">
          <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-graphite-400">Versión</Text>
          <InfoRow label="App" value={Constants.expoConfig?.version ?? '—'} />
          <InfoRow label="Canal" value={version.canal} />
          <InfoRow
            label="Actualización"
            value={
              version.actualizacion
                ? `${version.actualizacion.id}${version.actualizacion.fecha ? ` · ${version.actualizacion.fecha.toLocaleString('es-CO')}` : ''}`
                : 'La del APK'
            }
          />
          <View className="mt-3">
            <Button label="Buscar actualización" variant="ghost" onPress={() => void buscar()} loading={buscando} />
          </View>
        </View>

        <View className="my-6">
          <Button label="Cerrar sesión" variant="danger" onPress={() => void handleSignOut()} loading={busy} />
        </View>
      </ScrollView>
    </>
  );
}
