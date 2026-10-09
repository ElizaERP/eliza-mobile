import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStore } from '@/core/auth';
import type { ApiError } from '@/core/http/apiClient';
import { canCreateSalesOrders } from '@/core/rbac/menu';
import { Badge } from '@/components/ui/Badge';
import { Card, Row, Section } from '@/components/ui/Section';
import { formatDateTime } from '@/features/inventory/labels';
import { AccionesPedido } from '@/features/sales/AccionesPedido';
import { useQuitarLinea, useSalesOrder } from '@/features/sales/hooks';
import { CONDICIONES_PAGO, ESTADO_PEDIDO, direccionTexto, money } from '@/features/sales/labels';

/**
 * Detalle de un pedido de venta: cliente, estado y fechas, entrega, líneas con IVA y totales.
 * Sprint 11: siguiente paso del ciclo (confirmar → reservar → despachar → cerrar, o cancelar)
 * y, en Borrador, quitar o agregar productos.
 */
export default function SalesOrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const roles = useAuthStore((s) => s.user?.roles) ?? [];
  const order = useSalesOrder(id ?? '');
  const quitar = useQuitarLinea(id ?? '');
  const o = order.data;
  const err = order.error as ApiError | null;
  const editable = o?.estado === 'Borrador' && canCreateSalesOrders(roles);

  const confirmarQuitar = (lineaId: string, nombre: string) =>
    Alert.alert('Quitar producto', `¿Quitar ${nombre} del pedido?`, [
      { text: 'Volver', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: () =>
          quitar.mutate(lineaId, {
            onError: (e) => Alert.alert('No se pudo quitar', (e as unknown as ApiError).message),
          }),
      },
    ]);

  return (
    <>
      <Stack.Screen options={{ title: 'Pedido' }} />
      <ScrollView
        className="flex-1 bg-snow"
        contentContainerClassName="p-5 pb-10"
        refreshControl={<RefreshControl refreshing={order.isRefetching} onRefresh={() => void order.refetch()} />}
      >
        {order.isLoading ? <ActivityIndicator className="mt-10" color="#0B3A53" /> : null}
        {err ? (
          <View className="rounded-2xl bg-danger/10 p-4">
            <Text className="text-sm font-semibold text-danger">No se pudo cargar el pedido</Text>
            <Text className="mt-1 text-sm text-graphite-600">
              {err.status ? `HTTP ${err.status} · ` : ''}
              {err.message}
            </Text>
          </View>
        ) : null}

        {o ? (
          <>
            <Text className="text-xl font-bold text-graphite-900">{o.cliente.razonSocial}</Text>
            <Text className="mt-1 text-xs text-graphite-400">
              {o.codigo} · cliente {o.cliente.codigo}
            </Text>
            <View className="mt-3 flex-row flex-wrap gap-2">
              <Badge label={ESTADO_PEDIDO[o.estado].label} tone={ESTADO_PEDIDO[o.estado].tone} />
              <Badge label={CONDICIONES_PAGO[o.condicionesPago]} tone="info" />
            </View>

            {o.estado === 'Cancelada' && o.canceladoMotivo ? (
              <View className="mt-4 rounded-2xl bg-graphite-400/15 p-4">
                <Text className="text-sm font-semibold text-graphite-900">Cancelado</Text>
                <Text className="mt-1 text-sm text-graphite-600">{o.canceladoMotivo}</Text>
              </View>
            ) : null}

            <Card className="mt-4">
              <Text className="text-xs text-graphite-400">Total del pedido</Text>
              <Text className="text-3xl font-bold text-frost-900">{money(o.total)}</Text>
              <View className="mt-2">
                <Row label="Subtotal" value={money(o.subtotal)} />
                <Row label="IVA" value={money(o.ivaTotal)} />
              </View>
            </Card>

            <AccionesPedido pedido={o} roles={roles} />

            <Section title={o.lineas.length === 1 ? '1 línea' : `${o.lineas.length} líneas`}>
              {o.lineas.length === 0 ? (
                <Text className="text-sm text-graphite-600">El pedido todavía no tiene líneas.</Text>
              ) : (
                o.lineas.map((l) => (
                  <View key={l.id} className="mb-3 rounded-2xl border border-ice-100 bg-white p-4">
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1">
                        <Text className="text-base font-semibold text-graphite-900">{l.productName}</Text>
                        <Text className="text-xs text-graphite-400">{l.productCode}</Text>
                      </View>
                      <Text className="text-base font-bold text-graphite-900">{money(l.total)}</Text>
                    </View>
                    <Text className="mt-2 text-sm text-graphite-600">
                      {l.cantidad.toLocaleString('es-CO')} × {money(l.precioUnitario)} = {money(l.subtotal)}
                    </Text>
                    <Text className="text-xs text-graphite-400">
                      IVA {l.tasaIva.toLocaleString('es-CO')} %: {money(l.iva)}
                    </Text>
                    {l.notas ? <Text className="mt-1 text-xs text-graphite-600">{l.notas}</Text> : null}
                    {editable ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Quitar ${l.productName}`}
                        disabled={quitar.isPending}
                        onPress={() => confirmarQuitar(l.id, l.productName)}
                        className="mt-2 self-end"
                      >
                        <Text className="text-sm font-medium text-danger">Quitar</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))
              )}
              {editable ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/(app)/ventas/agregar/[id]', params: { id: o.id } })}
                  className="min-h-11 flex-row items-center justify-center rounded-2xl border border-dashed border-frost-700 bg-white"
                >
                  <Text className="text-sm font-semibold text-frost-900">+ Agregar productos</Text>
                </Pressable>
              ) : null}
            </Section>

            <Section title="Fechas">
              <Card>
                <Row label="Creado" value={formatDateTime(o.createdAt)} />
                {o.confirmadoEn ? <Row label="Confirmado" value={formatDateTime(o.confirmadoEn)} /> : null}
                {o.reservadoEn ? <Row label="Reservado" value={formatDateTime(o.reservadoEn)} /> : null}
                {o.despachadoEn ? <Row label="Despachado" value={formatDateTime(o.despachadoEn)} /> : null}
                {o.cerradoEn ? <Row label="Cerrado" value={formatDateTime(o.cerradoEn)} /> : null}
                {o.canceladoEn ? <Row label="Cancelado" value={formatDateTime(o.canceladoEn)} /> : null}
              </Card>
            </Section>

            <Section title="Entrega">
              <Card>
                <Text className="text-sm text-graphite-900">{direccionTexto(o.direccionEntrega)}</Text>
                {o.direccionEntrega.telefono ? (
                  <Text className="mt-1 text-sm text-graphite-600">Tel. {o.direccionEntrega.telefono}</Text>
                ) : null}
                {o.direccionEntrega.notas ? (
                  <Text className="mt-1 text-xs text-graphite-600">{o.direccionEntrega.notas}</Text>
                ) : null}
              </Card>
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
