import { Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { MODULES, type ModuleId } from '@/core/rbac/menu';

/**
 * Placeholder de módulo: cada uno se implementa en su sub-sprint
 * (9.2 Catálogo · 9.3 Inventario · 9.4 Producción · 9.5 Ventas).
 */
export default function ModulePlaceholderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const moduleDef = MODULES[id as ModuleId];

  return (
    <>
      <Stack.Screen options={{ title: moduleDef?.label ?? 'Módulo' }} />
      <View className="flex-1 items-center justify-center bg-snow px-8">
        <Text className="text-5xl">{moduleDef?.icon ?? '📦'}</Text>
        <Text className="mt-4 text-xl font-bold text-graphite-900">{moduleDef?.label}</Text>
        <Text className="mt-2 text-center text-sm text-graphite-600">
          {moduleDef?.description}
        </Text>
        <View className="mt-6 rounded-full bg-ice-100 px-4 py-2">
          <Text className="text-xs font-semibold text-frost-700">
            Disponible en Sprint {moduleDef?.sprint ?? '9.x'}
          </Text>
        </View>
      </View>
    </>
  );
}
