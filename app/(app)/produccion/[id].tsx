import type { ReactNode } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import type { ApiError } from '@/core/http/apiClient';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useOrder } from '@/features/production/hooks';
import { ESTADO_ORDEN, PRIORIDAD, num, progress } from '@/features/production/labels';
import { formatDate, formatDateTime } from '@/features/inventory/labels';
import { useLocationMap } from '@/features/inventory/hooks';
import { useProductsByIds } from '@/features/catalog/hooks';

/**
 * Detalle de una orden de producción (Sprint 9.4, solo lectura):
 * avance, fechas, materias primas (requerido vs consumido), consumos con su lote
 * y lotes de producto terminado generados.
 */
export default function ProductionOrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useOrder(id ?? '');
  const { map: locations } = useLocationMap();
  const o = order.data;
  const err = order.error as ApiError | null;
  const legacyIds = (o?.componentes ?? [])
    .filter((c) => c.productName === c.productId || c.productCode === c.productId)
    .map((c) => c.productId);
  const legacyQueries = useProductsByIds(legacyIds);
  const componentProducts = new Map(
    legacyIds.map((pid, i) => [pid, legacyQueries[i]?.data] as const).filter(([, p]) => p !== undefined),
  );

  const consumidoPor = new Map<string, number>();
  for (const c of o?.consumos ?? []) consumidoPor.set(c.productId, (consumidoPor.get(c.productId) ?? 0) + c.cantidad);
  const muted = o?.estado === 'Cancelada';

  return (
    <>
      <Stack.Screen options={{ title: 'Orden de producción' }} />
      <ScrollView
        className="flex-1 bg-snow"
        contentContainerClassName="p-5 pb-10"
        refreshControl={<RefreshControl refreshing={order.isRefetching} onRefresh={() => void order.refetch()} />}
      >
        {order.isLoading ? <ActivityIndicator className="mt-10" color="#0B3A53" /> : null}
        {err ? (
          <View className="rounded-2xl bg-danger/10 p-4">
            <Text className="text-sm font-semibold text-danger">No se pudo cargar la orden</Text>
            <Text className="mt-1 text-sm text-graphite-600">
              {err.status ? `HTTP ${err.status} · ` : ''}
              {err.message}
            </Text>
          </View>
        ) : null}

        {o ? (
          <>
            <Text className="text-xl font-bold text-graphite-900">{o.productoTerminado.name}</Text>
            <Text className="mt-1 text-xs text-graphite-400">
              {o.codigo} · {o.productoTerminado.code}
            </Text>
            <View className="mt-3 flex-row flex-wrap gap-2">
              <Badge label={ESTADO_ORDEN[o.estado].label} tone={ESTADO_ORDEN[o.estado].tone} />
              <Badge label={PRIORIDAD[o.prioridad].label} tone={PRIORIDAD[o.prioridad].tone} />
              {o.estado === 'Planificada' ? (
                <Badge
                  label={o.materialesReservados ? 'Materiales reservados' : 'Sin reservar materiales'}
                  tone={o.materialesReservados ? 'ok' : 'neutral'}
                />
              ) : null}
            </View>

            {o.estado === 'Cancelada' && o.canceladoMotivo ? (
              <View className="mt-4 rounded-2xl bg-graphite-400/15 p-4">
                <Text className="text-sm font-semibold text-graphite-900">Cancelada</Text>
                <Text className="mt-1 text-sm text-graphite-600">{o.canceladoMotivo}</Text>
              </View>
            ) : null}

            <Card className="mt-4">
              <View className="mb-2 flex-row items-end justify-between">
                <View>
                  <Text className="text-xs text-graphite-400">Producido</Text>
                  <Text className="text-2xl font-bold text-graphite-900">
                    {num(o.cantidadRealProducida)}
                    <Text className="text-base font-normal text-graphite-400"> de {num(o.cantidadObjetivo)}</Text>
                  </Text>
                </View>
                <Text className="text-sm text-graphite-600">
                  {Math.round(progress(o.cantidadRealProducida, o.cantidadObjetivo) * 100)} %
                </Text>
              </View>
              <ProgressBar value={progress(o.cantidadRealProducida, o.cantidadObjetivo)} muted={muted} />
            </Card>

            <Section title="Fechas">
              <Card>
                <Row label="Programada" value={o.fechaProgramada ? formatDate(o.fechaProgramada) : '—'} />
                <Row label="Creada" value={formatDateTime(o.createdAt)} />
                {o.iniciadoEn ? <Row label="Iniciada" value={formatDateTime(o.iniciadoEn)} /> : null}
                {o.completadoEn ? <Row label="Completada" value={formatDateTime(o.completadoEn)} /> : null}
                {o.cerradoEn ? <Row label="Cerrada" value={formatDateTime(o.cerradoEn)} /> : null}
                {o.canceladoEn ? <Row label="Cancelada" value={formatDateTime(o.canceladoEn)} /> : null}
              </Card>
            </Section>

            <Section title="Materias primas">
              {o.componentes.length === 0 ? (
                <Text className="text-sm text-graphite-600">La orden no tiene componentes.</Text>
              ) : (
                o.componentes.map((c, i) => {
                  const consumido = consumidoPor.get(c.productId) ?? 0;
                  // Órdenes antiguas: el snapshot guardó el id en lugar del código/nombre → se toma del Catálogo
                  const legacy = c.productName === c.productId || c.productCode === c.productId;
                  const catalogProduct = legacy ? componentProducts.get(c.productId) : undefined;
                  const name = legacy ? (catalogProduct?.name ?? 'Materia prima') : c.productName;
                  const code = legacy ? (catalogProduct?.code ?? '') : c.productCode;
                  const sinCantidad = !Number.isFinite(c.cantidadTotalRequerida);
                  return (
                    <View key={`${c.productId}-${i}`} className="mb-3 rounded-2xl border border-ice-100 bg-white p-4">
                      <Text className="text-base font-semibold text-graphite-900">{name}</Text>
                      <Text className="text-xs text-graphite-400">
                        {[code, sinCantidad ? null : `${num(c.cantidadPorUnidad)} ${c.unidadMedida} por unidad`]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                      {sinCantidad ? (
                        <Text className="mt-3 text-xs text-graphite-600">
                          Cantidad no registrada: la orden se creó antes de corregir la copia de la receta.
                        </Text>
                      ) : (
                        <>
                          <View className="mb-1 mt-3 flex-row justify-between">
                            <Text className="text-xs text-graphite-600">
                              Consumido <Text className="font-bold text-graphite-900">{num(consumido)}</Text> de{' '}
                              {num(c.cantidadTotalRequerida)} {c.unidadMedida}
                            </Text>
                          </View>
                          <ProgressBar value={progress(consumido, c.cantidadTotalRequerida)} muted={muted} />
                        </>
                      )}
                    </View>
                  );
                })
              )}
            </Section>

            <Section title="Consumos registrados">
              {o.consumos.length === 0 ? (
                <Text className="text-sm text-graphite-600">Todavía no hay consumos.</Text>
              ) : (
                <View className="rounded-2xl border border-ice-100 bg-white px-4">
                  {o.consumos.map((c) => (
                    <View key={c.id} className="flex-row items-start justify-between border-b border-ice-100 py-3">
                      <View className="flex-1 pr-3">
                        <Text className="text-sm font-medium text-graphite-900">{c.productCode}</Text>
                        <Text className="text-xs text-graphite-400">
                          Lote {c.codigoLote} · {formatDateTime(c.consumidoEn)}
                        </Text>
                      </View>
                      <Text className="text-sm font-bold text-danger">
                        −{num(c.cantidad)} {c.unidadMedida}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </Section>

            <Section title="Lotes producidos">
              {o.lotesProducidos.length === 0 ? (
                <Text className="text-sm text-graphite-600">Todavía no hay lotes producidos.</Text>
              ) : (
                o.lotesProducidos.map((l) => (
                  <View key={l.id} className="mb-3 rounded-2xl border border-ice-100 bg-white p-4">
                    <View className="flex-row items-start justify-between gap-3">
                      <Text className="flex-1 text-base font-semibold text-graphite-900">Lote {l.codigoLote}</Text>
                      <Text className="text-base font-bold text-ok">+{num(l.cantidad)}</Text>
                    </View>
                    <Text className="mt-1 text-xs text-graphite-400">{formatDateTime(l.producidoEn)}</Text>
                    <Text className="mt-1 text-xs text-graphite-600">
                      📍 {locations.get(l.locationId)?.label ?? 'Ubicación'}
                    </Text>
                  </View>
                ))
              )}
            </Section>

            {o.notas ? (
              <Section title="Notas">
                <Card>
                  <Text className="text-sm text-graphite-600">{o.notas}</Text>
                </Card>
              </Section>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="mt-6">
      <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-graphite-400">{title}</Text>
      {children}
    </View>
  );
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <View className={`rounded-2xl border border-ice-100 bg-white p-4 ${className}`}>{children}</View>;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-1">
      <Text className="text-sm text-graphite-600">{label}</Text>
      <Text className="text-sm font-medium text-graphite-900">{value}</Text>
    </View>
  );
}
