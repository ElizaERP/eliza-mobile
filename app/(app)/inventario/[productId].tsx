import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStore } from '@/core/auth';
import type { ApiError } from '@/core/http/apiClient';
import { canBlockLots, canManageInventory } from '@/core/rbac/menu';
import { Badge } from '@/components/ui/Badge';
import { CancelarModal } from '@/components/ui/CancelarModal';
import { useProduct } from '@/features/catalog/hooks';
import type { StockByLot } from '@/features/inventory/api';
import { useEstadoLote, useLocationMap, useMovements, useStock } from '@/features/inventory/hooks';
import {
  LOTE_ESTADO,
  MOVIMIENTO,
  daysUntil,
  expiryText,
  formatDate,
  formatDateTime,
  qty,
} from '@/features/inventory/labels';

/**
 * Existencias de un producto (Sprint 9.3): totales, lotes en orden FEFO con sus
 * ubicaciones y movimientos recientes.
 * Sprint 13: Recibir, y por ubicación Contar / Mover; por lote Bloquear / Liberar.
 * Los botones se muestran según el rol; la autorización real la hace el backend.
 */
export default function ProductStockScreen() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const id = productId ?? '';
  const product = useProduct(id);
  const stock = useStock(id);
  const movements = useMovements(id);
  const { map: locations } = useLocationMap();
  const router = useRouter();
  const roles = useAuthStore((st) => st.user?.roles) ?? [];
  const gestiona = canManageInventory(roles);
  const bloquea = canBlockLots(roles);
  const estadoLote = useEstadoLote();
  const [bloqueando, setBloqueando] = useState<StockByLot | null>(null);

  const liberar = (l: StockByLot) =>
    Alert.alert('Liberar lote', `El lote ${l.codigoLote} vuelve a estar disponible para pedidos y producción.`, [
      { text: 'Volver', style: 'cancel' },
      {
        text: 'Liberar',
        onPress: () =>
          estadoLote.mutate(
            { loteId: l.loteId, accion: 'liberar' },
            {
              onSuccess: () => Alert.alert('Listo', `Lote ${l.codigoLote} liberado.`),
              onError: (e) => Alert.alert('No se pudo liberar', (e as unknown as ApiError).message),
            },
          ),
      },
    ]);

  const s = stock.data;
  const allLots = s ? [...s.porLote].sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento)) : [];
  // Lotes agotados (sin disponible, reservado ni bloqueado) no aportan al operario: se ocultan.
  // El mapa de códigos usa TODOS los lotes para que los movimientos viejos sigan mostrando su lote.
  const lots = allLots.filter((l) => l.cantidadDisponible + l.cantidadReservada + l.cantidadBloqueada > 0);
  const hiddenLots = allLots.length - lots.length;
  const lotCode = new Map(allLots.map((l) => [l.loteId, l.codigoLote]));
  const err = stock.error as ApiError | null;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Existencias',
          headerRight: gestiona
            ? () => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Recibir mercancía de este producto"
                  onPress={() => router.push({ pathname: '/(app)/inventario/recibir', params: { productId: id } })}
                  className="min-h-9 flex-row items-center rounded-full bg-white px-4"
                >
                  <Text className="text-sm font-semibold text-frost-900">+ Recibir</Text>
                </Pressable>
              )
            : undefined,
        }}
      />
      <ScrollView
        className="flex-1 bg-snow"
        contentContainerClassName="p-5 pb-10"
        refreshControl={
          <RefreshControl
            refreshing={stock.isRefetching || movements.isRefetching}
            onRefresh={() => {
              void stock.refetch();
              void movements.refetch();
            }}
          />
        }
      >
        <Text className="text-xl font-bold text-graphite-900">{product.data?.name ?? 'Producto'}</Text>
        {product.data ? <Text className="mt-1 text-xs text-graphite-400">{product.data.code}</Text> : null}

        {stock.isLoading ? <ActivityIndicator className="mt-10" color="#0B3A53" /> : null}
        {err ? (
          <View className="mt-4 rounded-2xl bg-danger/10 p-4">
            <Text className="text-sm font-semibold text-danger">No se pudieron cargar las existencias</Text>
            <Text className="mt-1 text-sm text-graphite-600">
              {err.status ? `HTTP ${err.status} · ` : ''}
              {err.message}
            </Text>
          </View>
        ) : null}

        {s ? (
          <>
            <View className="mt-4 flex-row flex-wrap gap-3">
              <Total label="Disponible" value={s.totalDisponible} strong />
              <Total label="Reservado" value={s.totalReservado} />
              <Total label="Bloqueado" value={s.totalBloqueado} />
              <Total label="Físico" value={s.totalFisico} />
            </View>

            <Text className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-graphite-400">
              Lotes (primero el que vence antes)
            </Text>
            {lots.length === 0 ? (
              <Text className="text-sm text-graphite-600">No hay lotes con existencias.</Text>
            ) : (
              lots.map((l) => {
                const estado = LOTE_ESTADO[l.estado];
                const exp = expiryText(daysUntil(l.fechaVencimiento));
                return (
                  <View key={l.loteId} className="mb-3 rounded-2xl border border-ice-100 bg-white p-4">
                    <View className="flex-row items-start justify-between gap-3">
                      <Text className="flex-1 text-base font-semibold text-graphite-900">Lote {l.codigoLote}</Text>
                      <Badge label={estado.label} tone={estado.tone} />
                    </View>
                    <View className="mt-1 flex-row items-center gap-2">
                      <Text className="text-xs text-graphite-400">Vence {formatDate(l.fechaVencimiento)}</Text>
                      <Badge label={exp.text} tone={exp.tone} />
                    </View>
                    <Text className="mt-3 text-sm text-graphite-900">
                      Disponible <Text className="font-bold">{qty(l.cantidadDisponible)}</Text>
                      {l.cantidadReservada > 0 ? ` · Reservado ${qty(l.cantidadReservada)}` : ''}
                      {l.cantidadBloqueada > 0 ? ` · Bloqueado ${qty(l.cantidadBloqueada)}` : ''}
                    </Text>
                    {!l.reservable ? (
                      <Text className="mt-1 text-xs text-warn">No se puede reservar para pedidos ni producción.</Text>
                    ) : null}
                    {l.ubicaciones.map((u) => {
                      const fisico = u.cantidadDisponible + u.cantidadReservada + u.cantidadBloqueada;
                      return (
                        <View key={u.existenciaId} className="mt-2 flex-row items-center justify-between gap-2">
                          <Text className="flex-1 text-xs text-graphite-600">
                            📍 {locations.get(u.locationId)?.label ?? 'Ubicación'} — {qty(u.cantidadDisponible)} disp.
                            {u.cantidadReservada > 0 ? ` / ${qty(u.cantidadReservada)} res.` : ''}
                          </Text>
                          {gestiona && fisico > 0 ? (
                            <View className="flex-row gap-2">
                              <Chico
                                label="Contar"
                                onPress={() =>
                                  router.push({ pathname: '/(app)/inventario/contar', params: { productId: id, existenciaId: u.existenciaId } })
                                }
                              />
                              {u.cantidadDisponible > 0 ? (
                                <Chico
                                  label="Mover"
                                  onPress={() =>
                                    router.push({ pathname: '/(app)/inventario/mover', params: { productId: id, existenciaId: u.existenciaId } })
                                  }
                                />
                              ) : null}
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                    {bloquea && (l.estado === 'Disponible' || l.estado === 'Cuarentena') ? (
                      <Pressable
                        accessibilityRole="button"
                        disabled={estadoLote.isPending}
                        onPress={() => setBloqueando(l)}
                        className="mt-3 min-h-10 items-center justify-center rounded-xl border border-danger/40"
                      >
                        <Text className="text-sm font-semibold text-danger">Bloquear lote</Text>
                      </Pressable>
                    ) : null}
                    {bloquea && (l.estado === 'Bloqueado' || l.estado === 'Cuarentena') ? (
                      <Pressable
                        accessibilityRole="button"
                        disabled={estadoLote.isPending}
                        onPress={() => liberar(l)}
                        className="mt-2 min-h-10 items-center justify-center rounded-xl border border-frost-700"
                      >
                        <Text className="text-sm font-semibold text-frost-900">Liberar lote</Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })
            )}
            {hiddenLots > 0 ? (
              <Text className="text-xs text-graphite-400">
                {hiddenLots === 1 ? '1 lote agotado oculto.' : `${hiddenLots} lotes agotados ocultos.`}
              </Text>
            ) : null}
          </>
        ) : null}

        <Text className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-graphite-400">
          Movimientos recientes
        </Text>
        {movements.isLoading ? (
          <ActivityIndicator color="#0B3A53" />
        ) : (movements.data?.items.length ?? 0) === 0 ? (
          <Text className="text-sm text-graphite-600">Sin movimientos.</Text>
        ) : (
          <View className="rounded-2xl border border-ice-100 bg-white px-4">
            {movements.data!.items.map((m) => {
              const t = MOVIMIENTO[m.tipo];
              const sign = t.sign > 0 ? '+' : t.sign < 0 ? '−' : '';
              const color = t.sign > 0 ? 'text-ok' : t.sign < 0 ? 'text-danger' : 'text-graphite-600';
              return (
                <View key={m.id} className="flex-row items-start justify-between border-b border-ice-100 py-3">
                  <View className="flex-1 pr-3">
                    <Text className="text-sm font-medium text-graphite-900">{t.label}</Text>
                    <Text className="text-xs text-graphite-400">
                      {formatDateTime(m.ocurridoEn)} · {m.referenciaTipo}
                      {m.loteId && lotCode.get(m.loteId) ? ` · Lote ${lotCode.get(m.loteId)}` : ''}
                    </Text>
                    {m.motivo ? <Text className="text-xs text-graphite-600">{m.motivo}</Text> : null}
                  </View>
                  <Text className={`text-sm font-bold ${color}`}>
                    {sign}
                    {qty(m.cantidad)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
        {movements.data && movements.data.total > movements.data.items.length ? (
          <Text className="mt-2 text-xs text-graphite-400">
            Mostrando {movements.data.items.length} de {movements.data.total}.
          </Text>
        ) : null}
      </ScrollView>

      {bloqueando ? (
        <CancelarModal
          titulo={`Bloquear lote ${bloqueando.codigoLote}`}
          aviso={`No se podrá reservar para pedidos ni producción hasta liberarlo.${bloqueando.cantidadReservada > 0 ? ` Ojo: ya tiene ${qty(bloqueando.cantidadReservada)} reservadas; esas reservas siguen activas.` : ''}`}
          placeholder="Ej.: muestra con humedad, cadena de frío rota"
          boton="Bloquear"
          enviando={estadoLote.isPending}
          onClose={() => setBloqueando(null)}
          onConfirm={(motivo) =>
            estadoLote.mutate(
              { loteId: bloqueando.loteId, accion: 'bloquear', motivo },
              {
                onSuccess: () => {
                  setBloqueando(null);
                  Alert.alert('Listo', `Lote ${bloqueando.codigoLote} bloqueado.`);
                },
                onError: (e) => Alert.alert('No se pudo bloquear', (e as unknown as ApiError).message),
              },
            )
          }
        />
      ) : null}
    </>
  );
}

function Chico({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-8 justify-center rounded-full border border-frost-700 bg-white px-3"
    >
      <Text className="text-xs font-semibold text-frost-900">{label}</Text>
    </Pressable>
  );
}

function Total({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <View className={`min-w-[46%] flex-1 rounded-2xl border p-4 ${strong ? 'border-frost-700 bg-frost-900' : 'border-ice-100 bg-white'}`}>
      <Text className={`text-xs ${strong ? 'text-ice-100' : 'text-graphite-400'}`}>{label}</Text>
      <Text className={`mt-1 text-2xl font-bold ${strong ? 'text-white' : 'text-graphite-900'}`}>{qty(value)}</Text>
    </View>
  );
}
