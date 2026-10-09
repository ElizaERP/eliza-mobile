import { FlatList, Pressable, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuthStore } from '@/core/auth';
import { getVisibleModules, type ModuleDef } from '@/core/rbac/menu';

/**
 * Home: menú de módulos filtrado por los roles del JWT.
 */
export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const modules = getVisibleModules(user?.roles ?? []);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'ELIZA',
          headerBackVisible: false,
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(app)/profile')}
              className="h-9 w-9 items-center justify-center rounded-full bg-frost-700"
            >
              <Text className="text-sm font-bold text-white">
                {(user?.name ?? 'U').charAt(0).toUpperCase()}
              </Text>
            </Pressable>
          ),
        }}
      />
      <View className="flex-1 bg-snow px-5 pt-5">
        <Text className="text-lg text-graphite-600">Hola,</Text>
        <Text className="text-2xl font-bold text-graphite-900">{user?.name}</Text>

        {modules.length === 0 ? (
          <View className="mt-12 items-center rounded-2xl bg-ice-50 p-8">
            <Text className="text-center text-base text-graphite-600">
              Tu usuario no tiene módulos asignados. Pide al administrador del tenant que te
              asigne un rol operativo (por ejemplo Inventory.Operator o Sales.Manager).
            </Text>
          </View>
        ) : (
          <FlatList
            className="mt-6"
            data={modules}
            numColumns={2}
            columnWrapperClassName="gap-4"
            contentContainerClassName="gap-4 pb-8"
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => <ModuleCard module={item} />}
          />
        )}
      </View>
    </>
  );
}

function ModuleCard({ module }: { module: ModuleDef }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        module.id === 'catalogo'
          ? router.push('/(app)/catalogo')
          : module.id === 'inventario'
            ? router.push('/(app)/inventario')
            : module.id === 'produccion'
              ? router.push('/(app)/produccion')
              : module.id === 'ventas'
                ? router.push('/(app)/ventas')
                : router.push({ pathname: '/(app)/module/[id]', params: { id: module.id } })
      }
      className="min-h-36 flex-1 justify-between rounded-2xl border border-ice-100 bg-white p-4 active:bg-ice-50"
    >
      <Text className="text-3xl">{module.icon}</Text>
      <View>
        <Text className="text-base font-semibold text-graphite-900">{module.label}</Text>
        <Text className="mt-1 text-xs text-graphite-400" numberOfLines={2}>
          {module.description}
        </Text>
      </View>
    </Pressable>
  );
}
