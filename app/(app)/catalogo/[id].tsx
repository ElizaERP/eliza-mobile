import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import type { ApiError } from '@/core/http/apiClient';
import { Badge } from '@/components/ui/Badge';
import { InfoRow } from '@/components/ui/InfoRow';
import { useCategoryMap, useProduct, useProductsByIds, useUomMap } from '@/features/catalog/hooks';
import { STATUS_LABEL, TYPE_LABEL, formatGrams, formatSalePrice, formatTempRange } from '@/features/catalog/labels';

/**
 * Catálogo — detalle de producto (Sprint 9.2, solo lectura).
 * GET /v1/catalog/products/:id + nombres de categoría, unidades y componentes del BOM.
 */
export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const product = useProduct(id ?? '');
  const { map: categories } = useCategoryMap();
  const { map: uoms } = useUomMap();

  const p = product.data;
  const bom = p ? [...p.components].sort((a, b) => a.position - b.position) : [];
  const componentQueries = useProductsByIds(bom.map((c) => c.componentProductId));

  if (product.isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-snow">
        <Stack.Screen options={{ title: 'Producto' }} />
        <ActivityIndicator color="#0B3A53" />
      </View>
    );
  }

  if (product.error || !p) {
    const err = product.error as ApiError | null;
    return (
      <View className="flex-1 bg-snow p-5">
        <Stack.Screen options={{ title: 'Producto' }} />
        <View className="rounded-2xl bg-danger/10 p-4">
          <Text className="text-sm font-semibold text-danger">No se pudo cargar el producto</Text>
          <Text className="mt-1 text-sm text-graphite-600">
            {err?.status ? `HTTP ${err.status} · ` : ''}
            {err?.message ?? 'Producto no encontrado'}
          </Text>
        </View>
      </View>
    );
  }

  const status = STATUS_LABEL[p.status];
  const category = categories.get(p.categoryId);
  const unit = uoms.get(p.unitOfSaleId);
  const rows: [string, string | null][] = [
    ['Código', p.code],
    ['SKU', p.sku],
    ['Código de barras', p.barcode],
    ['Tipo', TYPE_LABEL[p.type]],
    ['Categoría', category ? `${category.name} (${category.path})` : null],
    ['Unidad de venta', unit ? `${unit.name} (${unit.symbol})` : null],
    ['Unidades por paquete', p.packSize !== null ? String(p.packSize) : null],
    ['Peso neto', formatGrams(p.netWeightGrams)],
    ['Peso bruto', formatGrams(p.grossWeightGrams)],
    ['Vida útil', p.expiryDays !== null ? `${p.expiryDays} días` : null],
    ['Almacenamiento', formatTempRange(p.storageTempMinC, p.storageTempMaxC)],
    ['Precio de lista', formatSalePrice(p.salePrice) ?? 'Sin precio de lista'],
    ['IVA', p.taxRate !== null ? `${p.taxRate} %` : null],
  ];

  return (
    <>
      <Stack.Screen options={{ title: 'Producto' }} />
      <ScrollView className="flex-1 bg-snow" contentContainerClassName="p-5 pb-10">
        <View className="rounded-2xl border border-ice-100 bg-white p-5">
          <View className="flex-row flex-wrap gap-2">
            <Badge label={status.label} tone={status.tone} />
            {p.isControlled ? <Badge label="❄️ Cadena de frío y lote" tone="info" /> : null}
          </View>
          <Text className="mt-3 text-xl font-bold text-graphite-900">{p.name}</Text>
          {p.description ? (
            <Text className="mt-2 text-sm text-graphite-600">{p.description}</Text>
          ) : null}
        </View>

        <View className="mt-4 rounded-2xl border border-ice-100 bg-white px-5 py-2">
          {rows
            .filter((r): r is [string, string] => r[1] !== null && r[1] !== '')
            .map(([label, value]) => (
              <InfoRow key={label} label={label} value={value} />
            ))}
        </View>

        <View className="mt-4 rounded-2xl border border-ice-100 bg-white p-5">
          <Text className="text-xs font-semibold uppercase tracking-wide text-graphite-400">
            Lista de materiales (BOM)
          </Text>
          {bom.length === 0 ? (
            <Text className="mt-3 text-sm text-graphite-600">Este producto no tiene componentes.</Text>
          ) : (
            bom.map((c, i) => {
              const comp = componentQueries[i]?.data;
              const u = uoms.get(c.uomId);
              return (
                <Pressable
                  key={`${c.componentProductId}-${c.position}`}
                  accessibilityRole="button"
                  disabled={!comp}
                  onPress={() =>
                    router.push({ pathname: '/(app)/catalogo/[id]', params: { id: c.componentProductId } })
                  }
                  className="flex-row items-start justify-between border-b border-ice-100 py-3 active:bg-ice-50"
                >
                  <View className="flex-1 pr-3">
                    <Text className="text-sm font-medium text-graphite-900">
                      {comp?.name ?? 'Cargando…'}
                    </Text>
                    {comp ? <Text className="text-xs text-graphite-400">{comp.code}</Text> : null}
                    {c.notes ? <Text className="mt-1 text-xs text-graphite-600">{c.notes}</Text> : null}
                  </View>
                  <Text className="text-sm font-semibold text-graphite-900">
                    {c.quantity.toLocaleString('es-CO')} {u?.symbol ?? ''}
                  </Text>
                </Pressable>
              );
            })
          )}
          {bom.length > 0 ? (
            <Text className="mt-3 text-xs text-graphite-400">Cantidades por unidad del producto.</Text>
          ) : null}
        </View>
      </ScrollView>
    </>
  );
}
