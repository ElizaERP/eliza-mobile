import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuthStore } from '@/core/auth';
import type { ApiError } from '@/core/http/apiClient';
import { canManageProduction } from '@/core/rbac/menu';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import type { EstadoOrden, OrdenListItem } from '@/features/production/api';
import { useOrderList } from '@/features/production/hooks';
import { ESTADO_FILTERS, ESTADO_ORDEN, PRIORIDAD, num, progress } from '@/features/production/labels';
import { formatDate } from '@/features/inventory/labels';

/**
 * Producción — órdenes de producción (más recientes primero).
 * Sprint 12: "+ Nueva" para crear órdenes (equipo de producción y admin).
 */
export default function ProductionListScreen() {
  const router = useRouter();
  const puedeCrear = canManageProduction(useAuthStore((s) => s.user?.roles) ?? []);
  const [estado, setEstado] = useState<EstadoOrden | 'all'>('all');
  const list = useOrderList(estado);
  const items: OrdenListItem[] = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data]);
  const total = list.data?.pages[0]?.total ?? 0;
  const error = list.error as ApiError | null;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Producción',
          headerRight: puedeCrear
            ? () => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Nueva orden de producción"
                  onPress={() => router.push('/(app)/produccion/nueva')}
                  className="min-h-9 flex-row items-center rounded-full bg-white px-4"
                >
                  <Text className="text-sm font-semibold text-frost-900">+ Nueva</Text>
                </Pressable>
              )
            : undefined,
        }}
      />
      <View className="flex-1 bg-snow">
        <FlatList
          data={items}
          keyExtractor={(o) => o.id}
          contentContainerClassName="gap-3 px-5 pb-8 pt-4"
          ListHeaderComponent={
            <View className="mb-1">
              <View className="flex-row flex-wrap gap-2">
                {ESTADO_FILTERS.map((f) => {
                  const selected = f.key === estado;
                  return (
                    <Pressable
                      key={f.key}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => setEstado(f.key)}
                      className={`min-h-9 justify-center rounded-full px-4 ${selected ? 'bg-frost-900' : 'border border-ice-100 bg-white'}`}
                    >
                      <Text className={`text-sm font-medium ${selected ? 'text-white' : 'text-graphite-600'}`}>
                        {f.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {!list.isLoading && !error ? (
                <Text className="mt-3 text-xs text-graphite-400">
                  {total === 1 ? '1 orden' : `${total} órdenes`}
                </Text>
              ) : null}
              {error ? (
                <View className="mt-4 rounded-2xl bg-danger/10 p-4">
                  <Text className="text-sm font-semibold text-danger">No se pudieron cargar las órdenes</Text>
                  <Text className="mt-1 text-sm text-graphite-600">
                    {error.status ? `HTTP ${error.status} · ` : ''}
                    {error.message}
                  </Text>
                </View>
              ) : null}
            </View>
          }
          renderItem={({ item }) => <OrderRow order={item} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
          }}
          refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} />}
          ListEmptyComponent={
            list.isLoading ? (
              <ActivityIndicator className="mt-12" color="#0B3A53" />
            ) : !error ? (
              <Text className="mt-12 text-center text-sm text-graphite-600">No hay órdenes con este estado.</Text>
            ) : null
          }
          ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator className="my-4" color="#0B3A53" /> : null}
        />
      </View>
    </>
  );
}

function OrderRow({ order }: { order: OrdenListItem }) {
  const router = useRouter();
  const estado = ESTADO_ORDEN[order.estado];
  const prioridad = PRIORIDAD[order.prioridad];
  const p = progress(order.cantidadRealProducida, order.cantidadObjetivo);
  const muted = order.estado === 'Cancelada';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/(app)/produccion/[id]', params: { id: order.id } })}
      className="rounded-2xl border border-ice-100 bg-white p-4 active:bg-ice-50"
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className={`text-base font-semibold ${muted ? 'text-graphite-400' : 'text-graphite-900'}`} numberOfLines={2}>
            {order.productoTerminadoName}
          </Text>
          <Text className="mt-1 text-xs text-graphite-400">{order.codigo}</Text>
        </View>
        <Badge label={estado.label} tone={estado.tone} />
      </View>

      <View className="mt-3">
        <View className="mb-1 flex-row justify-between">
          <Text className="text-xs text-graphite-600">
            Producido <Text className="font-bold text-graphite-900">{num(order.cantidadRealProducida)}</Text> de{' '}
            {num(order.cantidadObjetivo)}
          </Text>
          <Text className="text-xs text-graphite-400">{Math.round(p * 100)} %</Text>
        </View>
        <ProgressBar value={p} muted={muted} />
      </View>

      <View className="mt-3 flex-row flex-wrap items-center gap-2">
        {order.estado !== 'Cancelada' && order.estado !== 'Cerrada' ? (
          <Badge label={prioridad.label} tone={prioridad.tone} />
        ) : null}
        {order.fechaProgramada ? (
          <Text className="text-xs text-graphite-400">Programada {formatDate(order.fechaProgramada)}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}
