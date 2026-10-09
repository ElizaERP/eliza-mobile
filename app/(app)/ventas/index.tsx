import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import type { ApiError } from '@/core/http/apiClient';
import { useAuthStore } from '@/core/auth';
import { canReadCustomers } from '@/core/rbac/menu';
import { Badge } from '@/components/ui/Badge';
import { FilterChips } from '@/components/ui/FilterChips';
import type { ClienteListItem, EstadoPedido, PedidoListItem } from '@/features/sales/api';
import { useCustomerList, useSalesOrderList } from '@/features/sales/hooks';
import {
  CONDICIONES_PAGO,
  ESTADO_CLIENTE,
  ESTADO_PEDIDO_FILTERS,
  PERIODO_FILTERS,
  dayKey,
  dayLabel,
  money,
  periodoDesde,
  type Periodo,
} from '@/features/sales/labels';
import { PedidoRow } from '@/features/sales/PedidoRow';

/**
 * Ventas (Sprint 9.5, solo lectura).
 *  - Pedidos: GET /v1/sales/orders?estado=…&creadoDesde=…  (Hoy por defecto, agrupados por día).
 *  - Clientes: GET /v1/sales/customers?search=…  (solo si el rol puede leer clientes).
 */
export default function SalesScreen() {
  const roles = useAuthStore((s) => s.user?.roles);
  const showCustomers = canReadCustomers(roles ?? []);
  const [tab, setTab] = useState<'orders' | 'customers'>('orders');

  return (
    <>
      <Stack.Screen options={{ title: 'Ventas' }} />
      <View className="flex-1 bg-snow">
        {showCustomers ? (
          <View className="mx-5 mt-4 flex-row rounded-2xl bg-ice-100 p-1">
            {(
              [
                ['orders', 'Pedidos'],
                ['customers', 'Clientes'],
              ] as const
            ).map(([key, label]) => (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === key }}
                onPress={() => setTab(key)}
                className={`min-h-10 flex-1 items-center justify-center rounded-xl ${tab === key ? 'bg-white' : ''}`}
              >
                <Text className={`text-sm font-semibold ${tab === key ? 'text-frost-900' : 'text-graphite-600'}`}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {tab === 'orders' || !showCustomers ? <OrdersTab /> : <CustomersTab />}
      </View>
    </>
  );
}

function ErrorBox({ title, error }: { title: string; error: ApiError }) {
  return (
    <View className="mt-4 rounded-2xl bg-danger/10 p-4">
      <Text className="text-sm font-semibold text-danger">{title}</Text>
      <Text className="mt-1 text-sm text-graphite-600">
        {error.status ? `HTTP ${error.status} · ` : ''}
        {error.message}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------
type OrderRowItem =
  | { kind: 'day'; key: string; label: string; count: number; total: number }
  | { kind: 'order'; key: string; pedido: PedidoListItem };

function OrdersTab() {
  const [periodo, setPeriodo] = useState<Periodo>('hoy');
  const [estado, setEstado] = useState<EstadoPedido | 'all'>('all');
  // Inicio del período en hora local; se recalcula al cambiar de período o al refrescar
  const [ahora, setAhora] = useState(() => new Date());
  const desde = useMemo(() => periodoDesde(periodo, ahora), [periodo, ahora]);
  const list = useSalesOrderList(estado, undefined, desde);
  const pedidos = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data]);
  const total = list.data?.pages[0]?.total ?? 0;
  const error = list.error as ApiError | null;

  // Agrupa por día local: encabezado (cantidad y total vendido sin cancelados) + pedidos
  const rows: OrderRowItem[] = useMemo(() => {
    const out: OrderRowItem[] = [];
    let current: Extract<OrderRowItem, { kind: 'day' }> | null = null;
    for (const p of pedidos) {
      const k = dayKey(p.createdAt);
      if (!current || current.key !== `day-${k}`) {
        current = { kind: 'day', key: `day-${k}`, label: dayLabel(k, ahora), count: 0, total: 0 };
        out.push(current);
      }
      current.count += 1;
      if (p.estado !== 'Cancelada') current.total += p.total;
      out.push({ kind: 'order', key: p.id, pedido: p });
    }
    return out;
  }, [pedidos, ahora]);

  // El total del período solo es exacto cuando ya se cargaron todas las páginas
  const completo = !list.hasNextPage;
  const vendido = pedidos.filter((p) => p.estado !== 'Cancelada').reduce((a, p) => a + p.total, 0);

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.key}
      contentContainerClassName="gap-3 px-5 pb-8 pt-4"
      ListHeaderComponent={
        <View className="mb-1 gap-2">
          <FilterChips options={PERIODO_FILTERS} value={periodo} onChange={(k) => { setAhora(new Date()); setPeriodo(k); }} />
          <FilterChips options={ESTADO_PEDIDO_FILTERS} value={estado} onChange={setEstado} small />
          {!list.isLoading && !error && total > 0 ? (
            <View className="mt-2 flex-row items-end justify-between rounded-2xl bg-frost-900 p-4">
              <View>
                <Text className="text-xs text-ice-100">
                  {PERIODO_FILTERS.find((f) => f.key === periodo)?.label} · {total === 1 ? '1 pedido' : `${total} pedidos`}
                </Text>
                <Text className="mt-1 text-2xl font-bold text-white">
                  {completo ? money(vendido) : `${money(vendido)}+`}
                </Text>
              </View>
              <Text className="text-xs text-ice-100">vendido{'\n'}sin cancelados</Text>
            </View>
          ) : null}
          {error ? <ErrorBox title="No se pudieron cargar los pedidos" error={error} /> : null}
        </View>
      }
      renderItem={({ item }) =>
        item.kind === 'day' ? (
          <View className="mt-2 flex-row items-baseline justify-between">
            <Text className="text-sm font-semibold uppercase tracking-wide text-graphite-600">{item.label}</Text>
            <Text className="text-xs text-graphite-400">
              {item.count === 1 ? '1 pedido' : `${item.count} pedidos`} · {money(item.total)}
            </Text>
          </View>
        ) : (
          <PedidoRow pedido={item.pedido} />
        )
      }
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
      }}
      refreshControl={
        <RefreshControl
          refreshing={list.isRefetching}
          onRefresh={() => {
            setAhora(new Date());
            void list.refetch();
          }}
        />
      }
      ListEmptyComponent={
        list.isLoading ? (
          <ActivityIndicator className="mt-12" color="#0B3A53" />
        ) : !error ? (
          <View className="mt-12 items-center">
            <Text className="text-center text-sm text-graphite-600">
              {periodo === 'hoy' ? 'Todavía no hay pedidos hoy' : 'No hay pedidos en este período'}
              {estado !== 'all' ? ' con este estado' : ''}.
            </Text>
            {periodo !== 'todo' ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => { setAhora(new Date()); setPeriodo(periodo === 'hoy' ? 'semana' : 'todo'); }}
                className="mt-4 min-h-10 justify-center rounded-full border border-ice-100 bg-white px-5"
              >
                <Text className="text-sm font-medium text-frost-900">
                  {periodo === 'hoy' ? 'Ver los últimos 7 días' : 'Ver todos'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null
      }
      ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator className="my-4" color="#0B3A53" /> : null}
    />
  );
}

// ---------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------
function CustomersTab() {
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 350);
    return () => clearTimeout(t);
  }, [text]);

  const list = useCustomerList(q, q.length === 0 || q.length >= 2);
  const items = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data]);
  const total = list.data?.pages[0]?.total ?? 0;
  const error = list.error as ApiError | null;

  return (
    <FlatList
      data={items}
      keyExtractor={(c) => c.id}
      contentContainerClassName="gap-3 px-5 pb-8 pt-4"
      ListHeaderComponent={
        <View className="mb-1">
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Buscar por razón social, NIT o código"
            placeholderTextColor="#8295A3"
            autoCorrect={false}
            autoCapitalize="none"
            className="min-h-12 rounded-2xl border border-ice-100 bg-white px-4 text-base text-graphite-900"
          />
          {!list.isLoading && !error ? (
            <Text className="mt-3 text-xs text-graphite-400">{total === 1 ? '1 cliente' : `${total} clientes`}</Text>
          ) : null}
          {error ? <ErrorBox title="No se pudieron cargar los clientes" error={error} /> : null}
        </View>
      }
      renderItem={({ item }) => <ClienteRow cliente={item} />}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
      }}
      refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} />}
      ListEmptyComponent={
        list.isLoading ? (
          <ActivityIndicator className="mt-12" color="#0B3A53" />
        ) : !error ? (
          <Text className="mt-12 text-center text-sm text-graphite-600">
            {q ? `Ningún cliente coincide con “${q}”.` : 'No hay clientes.'}
          </Text>
        ) : null
      }
    />
  );
}

function ClienteRow({ cliente }: { cliente: ClienteListItem }) {
  const router = useRouter();
  const estado = ESTADO_CLIENTE[cliente.estado];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/(app)/ventas/cliente/[id]', params: { id: cliente.id } })}
      className="rounded-2xl border border-ice-100 bg-white p-4 active:bg-ice-50"
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-base font-semibold text-graphite-900" numberOfLines={2}>
            {cliente.razonSocial}
          </Text>
          {cliente.nombreComercial ? (
            <Text className="text-sm text-graphite-600">{cliente.nombreComercial}</Text>
          ) : null}
          <Text className="mt-1 text-xs text-graphite-400">
            NIT {cliente.nit} · {cliente.codigo} · {cliente.ciudad}
          </Text>
        </View>
        <Badge label={estado.label} tone={estado.tone} />
      </View>
      <Text className="mt-3 text-xs text-graphite-600">{CONDICIONES_PAGO[cliente.condicionesPago]}</Text>
    </Pressable>
  );
}
