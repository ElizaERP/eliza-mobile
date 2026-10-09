import { useMemo, useState } from 'react';
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
import { useAuthStore } from '@/core/auth';
import type { ApiError } from '@/core/http/apiClient';
import { canManageInventory } from '@/core/rbac/menu';
import { Badge } from '@/components/ui/Badge';
import type { Product } from '@/features/catalog/api';
import { useProductList, useProductsByIds } from '@/features/catalog/hooks';
import type { Lote, StockSummary } from '@/features/inventory/api';
import { useExpiringLots, useStocks } from '@/features/inventory/hooks';
import { TYPE_FILTERS, TYPE_LABEL } from '@/features/catalog/labels';
import { FilterChips } from '@/components/ui/FilterChips';
import {
  EXPIRY_WINDOWS,
  LOTE_ESTADO,
  expiryText,
  formatDate,
  qty,
} from '@/features/inventory/labels';

/**
 * Inventario (Sprint 9.3).
 *  - Existencias: productos del catálogo + GET /v1/inventory/stock/by-sku/:id por producto.
 *  - Por vencer: GET /v1/inventory/lots/expiring?withinDays=N (orden FEFO).
 * Sprint 13: "+ Recibir" para ingresar mercancía (bodega y admin).
 */
export default function InventoryScreen() {
  const [tab, setTab] = useState<'stock' | 'expiring'>('stock');
  const router = useRouter();
  const puedeRecibir = canManageInventory(useAuthStore((s) => s.user?.roles) ?? []);
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Inventario',
          headerRight: puedeRecibir
            ? () => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Recibir mercancía"
                  onPress={() => router.push('/(app)/inventario/recibir')}
                  className="min-h-9 flex-row items-center rounded-full bg-white px-4"
                >
                  <Text className="text-sm font-semibold text-frost-900">+ Recibir</Text>
                </Pressable>
              )
            : undefined,
        }}
      />
      <View className="flex-1 bg-snow">
        <View className="mx-5 mt-4 flex-row rounded-2xl bg-ice-100 p-1">
          {(
            [
              ['stock', 'Existencias'],
              ['expiring', 'Por vencer'],
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
        {tab === 'stock' ? <StockTab /> : <ExpiringTab />}
      </View>
    </>
  );
}

function ErrorBox({ title, error }: { title: string; error: ApiError }) {
  return (
    <View className="m-5 rounded-2xl bg-danger/10 p-4">
      <Text className="text-sm font-semibold text-danger">{title}</Text>
      <Text className="mt-1 text-sm text-graphite-600">
        {error.status ? `HTTP ${error.status} · ` : ''}
        {error.message}
      </Text>
      {error.status === 403 ? (
        <Text className="mt-2 text-xs text-graphite-600">
          Tu rol no tiene permiso para esta consulta en el backend.
        </Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------
// Existencias
// ---------------------------------------------------------------------
function StockTab() {
  const [text, setText] = useState('');
  const [typeKey, setTypeKey] = useState('all');
  const typeFilter = TYPE_FILTERS.find((f) => f.key === typeKey) ?? TYPE_FILTERS[0]!;
  const list = useProductList([], true, typeFilter.types);
  const products = useMemo(() => {
    const all = (list.data?.pages.flatMap((p) => p.items) ?? []).filter((p) => p.type !== 'Service');
    const t = text.trim().toLowerCase();
    return t ? all.filter((p) => `${p.name} ${p.code} ${p.sku}`.toLowerCase().includes(t)) : all;
  }, [list.data, text]);
  const stocks = useStocks(products.map((p) => p.id));

  if (list.error) return <ErrorBox title="No se pudo cargar la lista de productos" error={list.error as unknown as ApiError} />;

  return (
    <FlatList
      data={products}
      keyExtractor={(p) => p.id}
      contentContainerClassName="gap-3 px-5 pb-8 pt-4"
      ListHeaderComponent={
        <View className="mb-1">
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Filtrar por nombre o código"
            placeholderTextColor="#8295A3"
            autoCorrect={false}
            autoCapitalize="none"
            className="min-h-12 rounded-2xl border border-ice-100 bg-white px-4 text-base text-graphite-900"
          />
          <View className="mt-3">
            <FilterChips options={TYPE_FILTERS} value={typeKey} onChange={setTypeKey} small />
          </View>
        </View>
      }
      renderItem={({ item, index }) => (
        <StockRow product={item} stock={stocks[index]?.data} loading={stocks[index]?.isLoading ?? true} />
      )}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
      }}
      refreshControl={
        <RefreshControl
          refreshing={list.isRefetching}
          onRefresh={() => {
            void list.refetch();
            stocks.forEach((s) => void s.refetch());
          }}
        />
      }
      ListEmptyComponent={
        list.isLoading ? (
          <ActivityIndicator className="mt-12" color="#0B3A53" />
        ) : (
          <Text className="mt-12 text-center text-sm text-graphite-600">No hay productos de este tipo.</Text>
        )
      }
      ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator className="my-4" color="#0B3A53" /> : null}
    />
  );
}

function StockRow({ product, stock, loading }: { product: Product; stock?: StockSummary; loading: boolean }) {
  const router = useRouter();
  const empty = stock && stock.totalFisico === 0;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/(app)/inventario/[productId]', params: { productId: product.id } })}
      className="flex-row items-center rounded-2xl border border-ice-100 bg-white p-4 active:bg-ice-50"
    >
      <View className="flex-1 pr-3">
        <Text className="text-base font-semibold text-graphite-900" numberOfLines={2}>
          {product.name}
        </Text>
        <Text className="mt-1 text-xs text-graphite-400">
          {product.code} · {TYPE_LABEL[product.type]}
        </Text>
        {stock && (stock.totalReservado > 0 || stock.totalBloqueado > 0) ? (
          <Text className="mt-2 text-xs text-graphite-600">
            {stock.totalReservado > 0 ? `Reservado ${qty(stock.totalReservado)}` : ''}
            {stock.totalReservado > 0 && stock.totalBloqueado > 0 ? ' · ' : ''}
            {stock.totalBloqueado > 0 ? `Bloqueado ${qty(stock.totalBloqueado)}` : ''}
          </Text>
        ) : null}
      </View>
      <View className="items-end">
        {loading ? (
          <ActivityIndicator color="#0B3A53" />
        ) : stock ? (
          <>
            <Text className={`text-2xl font-bold ${empty ? 'text-graphite-400' : 'text-frost-900'}`}>
              {qty(stock.totalDisponible)}
            </Text>
            <Text className="text-xs text-graphite-400">disponible</Text>
          </>
        ) : (
          <Text className="text-xs text-graphite-400">—</Text>
        )}
        {empty ? (
          <View className="mt-1">
            <Badge label="Sin stock" tone="neutral" />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------
// Por vencer
// ---------------------------------------------------------------------
function ExpiringTab() {
  const [days, setDays] = useState<number>(30);
  const lots = useExpiringLots(days);
  const sorted = useMemo(
    () => [...(lots.data ?? [])].sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento)),
    [lots.data],
  );
  const productIds = useMemo(() => [...new Set(sorted.map((l) => l.productId))], [sorted]);
  const productQueries = useProductsByIds(productIds);
  const names = new Map(productIds.map((id, i) => [id, productQueries[i]?.data?.name]));

  return (
    <FlatList
      data={sorted}
      keyExtractor={(l) => l.id}
      contentContainerClassName="gap-3 px-5 pb-8 pt-4"
      ListHeaderComponent={
        <View className="mb-1">
          <View className="flex-row gap-2">
            {EXPIRY_WINDOWS.map((d) => (
              <Pressable
                key={d}
                accessibilityRole="button"
                accessibilityState={{ selected: d === days }}
                onPress={() => setDays(d)}
                className={`min-h-9 justify-center rounded-full px-4 ${d === days ? 'bg-frost-900' : 'border border-ice-100 bg-white'}`}
              >
                <Text className={`text-sm font-medium ${d === days ? 'text-white' : 'text-graphite-600'}`}>
                  {d} días
                </Text>
              </Pressable>
            ))}
          </View>
          <Text className="mt-3 text-xs text-graphite-400">
            Lotes que vencen en los próximos {days} días, el más próximo primero (FEFO).
          </Text>
          {lots.error ? <ErrorBox title="No se pudieron cargar los lotes" error={lots.error as unknown as ApiError} /> : null}
        </View>
      }
      renderItem={({ item }) => <ExpiringRow lot={item} productName={names.get(item.productId)} />}
      refreshControl={<RefreshControl refreshing={lots.isRefetching} onRefresh={() => void lots.refetch()} />}
      ListEmptyComponent={
        lots.isLoading ? (
          <ActivityIndicator className="mt-12" color="#0B3A53" />
        ) : !lots.error ? (
          <View className="mt-12 items-center">
            <Text className="text-4xl">✅</Text>
            <Text className="mt-3 text-center text-sm text-graphite-600">
              Ningún lote vence en los próximos {days} días.
            </Text>
          </View>
        ) : null
      }
    />
  );
}

function ExpiringRow({ lot, productName }: { lot: Lote; productName?: string }) {
  const router = useRouter();
  const estado = LOTE_ESTADO[lot.estado];
  const exp = expiryText(lot.diasParaVencer);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/(app)/inventario/[productId]', params: { productId: lot.productId } })}
      className="rounded-2xl border border-ice-100 bg-white p-4 active:bg-ice-50"
    >
      <View className="flex-row items-start justify-between gap-3">
        <Text className="flex-1 text-base font-semibold text-graphite-900">Lote {lot.codigoLote}</Text>
        <Badge label={exp.text} tone={lot.estaVencido ? 'neutral' : exp.tone} />
      </View>
      <Text className="mt-1 text-sm text-graphite-600">{productName ?? 'Producto…'}</Text>
      <View className="mt-2 flex-row items-center gap-2">
        <Text className="text-xs text-graphite-400">Vence {formatDate(lot.fechaVencimiento)}</Text>
        <Badge label={estado.label} tone={estado.tone} />
      </View>
    </Pressable>
  );
}
