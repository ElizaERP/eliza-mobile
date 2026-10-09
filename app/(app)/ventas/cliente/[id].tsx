import { useMemo } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import type { ApiError } from '@/core/http/apiClient';
import { Badge } from '@/components/ui/Badge';
import { Card, Row, Section } from '@/components/ui/Section';
import { useCustomer, useSalesOrderList } from '@/features/sales/hooks';
import { CONDICIONES_PAGO, ESTADO_CLIENTE, direccionTexto } from '@/features/sales/labels';
import { PedidoRow } from '@/features/sales/PedidoRow';

/**
 * Ficha de un cliente (Sprint 9.5, solo lectura): datos, direcciones, contacto
 * y sus pedidos más recientes.
 */
export default function CustomerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const customer = useCustomer(id ?? '');
  const orders = useSalesOrderList('all', id);
  const c = customer.data;
  const err = customer.error as ApiError | null;
  const pedidos = useMemo(() => orders.data?.pages.flatMap((p) => p.items) ?? [], [orders.data]);
  const totalPedidos = orders.data?.pages[0]?.total ?? 0;
  const RECIENTES = 10;

  return (
    <>
      <Stack.Screen options={{ title: 'Cliente' }} />
      <ScrollView
        className="flex-1 bg-snow"
        contentContainerClassName="p-5 pb-10"
        refreshControl={
          <RefreshControl
            refreshing={customer.isRefetching || orders.isRefetching}
            onRefresh={() => {
              void customer.refetch();
              void orders.refetch();
            }}
          />
        }
      >
        {customer.isLoading ? <ActivityIndicator className="mt-10" color="#0B3A53" /> : null}
        {err ? (
          <View className="rounded-2xl bg-danger/10 p-4">
            <Text className="text-sm font-semibold text-danger">No se pudo cargar el cliente</Text>
            <Text className="mt-1 text-sm text-graphite-600">
              {err.status ? `HTTP ${err.status} · ` : ''}
              {err.message}
            </Text>
          </View>
        ) : null}

        {c ? (
          <>
            <Text className="text-xl font-bold text-graphite-900">{c.razonSocial}</Text>
            {c.nombreComercial ? <Text className="text-base text-graphite-600">{c.nombreComercial}</Text> : null}
            <Text className="mt-1 text-xs text-graphite-400">
              NIT {c.nit} · {c.codigo}
            </Text>
            <View className="mt-3 flex-row flex-wrap gap-2">
              <Badge label={ESTADO_CLIENTE[c.estado].label} tone={ESTADO_CLIENTE[c.estado].tone} />
              <Badge label={CONDICIONES_PAGO[c.condicionesPago]} tone="info" />
            </View>

            <Section title="Direcciones">
              <Card>
                <Text className="text-xs text-graphite-400">Fiscal</Text>
                <Text className="text-sm text-graphite-900">{direccionTexto(c.direccionFiscal)}</Text>
                <Text className="mt-3 text-xs text-graphite-400">Entrega</Text>
                <Text className="text-sm text-graphite-900">
                  {c.direccionEntrega ? direccionTexto(c.direccionEntrega) : 'La misma dirección fiscal'}
                </Text>
              </Card>
            </Section>

            {c.contactoNombre || c.contactoTelefono || c.contactoEmail ? (
              <Section title="Contacto">
                <Card>
                  {c.contactoNombre ? <Row label="Nombre" value={c.contactoNombre} /> : null}
                  {c.contactoTelefono ? <Row label="Teléfono" value={c.contactoTelefono} /> : null}
                  {c.contactoEmail ? <Row label="Correo" value={c.contactoEmail} /> : null}
                </Card>
              </Section>
            ) : null}

            {c.notas ? (
              <Section title="Notas">
                <Card>
                  <Text className="text-sm text-graphite-600">{c.notas}</Text>
                </Card>
              </Section>
            ) : null}

            <Section title={totalPedidos === 1 ? '1 pedido' : `${totalPedidos} pedidos`}>
              {orders.isLoading ? (
                <ActivityIndicator color="#0B3A53" />
              ) : orders.error ? (
                <Text className="text-sm text-graphite-600">No se pudieron cargar los pedidos del cliente.</Text>
              ) : pedidos.length === 0 ? (
                <Text className="text-sm text-graphite-600">Este cliente todavía no tiene pedidos.</Text>
              ) : (
                <View className="gap-3">
                  {pedidos.slice(0, RECIENTES).map((p) => (
                    <PedidoRow key={p.id} pedido={p} showCliente={false} />
                  ))}
                  {totalPedidos > RECIENTES ? (
                    <Text className="text-xs text-graphite-400">
                      Mostrando los {RECIENTES} más recientes de {totalPedidos}.
                    </Text>
                  ) : null}
                </View>
              )}
            </Section>
          </>
        ) : null}
      </ScrollView>
    </>
  );
}
