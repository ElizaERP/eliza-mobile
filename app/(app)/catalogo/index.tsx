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
import { Badge } from '@/components/ui/Badge';
import type { Product } from '@/features/catalog/api';
import { useCategoryMap, useProductList, useProductSearch } from '@/features/catalog/hooks';
import { STATUS_FILTERS, STATUS_LABEL, TYPE_FILTERS, TYPE_LABEL, formatGrams } from '@/features/catalog/labels';
import { FilterChips } from '@/components/ui/FilterChips';

/**
 * Catálogo — lista de productos (Sprint 9.2, solo lectura).
 *  - Sin búsqueda: GET /v1/catalog/products paginado, filtrado por estado.
 *  - Con búsqueda (≥ 2 letras): GET /v1/catalog/products/search; el filtro de
 *    estado se aplica sobre los resultados.
 */
export default function CatalogListScreen() {
  const [filterKey, setFilterKey] = useState('all');
  const [typeKey, setTypeKey] = useState('all');
  const [text, setText] = useState('');
  const [q, setQ] = useState('');

  // Espera 350 ms después de la última tecla antes de buscar
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 350);
    return () => clearTimeout(t);
  }, [text]);

  const filter = STATUS_FILTERS.find((f) => f.key === filterKey) ?? STATUS_FILTERS[0]!;
  const typeFilter = TYPE_FILTERS.find((f) => f.key === typeKey) ?? TYPE_FILTERS[0]!;
  const searching = q.length >= 2;

  const list = useProductList(filter.status, !searching, typeFilter.types);
  const search = useProductSearch(q);
  const { map: categories } = useCategoryMap();

  const items: Product[] = useMemo(() => {
    if (searching) {
      const found = search.data ?? [];
      return found.filter(
        (p) =>
          (!filter.status.length || filter.status.includes(p.status)) &&
          (!typeFilter.types.length || typeFilter.types.includes(p.type)),
      );
    }
    return list.data?.pages.flatMap((p) => p.items) ?? [];
  }, [searching, search.data, list.data, filter.status, typeFilter.types]);

  const active = searching ? search : list;
  const total = searching ? items.length : (list.data?.pages[0]?.total ?? 0);
  const error = active.error as ApiError | null;

  return (
    <>
      <Stack.Screen options={{ title: 'Catálogo' }} />
      <View className="flex-1 bg-snow">
        <View className="px-5 pt-4">
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Buscar por nombre, código, SKU o código de barras"
            placeholderTextColor="#8295A3"
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="while-editing"
            className="min-h-12 rounded-2xl border border-ice-100 bg-white px-4 text-base text-graphite-900"
          />
          <View className="mt-3 flex-row flex-wrap gap-2">
            {STATUS_FILTERS.map((f) => {
              const selected = f.key === filterKey;
              return (
                <Pressable
                  key={f.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setFilterKey(f.key)}
                  className={`min-h-9 justify-center rounded-full px-4 ${selected ? 'bg-frost-900' : 'border border-ice-100 bg-white'}`}
                >
                  <Text className={`text-sm font-medium ${selected ? 'text-white' : 'text-graphite-600'}`}>
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View className="mt-2">
            <FilterChips options={TYPE_FILTERS} value={typeKey} onChange={setTypeKey} small />
          </View>
          <Text className="mt-3 text-xs text-graphite-400">
            {active.isLoading ? 'Cargando…' : `${total} producto${total === 1 ? '' : 's'}`}
          </Text>
        </View>

        {error ? (
          <View className="m-5 rounded-2xl bg-danger/10 p-4">
            <Text className="text-sm font-semibold text-danger">No se pudo cargar el catálogo</Text>
            <Text className="mt-1 text-sm text-graphite-600">
              {error.status ? `HTTP ${error.status} · ` : ''}
              {error.message}
            </Text>
          </View>
        ) : null}

        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          contentContainerClassName="gap-3 px-5 pb-8 pt-3"
          renderItem={({ item }) => (
            <ProductRow product={item} categoryName={categories.get(item.categoryId)?.name} />
          )}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (!searching && list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
          }}
          refreshControl={
            <RefreshControl
              refreshing={active.isRefetching && !list.isFetchingNextPage}
              onRefresh={() => void active.refetch()}
            />
          }
          ListEmptyComponent={
            active.isLoading ? (
              <ActivityIndicator className="mt-12" color="#0B3A53" />
            ) : !error ? (
              <View className="mt-12 items-center">
                <Text className="text-4xl">🔎</Text>
                <Text className="mt-3 text-center text-sm text-graphite-600">
                  {searching ? `Nada coincide con “${q}”.` : 'No hay productos con estos filtros.'}
                </Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            list.isFetchingNextPage ? <ActivityIndicator className="my-4" color="#0B3A53" /> : null
          }
        />
      </View>
    </>
  );
}

function ProductRow({ product, categoryName }: { product: Product; categoryName?: string }) {
  const router = useRouter();
  const status = STATUS_LABEL[product.status];
  const details = [
    TYPE_LABEL[product.type],
    product.packSize ? `x${product.packSize}` : null,
    formatGrams(product.netWeightGrams),
  ].filter(Boolean);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push({ pathname: '/(app)/catalogo/[id]', params: { id: product.id } })
      }
      className="rounded-2xl border border-ice-100 bg-white p-4 active:bg-ice-50"
    >
      <View className="flex-row items-start justify-between gap-3">
        <Text className="flex-1 text-base font-semibold text-graphite-900" numberOfLines={2}>
          {product.name}
        </Text>
        <Badge label={status.label} tone={status.tone} />
      </View>
      <Text className="mt-1 text-xs text-graphite-400">
        {product.code}
        {categoryName ? ` · ${categoryName}` : ''}
      </Text>
      <View className="mt-3 flex-row flex-wrap items-center gap-2">
        <Text className="text-sm text-graphite-600">{details.join(' · ')}</Text>
        {product.isControlled ? <Badge label="❄️ Cadena de frío" tone="info" /> : null}
      </View>
    </Pressable>
  );
}
