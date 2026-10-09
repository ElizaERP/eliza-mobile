import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import type { ApiError } from '@/core/http/apiClient';
import { Badge } from '@/components/ui/Badge';
import { useProduct } from '@/features/catalog/hooks';
import { useLocationMap, useMovements, useStock } from '@/features/inventory/hooks';
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
 * Existencias de un producto (Sprint 9.3, solo lectura):
 * totales, lotes en orden FEFO con sus ubicaciones y movimientos recientes.
 */
export default function ProductStockScreen() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const id = productId ?? '';
  const product = useProduct(id);
  const stock = useStock(id);
  const movements = useMovements(id);
  const { map: locations } = useLocationMap();

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
      <Stack.Screen options={{ title: 'Existencias' }} />
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
                    {l.ubicaciones.map((u) => (
                      <Text key={u.locationId} className="mt-1 text-xs text-graphite-600">
                        📍 {locations.get(u.locationId)?.label ?? 'Ubicación'} — {qty(u.cantidadDisponible)} disp.
                        {u.cantidadReservada > 0 ? ` / ${qty(u.cantidadReservada)} res.` : ''}
                      </Text>
                    ))}
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
    </>
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
